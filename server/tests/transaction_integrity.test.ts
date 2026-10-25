import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { InventoryItem, PurchaseRequest, LedgerEntry } from '../src/models';
import { AuditService } from '../src/services/auditService';

describe('Phase 3: Database Integrity, Concurrency Control & Transaction Safety', () => {
  let adminToken: string;
  let testItem: InventoryItem;

  beforeAll(async () => {
    await sequelize.authenticate();

    const authRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@entrix.local', password: 'Admin@123' });
    adminToken = authRes.body.access_token;

    // Create an isolated inventory item for concurrency and transaction tests
    testItem = await InventoryItem.create({
      tenant_id: '00000000-0000-0000-0000-000000000001',
      sku_code: `TX-SKU-${Date.now()}`,
      name: 'High Integrity Stress Test Component',
      category: 'Test Materials',
      unit_of_measure: 'PCS',
      unit_price: 150.0,
      stock_qty: 100,
      safety_stock: 20
    });
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  // 1. CONCURRENCY CONTROL & ROW LOCKING
  describe('Concurrency Control & Row Locking', () => {
    it('serializes concurrent stock deductions and eliminates lost updates', async () => {
      const initialStock = 100;
      await testItem.update({ stock_qty: initialStock });

      // Fire 5 concurrent deductions of 10 units each
      const deductionPromises = Array.from({ length: 5 }).map(() =>
        request(app)
          .patch(`/api/v1/inventory/${testItem.id}/adjust`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            quantity: 10,
            type: 'OUT',
            reason: 'Concurrent stress test deduction'
          })
      );

      const results = await Promise.all(deductionPromises);
      results.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      // Stock must be exactly 100 - (5 * 10) = 50
      const refreshedItem = await InventoryItem.findByPk(testItem.id);
      expect(Number(refreshedItem?.stock_qty)).toBe(50);
    });

    it('blocks negative inventory deductions with transaction rollback', async () => {
      // Current stock is 50; attempt to deduct 60
      const res = await request(app)
        .patch(`/api/v1/inventory/${testItem.id}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quantity: 60,
          type: 'OUT',
          reason: 'Excessive deduction attempt'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Insufficient stock');

      // Stock must remain unchanged at 50
      const refreshedItem = await InventoryItem.findByPk(testItem.id);
      expect(Number(refreshedItem?.stock_qty)).toBe(50);
    });
  });

  // 2. DOUBLE-ENTRY LEDGER BALANCE SAFEGUARDS
  describe('Double-Entry General Ledger Balance Safeguards', () => {
    it('rejects unbalanced journal entries (Debits != Credits) and rolls back', async () => {
      const unbalancedRes = await request(app)
        .post('/api/v1/finance/journal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entries: [
            { account_code: '1010 - Cash', debit_amount: 5000, credit_amount: 0 },
            { account_code: '4010 - Revenue', debit_amount: 0, credit_amount: 4500 }
          ]
        });

      expect(unbalancedRes.status).toBe(400);
      expect(unbalancedRes.body.success).toBe(false);
      expect(unbalancedRes.body.error).toContain('Double-entry imbalance');
    });

    it('atomically commits balanced journal entries (Debits == Credits)', async () => {
      const balancedRes = await request(app)
        .post('/api/v1/finance/journal')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entries: [
            { account_code: '1010 - Operating Cash', debit_amount: 25000, credit_amount: 0 },
            { account_code: '2010 - Bank Loan Payable', debit_amount: 0, credit_amount: 25000 }
          ],
          reference_type: 'BANK_LOAN_DISBURSEMENT'
        });

      expect(balancedRes.status).toBe(201);
      expect(balancedRes.body.success).toBe(true);
      expect(balancedRes.body.data.transaction_uuid).toBeDefined();

      // Verify entries exist in the database with the shared transaction_uuid
      const txUuid = balancedRes.body.data.transaction_uuid;
      const records = await LedgerEntry.findAll({ where: { transaction_uuid: txUuid } });
      expect(records.length).toBe(2);
      const totalDebits = records.reduce((sum, r) => sum + Number(r.debit_amount), 0);
      const totalCredits = records.reduce((sum, r) => sum + Number(r.credit_amount), 0);
      expect(totalDebits).toBe(25000);
      expect(totalCredits).toBe(25000);
    });
  });

  // 3. PROCUREMENT STATE MACHINE TRANSACTION SAFETY
  describe('State Machine Guards & Repeat-Action Prevention', () => {
    it('prevents double goods-reception on the same Purchase Request', async () => {
      // Create and approve a purchase requisition
      const prRes = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_id: testItem.id,
          quantity: 10,
          justification: 'State machine guard test'
        });
      expect(prRes.status).toBe(201);
      const prId = prRes.body.data.id;

      // Manager approve (< 10k so auto-approved)
      const approveRes = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/manager-approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });
      expect(approveRes.status).toBe(200);

      // First receive goods call succeeds
      const firstReceive = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/receive-goods`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(firstReceive.status).toBe(200);
      expect(firstReceive.body.data.pr.status).toBe('GOODS_RECEIVED');

      // Duplicate receive goods call must be rejected
      const duplicateReceive = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/receive-goods`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(duplicateReceive.status).toBe(400);
      expect(duplicateReceive.body.error).toContain('Cannot receive goods');
    });
  });

  // 4. CRYPTOGRAPHIC AUDIT CHAIN INTEGRITY
  describe('Cryptographic Audit Chain Integrity', () => {
    it('verifies that the SHA-256 audit log hash chain remains unbroken', async () => {
      const verification = await AuditService.verifyChainIntegrity();
      expect(verification.valid).toBe(true);
      expect(verification.total_checked).toBeGreaterThan(0);
    });
  });
});
