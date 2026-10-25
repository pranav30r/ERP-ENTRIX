import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { Tenant, User, InventoryItem, PurchaseRequest, Employee, Project, LedgerEntry } from '../src/models';
import jwt from 'jsonwebtoken';
import { ENV } from '../src/config/env';

describe('Cross-Tenant Data Isolation & Security Verification (2 Tenants)', () => {
  let tenantAToken: string;
  let tenantBToken: string;
  let tenantAId: string;
  let tenantBId: string;
  let tenantASkuId: string;
  let tenantBSkuId: string;
  let tenantAPrId: string;
  let tenantBPrId: string;
  let tenantAEmpId: string;
  let tenantAProjId: string;
  let tokenNoTenant: string;

  beforeAll(async () => {
    await sequelize.authenticate();

    // 1. Onboard Tenant A (Solaris Power Systems)
    const onboardARes = await request(app)
      .post('/api/v1/tenants/onboard')
      .send({
        company_name: 'Solaris Power Systems',
        slug: `solaris-power-${Date.now()}`,
        admin_email: `admin-solaris-${Date.now()}@solaris.local`,
        admin_password: 'Password@123',
        admin_first_name: 'Siddharth',
        admin_last_name: 'Solaris'
      });
    expect(onboardARes.status).toBe(201);
    tenantAToken = onboardARes.body.access_token;
    tenantAId = onboardARes.body.tenant.id;

    // 2. Onboard Tenant B (Quantum Dynamics Ltd)
    const onboardBRes = await request(app)
      .post('/api/v1/tenants/onboard')
      .send({
        company_name: 'Quantum Dynamics Ltd',
        slug: `quantum-dyn-${Date.now()}`,
        admin_email: `admin-quantum-${Date.now()}@quantum.local`,
        admin_password: 'Password@123',
        admin_first_name: 'Kavita',
        admin_last_name: 'Quantum'
      });
    expect(onboardBRes.status).toBe(201);
    tenantBToken = onboardBRes.body.access_token;
    tenantBId = onboardBRes.body.tenant.id;

    // 3. Create Token with NULL tenant_id (Un-scoped user)
    tokenNoTenant = jwt.sign(
      {
        id: '99999999-9999-9999-9999-999999999999',
        email: 'unscoped@entrix.local',
        role_id: 1,
        role_name: 'SUPER_ADMIN',
        tenant_id: null
      },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 4. Create Inventory in Tenant A & Tenant B
    const itemARes = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        sku_code: `SOL-PANEL-${Date.now()}`,
        name: 'Solaris 400W Monocrystalline PV Panel',
        category: 'Solar',
        unit_price: 8500.00,
        stock_qty: 40
      });
    expect(itemARes.status).toBe(201);
    tenantASkuId = itemARes.body.data.id;

    const itemBRes = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({
        sku_code: `QNT-LASER-${Date.now()}`,
        name: 'Quantum Nd:YAG Laser Diode Module',
        category: 'Optics',
        unit_price: 24000.00,
        stock_qty: 15
      });
    expect(itemBRes.status).toBe(201);
    tenantBSkuId = itemBRes.body.data.id;

    // 5. Create Purchase Request in Tenant A & Tenant B
    const prARes = await request(app)
      .post('/api/v1/procurement/requests')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        item_id: tenantASkuId,
        quantity: 5,
        justification: 'Solar panel stock replenishment'
      });
    expect(prARes.status).toBe(201);
    tenantAPrId = prARes.body.data.id;

    const prBRes = await request(app)
      .post('/api/v1/procurement/requests')
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({
        item_id: tenantBSkuId,
        quantity: 2,
        justification: 'Laser component purchase'
      });
    expect(prBRes.status).toBe(201);
    tenantBPrId = prBRes.body.data.id;

    // 6. Create HR Employee in Tenant A
    const empARes = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        email: `engineer-${Date.now()}@solaris.local`,
        password: 'Password@123',
        first_name: 'Aarav',
        last_name: 'Sharma',
        role_id: 3,
        employee_code: `EMP-SOL-${Date.now().toString().slice(-4)}`,
        designation: 'Solar Photovoltaic Engineer',
        base_salary: 85000,
        annual_leave_balance: 24
      });
    expect(empARes.status).toBe(201);
    tenantAEmpId = empARes.body.data.id;

    // 7. Create Project in Tenant A
    const projARes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        name: 'Solar Grid Microinverter R&D',
        code: `PRJ-SOL-${Date.now().toString().slice(-4)}`,
        allocated_budget: 450000,
        estimated_hours: 320,
        milestones_total: 8
      });
    expect(projARes.status).toBe(201);
    tenantAProjId = projARes.body.data.id;
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  describe('1. Inventory Isolation Across Tenants', () => {
    it('Tenant B cannot see Tenant A inventory items', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${tenantBToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data;
      expect(items.some((i: any) => i.id === tenantBSkuId)).toBe(true);
      expect(items.some((i: any) => i.id === tenantASkuId)).toBe(false);
    });

    it('Tenant B cannot mutate Tenant A inventory stock (returns 403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/${tenantASkuId}/adjust`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({ quantity: 10, type: 'IN', reason: 'Cross-tenant illegal deduction' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cannot mutate inventory belonging to another tenant');

      const itemA = await InventoryItem.findByPk(tenantASkuId);
      expect(itemA?.stock_qty).toBe(40);
    });
  });

  describe('2. Procurement Workflow Isolation', () => {
    it('Tenant B cannot see Tenant A purchase requests', async () => {
      const res = await request(app)
        .get('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${tenantBToken}`);

      expect(res.status).toBe(200);
      const prs = res.body.data;
      expect(prs.some((p: any) => p.id === tenantBPrId)).toBe(true);
      expect(prs.some((p: any) => p.id === tenantAPrId)).toBe(false);
    });

    it('Tenant B cannot approve Tenant A purchase requests (returns 403)', async () => {
      const res = await request(app)
        .post(`/api/v1/procurement/requests/${tenantAPrId}/manager-approval`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({ action: 'APPROVE', comments: 'Cross-tenant approval hijack' });

      expect(res.status).toBe(403);
      const prA = await PurchaseRequest.findByPk(tenantAPrId);
      expect(prA?.status).toBe('PENDING_MANAGER');
    });
  });

  describe('3. Finance & General Ledger Isolation', () => {
    it('Tenant A posts a journal entry; Tenant B ledger does NOT show Tenant A entry', async () => {
      const postRes = await request(app)
        .post('/api/v1/finance/journal')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          reference_type: 'SOLAR_RAW_MATERIAL',
          entries: [
            { account_code: '1510 - Raw Material Inventory', debit_amount: 50000, credit_amount: 0 },
            { account_code: '1010 - Operating Cash', debit_amount: 0, credit_amount: 50000 }
          ]
        });
      expect(postRes.status).toBe(201);
      const txUuid = postRes.body.data.transaction_uuid;

      // Tenant B reads ledger
      const ledgerBRes = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${tenantBToken}`);

      expect(ledgerBRes.status).toBe(200);
      const entriesB = ledgerBRes.body.data;
      expect(entriesB.some((e: any) => e.transaction_uuid === txUuid)).toBe(false);

      // Verify DB record belongs strictly to tenantAId
      const entriesDb = await LedgerEntry.findAll({ where: { transaction_uuid: txUuid } });
      expect(entriesDb.length).toBe(2);
      expect(entriesDb.every(e => e.tenant_id === tenantAId)).toBe(true);
    });
  });

  describe('4. HR & Employee Isolation', () => {
    it('Tenant B cannot list Tenant A employees in GET /hr/employees', async () => {
      const res = await request(app)
        .get('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${tenantBToken}`);

      expect(res.status).toBe(200);
      const employees = res.body.data;
      expect(employees.some((e: any) => e.id === tenantAEmpId)).toBe(false);
    });

    it('Tenant B cannot update Tenant A employee (returns 404/403)', async () => {
      const res = await request(app)
        .put(`/api/v1/hr/employees/${tenantAEmpId}`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({ designation: 'Compromised Title', base_salary: 200000 });

      expect([403, 404]).toContain(res.status);
      const empA = await Employee.findByPk(tenantAEmpId);
      expect(empA?.designation).toBe('Solar Photovoltaic Engineer');
    });
  });

  describe('5. Projects & Tasks Isolation', () => {
    it('Tenant B cannot view Tenant A projects in GET /projects', async () => {
      const res = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${tenantBToken}`);

      expect(res.status).toBe(200);
      const projects = res.body.data;
      expect(projects.some((p: any) => p.id === tenantAProjId)).toBe(false);
    });

    it('Tenant B cannot add tasks to Tenant A project (returns 403)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${tenantAProjId}/tasks`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({ title: 'Malicious Task Injection', estimated_hours: 10 });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cannot add tasks to another tenant');
    });

    it('Tenant B cannot advance milestones on Tenant A project (returns 403)', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${tenantAProjId}/progress`)
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({ advance_milestones: 2 });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cannot mutate project belonging to another organization');
    });
  });

  describe('6. Company Data Export Isolation', () => {
    it('Tenant A company export contains only Tenant A records and zero Tenant B records', async () => {
      const res = await request(app)
        .get('/api/v1/company/export')
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metadata.tenantId).toBe(tenantAId);

      const items = res.body.data.inventory;
      expect(items.some((i: any) => i.id === tenantASkuId)).toBe(true);
      expect(items.some((i: any) => i.id === tenantBSkuId)).toBe(false);

      const prs = res.body.data.procurementRequests;
      expect(prs.some((p: any) => p.id === tenantAPrId)).toBe(true);
      expect(prs.some((p: any) => p.id === tenantBPrId)).toBe(false);
    });
  });

  describe('7. Un-Scoped Token Rejection (No Default Tenant Fallback)', () => {
    it('Un-scoped token with null tenant_id is rejected on /inventory (403)', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${tokenNoTenant}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Tenant context required');
    });

    it('Un-scoped token with null tenant_id is rejected on /finance/ledger (403)', async () => {
      const res = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${tokenNoTenant}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Tenant context required');
    });

    it('Un-scoped token with null tenant_id is rejected on /hr/employees (403)', async () => {
      const res = await request(app)
        .get('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${tokenNoTenant}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Tenant context required');
    });
  });
});
