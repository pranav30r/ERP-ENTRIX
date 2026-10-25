import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { Tenant, User, InventoryItem, PurchaseRequest, Role } from '../src/models';

describe('Phase 2: Multi-Tenant Architecture & Cross-Tenant Isolation Verification', () => {
  let tenantAToken: string;
  let tenantBToken: string;
  let tenantAId: string;
  let tenantBId: string;
  let tenantASkuId: string;
  let tenantBSkuId: string;
  let tenantAPrId: string;
  let tenantBPrId: string;

  beforeAll(async () => {
    await sequelize.authenticate();

    // 1. Onboard Tenant A (Alpha Dynamics Corp)
    const onboardARes = await request(app)
      .post('/api/v1/tenants/onboard')
      .send({
        company_name: 'Alpha Dynamics Corp',
        slug: `alpha-corp-${Date.now()}`,
        admin_email: `admin-alpha-${Date.now()}@alpha.local`,
        admin_password: 'Password@123',
        admin_first_name: 'Alice',
        admin_last_name: 'Alpha'
      });

    expect(onboardARes.status).toBe(201);
    tenantAToken = onboardARes.body.access_token;
    tenantAId = onboardARes.body.tenant.id;

    // 2. Onboard Tenant B (Beta Logistics Ltd)
    const onboardBRes = await request(app)
      .post('/api/v1/tenants/onboard')
      .send({
        company_name: 'Beta Logistics Ltd',
        slug: `beta-logistics-${Date.now()}`,
        admin_email: `admin-beta-${Date.now()}@beta.local`,
        admin_password: 'Password@123',
        admin_first_name: 'Bob',
        admin_last_name: 'Beta'
      });

    expect(onboardBRes.status).toBe(201);
    tenantBToken = onboardBRes.body.access_token;
    tenantBId = onboardBRes.body.tenant.id;

    // 3. Create items in Tenant A and Tenant B
    const itemARes = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        sku_code: 'ALPH-TITAN-001',
        name: 'Alpha Titanium Alloy Plate',
        category: 'Metals',
        unit_price: 340.00,
        stock_qty: 100
      });
    expect(itemARes.status).toBe(201);
    tenantASkuId = itemARes.body.data.id;

    const itemBRes = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({
        sku_code: 'BETA-CARBN-001',
        name: 'Beta Carbon Fiber Sheet',
        category: 'Composites',
        unit_price: 520.00,
        stock_qty: 50
      });
    expect(itemBRes.status).toBe(201);
    tenantBSkuId = itemBRes.body.data.id;

    // 4. Create PR in Tenant A and Tenant B
    const prARes = await request(app)
      .post('/api/v1/procurement/requests')
      .set('Authorization', `Bearer ${tenantAToken}`)
      .send({
        item_id: tenantASkuId,
        quantity: 10,
        justification: 'Alpha production replenishment'
      });
    expect(prARes.status).toBe(201);
    tenantAPrId = prARes.body.data.id;

    const prBRes = await request(app)
      .post('/api/v1/procurement/requests')
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({
        item_id: tenantBSkuId,
        quantity: 5,
        justification: 'Beta project materials'
      });
    expect(prBRes.status).toBe(201);
    tenantBPrId = prBRes.body.data.id;
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  // ====================================================================
  // 1. DATA ACCESS ISOLATION
  // ====================================================================
  describe('Cross-Tenant Data Access Isolation', () => {
    it('Tenant A cannot list Tenant B inventory records in GET /inventory', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const items = res.body.data;
      const hasTenantAItem = items.some((i: any) => i.id === tenantASkuId);
      const hasTenantBItem = items.some((i: any) => i.id === tenantBSkuId);

      expect(hasTenantAItem).toBe(true);
      expect(hasTenantBItem).toBe(false); // Tenant B's item MUST NOT appear
    });

    it('Tenant B cannot list Tenant A purchase requests in GET /procurement/requests', async () => {
      const res = await request(app)
        .get('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${tenantBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const prs = res.body.data;
      const hasTenantBPR = prs.some((p: any) => p.id === tenantBPrId);
      const hasTenantAPR = prs.some((p: any) => p.id === tenantAPrId);

      expect(hasTenantBPR).toBe(true);
      expect(hasTenantAPR).toBe(false); // Tenant A's PR MUST NOT appear
    });

    it('Tenant A cannot mutate Tenant B stock via PATCH /inventory/:id/adjust (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/${tenantBSkuId}/adjust`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          quantity: 20,
          type: 'IN',
          reason: 'Malicious cross-tenant mutation attempt'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Cannot mutate inventory belonging to another tenant');

      // Verify Tenant B stock is completely unchanged
      const itemB = await InventoryItem.findByPk(tenantBSkuId);
      expect(itemB?.stock_qty).toBe(50);
    });

    it('Tenant A cannot approve Tenant B purchase request via /manager-approval (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/procurement/requests/${tenantBPrId}/manager-approval`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          action: 'APPROVE',
          comments: 'Cross-tenant unauthorized approval'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Cannot approve requisitions belonging to another company');

      // Verify Tenant B PR status remained PENDING_MANAGER
      const prB = await PurchaseRequest.findByPk(tenantBPrId);
      expect(prB?.status).toBe('PENDING_MANAGER');
    });

    it('Submitting a spoofed tenant_id in request body does NOT bypass server-side tenant scoping', async () => {
      // Tenant A tries to create a PR claiming it belongs to Tenant B
      const res = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          tenant_id: tenantBId, // Spoofed field
          item_id: tenantASkuId,
          quantity: 2,
          justification: 'Payload spoofing test'
        });

      expect(res.status).toBe(201);
      // The server must override the spoofed tenant_id with the verified authenticated tenant_id
      expect(res.body.data.tenant_id).toBe(tenantAId);
      expect(res.body.data.tenant_id).not.toBe(tenantBId);
    });
  });

  // ====================================================================
  // 2. INVITATIONS & PRIVILEGE ESCALATION PREVENTION
  // ====================================================================
  describe('Invitations & Privilege Escalation Prevention', () => {
    it('Company Admin cannot invite a PLATFORM_ADMIN (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/tenants/invite')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          email: 'attempted-platform-admin@alpha.local',
          role_name: 'PLATFORM_ADMIN'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Cannot invite platform administrators');
    });

    it('Generates a single-use invitation token and accepts it cleanly', async () => {
      const inviteeEmail = `engineer-${Date.now()}@alpha.local`;
      const inviteRes = await request(app)
        .post('/api/v1/tenants/invite')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          email: inviteeEmail,
          role_name: 'STAFF_USER'
        });

      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.invitation_token).toBeDefined();

      const rawToken = inviteRes.body.invitation_token;

      // Accept invitation
      const acceptRes = await request(app)
        .post('/api/v1/tenants/accept-invite')
        .send({
          token: rawToken,
          password: 'Password@123',
          first_name: 'Eva',
          last_name: 'Engineer'
        });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);

      // Verify user was created with Tenant A's tenant_id
      const newUser = await User.findOne({ where: { email: inviteeEmail } });
      expect(newUser).toBeDefined();
      expect(newUser?.tenant_id).toBe(tenantAId);

      // Re-using the same invitation token MUST fail
      const reuseRes = await request(app)
        .post('/api/v1/tenants/accept-invite')
        .send({
          token: rawToken,
          password: 'Password@123',
          first_name: 'Attacker',
          last_name: 'Copy'
        });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error).toContain('Invitation has already been used');
    });
  });

  // ====================================================================
  // 3. SUSPENDED TENANT ACCESS BLOCKING
  // ====================================================================
  describe('Tenant Lifecycle & Suspension Enforcement', () => {
    it('Suspended tenant accounts are rejected across all protected operations (403 Forbidden)', async () => {
      // 1. Suspend Tenant B
      await Tenant.update({ status: 'SUSPENDED' }, { where: { id: tenantBId } });

      // 2. Tenant B attempts to access inventory
      const invRes = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${tenantBToken}`);

      expect(invRes.status).toBe(403);
      expect(invRes.body.error).toContain('Company tenant account is suspended');

      // 3. Tenant B attempts to submit a PR
      const prRes = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${tenantBToken}`)
        .send({ item_id: tenantBSkuId, quantity: 1, justification: 'Should fail' });

      expect(prRes.status).toBe(403);
      expect(prRes.body.error).toContain('Company tenant account is suspended');

      // 4. Restore Tenant B status for test cleanliness
      await Tenant.update({ status: 'ACTIVE' }, { where: { id: tenantBId } });
    });
  });

  // ====================================================================
  // 4. CRYPTOGRAPHIC AUDIT LOG TENANT ISOLATION
  // ====================================================================
  describe('Cryptographic Audit Trail Tenant Isolation', () => {
    it('Tenant A only inspects their own audit trail records, not Tenant B', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const logs = res.body.data;
      logs.forEach((log: any) => {
        expect(log.tenant_id).toBe(tenantAId);
      });
    });
  });
});
