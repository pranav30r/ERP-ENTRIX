import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { User, InventoryItem, PurchaseRequest } from '../src/models';

describe('Enterprise SaaS Verification: Isolation, Permissions, Transactions & State Machines', () => {
  let adminToken: string;
  let hrToken: string;
  let financeToken: string;
  let procurementToken: string;
  let staffToken: string;
  let testItemId: string;
  let initialStock: number;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Authenticate all 5 personas
    const [adminRes, hrRes, finRes, procRes, staffRes] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: 'admin@entrix.local', password: 'Admin@123' }),
      request(app).post('/api/v1/auth/login').send({ email: 'hr@entrix.local', password: 'Admin@123' }),
      request(app).post('/api/v1/auth/login').send({ email: 'finance@entrix.local', password: 'Admin@123' }),
      request(app).post('/api/v1/auth/login').send({ email: 'procurement@entrix.local', password: 'Admin@123' }),
      request(app).post('/api/v1/auth/login').send({ email: 'staff@entrix.local', password: 'Admin@123' })
    ]);

    adminToken = adminRes.body.access_token;
    hrToken = hrRes.body.access_token;
    financeToken = finRes.body.access_token;
    procurementToken = procRes.body.access_token;
    staffToken = staffRes.body.access_token;

    // Fetch baseline SKU
    const item = await InventoryItem.findOne();
    if (item) {
      testItemId = item.id;
      initialStock = item.stock_qty;
    }
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  // 1. TENANT & DEPARTMENT ISOLATION
  describe('Tenant & Department Isolation', () => {
    it('Staff User can only view their own requisitions, not organization-wide requests', async () => {
      const res = await request(app)
        .get('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Verify every returned requisition belongs to the staff user
      const staffUser = await User.findOne({ where: { email: 'staff@entrix.local' } });
      res.body.data.forEach((pr: any) => {
        expect(pr.requester_id).toBe(staffUser?.id);
      });
    });

    it('Super Admin has uninhibited visibility across all departments', async () => {
      const res = await request(app)
        .get('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // 2. STRICT RBAC PERMISSIONS ENFORCEMENT
  describe('Granular RBAC Permissions Enforcement', () => {
    it('Rejects Staff User attempting to adjust stock (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/${testItemId}/adjust`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ quantity: 5, type: 'IN', reason: 'Unauthorized attempt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Rejects Procurement Officer attempting to access Financial Ledger (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${procurementToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Rejects Staff User attempting to approve PR (403 Forbidden)', async () => {
      const pr = await PurchaseRequest.findOne({ where: { status: 'PENDING_MANAGER' } });
      if (pr) {
        const res = await request(app)
          .post(`/api/v1/procurement/requests/${pr.id}/manager-approval`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ action: 'APPROVE' });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      }
    });
  });

  // 3. TRANSACTION SAFETY & ACID ROLLBACK
  describe('Transaction Safety & ACID Rollback', () => {
    it('Rolls back atomically and prevents inventory increment when receiving goods on unapproved PR', async () => {
      // Create a fresh PR in PENDING_MANAGER status
      const createRes = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_id: testItemId,
          quantity: 25,
          justification: 'Atomicity test requisition'
        });

      const unapprovedPrId = createRes.body.data.id;
      const stockBefore = (await InventoryItem.findByPk(testItemId))?.stock_qty;

      // Attempt to receive goods on this unapproved PR (should fail and rollback)
      const receiveRes = await request(app)
        .post(`/api/v1/procurement/requests/${unapprovedPrId}/receive-goods`)
        .set('Authorization', `Bearer ${procurementToken}`);

      expect(receiveRes.status).toBe(400);
      expect(receiveRes.body.error).toContain('Cannot receive goods');

      // Verify stock was NOT mutated
      const stockAfter = (await InventoryItem.findByPk(testItemId))?.stock_qty;
      expect(stockAfter).toBe(stockBefore);
    });
  });

  // 4. DETERMINISTIC WORKFLOW STATE MACHINE
  describe('Deterministic Workflow State Machine', () => {
    it('Prevents invalid transition: Manager cannot approve an already REJECTED requisition', async () => {
      // 1. Create PR
      const createRes = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_id: testItemId,
          quantity: 2,
          justification: 'State machine test'
        });

      const prId = createRes.body.data.id;

      // 2. Reject the PR
      const rejectRes = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/manager-approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'REJECT', comments: 'Budget capped' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('REJECTED');

      // 3. Try to approve the now-rejected PR (must be rejected with HTTP 400)
      const invalidApproveRes = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/manager-approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      expect(invalidApproveRes.status).toBe(400);
      expect(invalidApproveRes.body.error).toContain('Invalid transition: Current status is REJECTED');
    });

    it('Branching rule: < ₹10,000 auto-advances to APPROVED; >= ₹10,000 requires Finance approval', async () => {
      // 1. Small Requisition (< ₹10k)
      const smallPrRes = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ item_id: testItemId, quantity: 1, justification: 'Small PR' });

      const smallPrId = smallPrRes.body.data.id;
      const smallApprove = await request(app)
        .post(`/api/v1/procurement/requests/${smallPrId}/manager-approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      expect(smallApprove.status).toBe(200);
      expect(smallApprove.body.data.status).toBe('APPROVED');

      // 2. Large Requisition (>= ₹10k)
      const largePrRes = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ item_id: testItemId, quantity: 500, justification: 'Bulk PR' });

      const largePrId = largePrRes.body.data.id;
      const largeApprove = await request(app)
        .post(`/api/v1/procurement/requests/${largePrId}/manager-approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE' });

      expect(largeApprove.status).toBe(200);
      expect(largeApprove.body.data.status).toBe('PENDING_FINANCE');
    });
  });
});
