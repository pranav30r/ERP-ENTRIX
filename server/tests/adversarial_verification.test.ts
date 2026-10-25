import request from 'supertest';
import { app } from '../src/app';
import { sequelize } from '../src/config/db';
import { Tenant, User, Subscription, InventoryItem, PurchaseRequest, PurchaseOrder, GoodsReceivedNote, Supplier, SupplierInvoice, LedgerEntry } from '../src/models';
import { generateAccessToken } from '../src/services/tokenService';

describe('Adversarial Verification: Multi-Tenant Boundary & Accounting Invariants', () => {
  let tenantAlpha: Tenant;
  let adminAlpha: User;
  let tokenAlpha: string;

  let tenantBeta: Tenant;
  let adminBeta: User;
  let tokenBeta: string;

  let tokenNoTenant: string;

  beforeAll(async () => {
    // 1. Tenant Alpha
    tenantAlpha = await Tenant.create({
      name: 'Adversarial Alpha Corp',
      slug: `adv-alpha-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'ENTERPRISE'
    });

    adminAlpha = await User.create({
      tenant_id: tenantAlpha.id,
      email: `alpha-admin-${Date.now()}@alpha.local`,
      password_hash: '$2a$10$w8T0M0tI.fO3W2aB3wO0xOqvJ60M6O5n7YqM8I8z3F0iB5o8l9V3W',
      first_name: 'Alpha',
      last_name: 'Admin',
      role_id: 6, // COMPANY_ADMIN
      is_active: true
    });

    await Subscription.create({
      tenant_id: tenantAlpha.id,
      plan_tier: 'ENTERPRISE',
      status: 'ACTIVE',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false
    });

    tokenAlpha = generateAccessToken({
      id: adminAlpha.id,
      email: adminAlpha.email,
      role_id: 6,
      role_name: 'COMPANY_ADMIN',
      tenant_id: tenantAlpha.id
    });

    // 2. Tenant Beta
    tenantBeta = await Tenant.create({
      name: 'Adversarial Beta Ltd',
      slug: `adv-beta-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'ENTERPRISE'
    });

    adminBeta = await User.create({
      tenant_id: tenantBeta.id,
      email: `beta-admin-${Date.now()}@beta.local`,
      password_hash: '$2a$10$w8T0M0tI.fO3W2aB3wO0xOqvJ60M6O5n7YqM8I8z3F0iB5o8l9V3W',
      first_name: 'Beta',
      last_name: 'Admin',
      role_id: 6, // COMPANY_ADMIN
      is_active: true
    });

    await Subscription.create({
      tenant_id: tenantBeta.id,
      plan_tier: 'ENTERPRISE',
      status: 'ACTIVE',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false
    });

    tokenBeta = generateAccessToken({
      id: adminBeta.id,
      email: adminBeta.email,
      role_id: 6,
      role_name: 'COMPANY_ADMIN',
      tenant_id: tenantBeta.id
    });

    // 3. Token with null tenant (orphaned / unassigned user)
    tokenNoTenant = generateAccessToken({
      id: '00000000-0000-0000-0000-000000000999',
      email: 'orphaned@nowhere.local',
      role_id: 6,
      role_name: 'COMPANY_ADMIN',
      tenant_id: undefined as any
    });
  });

  // ====================================================================
  // 1. Tenant-Isolation Adversarial Tests
  // ====================================================================
  describe('1. Tenant Boundary & Conflict Rejection', () => {
    it('rejects request when X-Tenant-ID header contradicts token tenant_id', async () => {
      const res = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .set('X-Tenant-ID', tenantBeta.id);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Inconsistent tenant context');
    });

    it('rejects authenticated token with missing tenant context (no silent fallback to default tenant)', async () => {
      const res = await request(app)
        .get('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${tokenNoTenant}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Tenant context required');
    });

    it('prevents Tenant Beta from reading or modifying Tenant Alpha projects', async () => {
      // 1. Alpha creates a project
      const createRes = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          name: 'Alpha Secret Mission',
          code: `PRJ-ALP-${Date.now().toString().slice(-4)}`,
          department_code: 'DEPT-ENG',
          allocated_budget: 200000,
          estimated_hours: 100,
          milestones_total: 5
        });

      expect(createRes.status).toBe(201);
      const alphaProjectId = createRes.body.data.id;

      // 2. Beta attempts to mutate Alpha project progress
      const mutateRes = await request(app)
        .put(`/api/v1/projects/${alphaProjectId}/progress`)
        .set('Authorization', `Bearer ${tokenBeta}`)
        .send({
          advance_milestones: 1,
          additional_hours: 10
        });

      expect([403, 404]).toContain(mutateRes.status);
    });

    it('ensures audit log queries return strictly own-tenant records with zero cross-tenant contamination', async () => {
      const alphaRes = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${tokenAlpha}`);

      expect(alphaRes.status).toBe(200);
      const betaDataInAlpha = alphaRes.body.data.some((log: any) => log.tenant_id === tenantBeta.id);
      expect(betaDataInAlpha).toBe(false);
    });
  });

  // ====================================================================
  // 2. Accounting Verification: 3-Stage Procurement & Settlement
  // ====================================================================
  describe('2. Accounting Correctness: 3-Way Match & Payment Settlement', () => {
    let testItem: InventoryItem;
    let testSupplier: Supplier;
    let prId: string;
    let poId: string;
    let grnId: string;
    let invoiceId: string;
    const itemCost = 15000.00;

    beforeAll(async () => {
      // Create isolated item in Tenant Alpha
      testItem = await InventoryItem.create({
        tenant_id: tenantAlpha.id,
        sku_code: `SKU-ACC-${Date.now().toString().slice(-6)}`,
        name: 'Aerospace Grade Titanium Bar',
        category: 'RAW_MATERIALS',
        unit_of_measure: 'KG',
        unit_price: 1500.00,
        stock_qty: 10,
        safety_stock: 5
      });

      // Register Supplier in Tenant Alpha
      const supRes = await request(app)
        .post('/api/v1/procurement/suppliers')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          code: `SUP-ACC-${Date.now().toString().slice(-4)}`,
          name: 'Precision Alloy Suppliers Ltd',
          email: 'accounting@precisionalloys.local',
          phone: '+91 9876543210'
        });

      expect(supRes.status).toBe(201);
      testSupplier = supRes.body.data;
    });

    it('Stage 1 (GRN): Debits 1510 - Inventory, Credits 2015 - GR/IR Clearing Suspense', async () => {
      // 1. Create PR for 10 units @ 1500 = 15,000
      const prRes = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          item_id: testItem.id,
          quantity: 10,
          justification: 'Production stock batch'
        });

      expect(prRes.status).toBe(201);
      prId = prRes.body.data.id;

      // 2. Manager approval
      await request(app)
        .post(`/api/v1/procurement/requests/${prId}/manager-approval`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({ action: 'APPROVE' });

      // 3. Finance approval
      await request(app)
        .post(`/api/v1/procurement/requests/${prId}/finance-approval`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({ action: 'APPROVE' });

      // 4. Select supplier & generate PO
      const poRes = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/select-supplier`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({ supplier_id: testSupplier.id });

      expect(poRes.status).toBe(200);
      poId = poRes.body.data.po.id;

      // 5. Receive Goods (GRN)
      const grnRes = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/receive-goods`)
        .set('Authorization', `Bearer ${tokenAlpha}`);

      expect(grnRes.status).toBe(200);
      grnId = grnRes.body.data.grn.id;

      // Assert Stage 1 General Ledger Postings
      const grnLedgers = await LedgerEntry.findAll({
        where: { reference_id: grnId, tenant_id: tenantAlpha.id }
      });

      expect(grnLedgers.length).toBe(2);
      const debitRow = grnLedgers.find((r) => Number(r.debit_amount) > 0);
      const creditRow = grnLedgers.find((r) => Number(r.credit_amount) > 0);

      expect(debitRow?.account_code).toBe('1510 - Raw Material Inventory');
      expect(Number(debitRow?.debit_amount)).toBe(itemCost);

      expect(creditRow?.account_code).toBe('2015 - GR/IR Clearing Suspense');
      expect(Number(creditRow?.credit_amount)).toBe(itemCost);
    });

    it('Stage 2 (Invoice Recognition): Debits 2015 - GR/IR Clearing, Credits 2010 - Accounts Payable', async () => {
      const matchRes = await request(app)
        .post('/api/v1/procurement/invoices/match')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          invoice_number: `INV-VERIFY-${Date.now()}`,
          po_id: poId,
          grn_id: grnId,
          billed_quantity: 10,
          invoice_amount: itemCost
        });

      expect(matchRes.status).toBe(200);
      expect(matchRes.body.match_status).toBe('MATCHED');
      invoiceId = matchRes.body.data.id;

      // Assert Stage 2 General Ledger Postings
      const invLedgers = await LedgerEntry.findAll({
        where: { reference_id: invoiceId, reference_type: 'INVOICE_RECOGNITION', tenant_id: tenantAlpha.id }
      });

      expect(invLedgers.length).toBe(2);
      const debitRow = invLedgers.find((r) => Number(r.debit_amount) > 0);
      const creditRow = invLedgers.find((r) => Number(r.credit_amount) > 0);

      expect(debitRow?.account_code).toBe('2015 - GR/IR Clearing Suspense');
      expect(Number(debitRow?.debit_amount)).toBe(itemCost);

      expect(creditRow?.account_code).toBe('2010 - Accounts Payable');
      expect(Number(creditRow?.credit_amount)).toBe(itemCost);

      // Verify GR/IR Clearing Suspense Reconciles to Net ZERO
      const allGrIrEntries = await LedgerEntry.findAll({
        where: { account_code: '2015 - GR/IR Clearing Suspense', tenant_id: tenantAlpha.id }
      });
      const totalGrIrDebits = allGrIrEntries.reduce((sum, e) => sum + Number(e.debit_amount), 0);
      const totalGrIrCredits = allGrIrEntries.reduce((sum, e) => sum + Number(e.credit_amount), 0);
      expect(totalGrIrDebits).toBe(totalGrIrCredits);
    });

    it('Stage 3 (Payment Settlement): Debits 2010 - Accounts Payable, Credits 1010 - Operating Cash', async () => {
      const payRes = await request(app)
        .post(`/api/v1/procurement/invoices/${invoiceId}/pay`)
        .set('Authorization', `Bearer ${tokenAlpha}`);

      expect(payRes.status).toBe(200);
      expect(payRes.body.success).toBe(true);
      expect(payRes.body.data.status).toBe('PAID');

      // Assert Stage 3 General Ledger Postings
      const payLedgers = await LedgerEntry.findAll({
        where: { reference_id: invoiceId, reference_type: 'PAYMENT_SETTLEMENT', tenant_id: tenantAlpha.id }
      });

      expect(payLedgers.length).toBe(2);
      const debitRow = payLedgers.find((r) => Number(r.debit_amount) > 0);
      const creditRow = payLedgers.find((r) => Number(r.credit_amount) > 0);

      expect(debitRow?.account_code).toBe('2010 - Accounts Payable');
      expect(Number(debitRow?.debit_amount)).toBe(itemCost);

      expect(creditRow?.account_code).toBe('1010 - Operating Cash');
      expect(Number(creditRow?.credit_amount)).toBe(itemCost);

      // Verify Accounts Payable Reconciles to Net ZERO for this PO
      const allApEntries = await LedgerEntry.findAll({
        where: { account_code: '2010 - Accounts Payable', reference_id: invoiceId, tenant_id: tenantAlpha.id }
      });
      const totalApDebits = allApEntries.reduce((sum, e) => sum + Number(e.debit_amount), 0);
      const totalApCredits = allApEntries.reduce((sum, e) => sum + Number(e.credit_amount), 0);
      expect(totalApDebits).toBe(totalApCredits);
    });

    it('Stage 4 (Idempotency): Blocks duplicate settlement attempt with HTTP 409', async () => {
      const dupRes = await request(app)
        .post(`/api/v1/procurement/invoices/${invoiceId}/pay`)
        .set('Authorization', `Bearer ${tokenAlpha}`);

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error).toContain('already been settled');
    });

    it('Stage 5 (Cross-Tenant Settlement Attack): Blocks Tenant Beta from paying Tenant Alpha invoice', async () => {
      const attackRes = await request(app)
        .post(`/api/v1/procurement/invoices/${invoiceId}/pay`)
        .set('Authorization', `Bearer ${tokenBeta}`);

      expect([403, 404]).toContain(attackRes.status);
    });
  });
});
