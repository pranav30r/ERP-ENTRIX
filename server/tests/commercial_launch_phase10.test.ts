import request from 'supertest';
import { app } from '../src/app';
import { sequelize } from '../src/config/db';
import { Tenant, User, Subscription, SubscriptionInvoice, SubscriptionHistory } from '../src/models';
import { generateAccessToken } from '../src/services/tokenService';

describe('Phase 10: Commercial Launch Preparation & Stabilization Verification', () => {
  let launchTenant: Tenant;
  let adminUser: User;
  let adminToken: string;
  let platformAdminToken: string;
  let regularStaffToken: string;

  beforeAll(async () => {
    // 1. Create a Pilot Launch Tenant
    launchTenant = await Tenant.create({
      name: 'Launch Pilot Enterprise',
      slug: `launch-pilot-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'STARTER'
    });

    adminUser = await User.create({
      tenant_id: launchTenant.id,
      email: `pilot-admin-${Date.now()}@launch.local`,
      password_hash: '$2a$10$w8T0M0tI.fO3W2aB3wO0xOqvJ60M6O5n7YqM8I8z3F0iB5o8l9V3W',
      first_name: 'Pilot',
      last_name: 'Admin',
      role_id: 1,
      is_active: true
    });

    await Subscription.create({
      tenant_id: launchTenant.id,
      plan_tier: 'STARTER',
      status: 'ACTIVE',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false
    });

    adminToken = generateAccessToken({
      id: adminUser.id,
      email: adminUser.email,
      role_id: 1,
      role_name: 'COMPANY_ADMIN',
      tenant_id: launchTenant.id
    });

    regularStaffToken = generateAccessToken({
      id: '00000000-0000-0000-0000-000000000099',
      email: 'staff@launch.local',
      role_id: 2,
      role_name: 'STAFF_USER',
      tenant_id: launchTenant.id
    });

    platformAdminToken = generateAccessToken({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'superadmin@entrix.local',
      role_id: 1,
      role_name: 'PLATFORM_ADMIN',
      tenant_id: null
    });
  });

  afterAll(async () => {
    if (launchTenant) {
      await Subscription.destroy({ where: { tenant_id: launchTenant.id } });
      await SubscriptionInvoice.destroy({ where: { tenant_id: launchTenant.id } });
      await SubscriptionHistory.destroy({ where: { tenant_id: launchTenant.id } });
      await User.destroy({ where: { tenant_id: launchTenant.id } });
      await launchTenant.destroy();
    }
  });

  describe('1. Billing Boundary & Webhook Idempotency Verification', () => {
    const fixedEventId = `evt_dedup_${Date.now()}`;

    it('Processes initial webhook payment event and generates exactly 1 invoice', async () => {
      const payload = {
        id: fixedEventId,
        type: 'checkout.completed',
        tenantId: launchTenant.id,
        planTier: 'GROWTH',
        amount: 14999.00,
        currency: 'INR'
      };

      const res = await request(app)
        .post('/api/v1/subscriptions/webhook')
        .set('x-billing-signature', 'mock_valid')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const invoiceCount = await SubscriptionInvoice.count({
        where: { tenant_id: launchTenant.id }
      });
      expect(invoiceCount).toBe(1);
    });

    it('Safely ignores duplicate webhook retry with same event ID (idempotency guard)', async () => {
      const payload = {
        id: fixedEventId,
        type: 'checkout.completed',
        tenantId: launchTenant.id,
        planTier: 'GROWTH',
        amount: 14999.00,
        currency: 'INR'
      };

      const res = await request(app)
        .post('/api/v1/subscriptions/webhook')
        .set('x-billing-signature', 'mock_valid')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.duplicate).toBe(true);

      // Verify invoice count did NOT increase
      const invoiceCount = await SubscriptionInvoice.count({
        where: { tenant_id: launchTenant.id }
      });
      expect(invoiceCount).toBe(1);
    });

    it('Rejects webhook with invalid or tampered signature header (HTTP 400)', async () => {
      const payload = {
        id: `evt_tampered_${Date.now()}`,
        type: 'checkout.completed',
        tenantId: launchTenant.id
      };

      const res = await request(app)
        .post('/api/v1/subscriptions/webhook')
        .set('x-billing-signature', 'bad_forged_signature_token')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid webhook signature/i);
    });
  });

  describe('2. Administrative Entitlement Overrides & Auditing', () => {
    it('Blocks regular company admin from calling platform admin plan override (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/override-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tenantId: launchTenant.id,
          planTier: 'ENTERPRISE',
          reason: 'Attempted self-upgrade'
        });

      expect(res.status).toBe(403);
    });

    it('Allows Platform Administrator to override tenant tier with mandatory audit reason', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/override-plan')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          tenantId: launchTenant.id,
          planTier: 'ENTERPRISE',
          reason: 'Pilot commercial sponsorship grant'
        });

      expect(res.status).toBe(200);
      expect(res.body.subscription.plan_tier).toBe('ENTERPRISE');

      // Check audit history entry exists
      const auditLog = await SubscriptionHistory.findOne({
        where: {
          tenant_id: launchTenant.id,
          to_plan: 'ENTERPRISE'
        }
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.reason).toMatch(/Platform Administrator Override/i);
    });
  });

  describe('3. Tenant Data Portability & Archival Export', () => {
    it('GET /api/v1/company/export dumps complete tenant JSON snapshot for company admin', async () => {
      const res = await request(app)
        .get('/api/v1/company/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization.slug).toBe(launchTenant.slug);
      expect(Array.isArray(res.body.data.teamRoster)).toBe(true);
      expect(res.body.data.subscription).toBeDefined();
    });

    it('Rejects non-admin user from requesting company data dump (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/v1/company/export')
        .set('Authorization', `Bearer ${regularStaffToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('4. Controlled Organization Closure & Deactivation', () => {
    it('Rejects closure attempt when confirmation slug does not match (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/v1/company/close-account')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirmSlug: 'wrong-random-slug' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/does not match/i);
    });

    it('Successfully closes account when slug matches, suspending tenant access', async () => {
      const res = await request(app)
        .post('/api/v1/company/close-account')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ confirmSlug: launchTenant.slug, reason: 'Commercial pilot completed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify tenant is marked SUSPENDED in DB
      const updatedTenant = await Tenant.findByPk(launchTenant.id);
      expect(updatedTenant?.status).toBe('SUSPENDED');

      // Subsequent requests with former admin token are rejected by authenticateJWT middleware
      const testReq = await request(app)
        .get('/api/v1/inventory/')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(testReq.status).toBe(403);
      expect(testReq.body.error).toMatch(/account is suspended/i);
    });
  });
});
