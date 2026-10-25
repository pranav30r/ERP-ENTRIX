import request from 'supertest';
import { app } from '../src/app';
import { sequelize } from '../src/config/db';
import { Tenant, User, Subscription, SubscriptionInvoice } from '../src/models';
import { generateAccessToken } from '../src/services/tokenService';

describe('Phase 6: Commercial Product SaaS & Monetization Architecture', () => {
  let freeTenant: Tenant;
  let freeAdmin: User;
  let freeAdminToken: string;

  let otherTenant: Tenant;
  let otherAdmin: User;
  let otherAdminToken: string;

  beforeAll(async () => {
    // 1. Create a Free/Developer Tier Tenant
    freeTenant = await Tenant.create({
      name: 'Free Prototyping Corp',
      slug: `free-proto-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'FREE'
    });

    freeAdmin = await User.create({
      tenant_id: freeTenant.id,
      email: `free-admin-${Date.now()}@example.com`,
      password_hash: '$2a$10$w8T0M0tI.fO3W2aB3wO0xOqvJ60M6O5n7YqM8I8z3F0iB5o8l9V3W',
      first_name: 'Free',
      last_name: 'Admin',
      role_id: 1, // ADMIN
      is_active: true
    });

    await Subscription.create({
      tenant_id: freeTenant.id,
      plan_tier: 'FREE',
      status: 'ACTIVE',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false
    });

    freeAdminToken = generateAccessToken({
      id: freeAdmin.id,
      email: freeAdmin.email,
      role_id: 1,
      role_name: 'COMPANY_ADMIN',
      tenant_id: freeTenant.id
    });

    // 2. Create another Tenant for invoice isolation tests
    otherTenant = await Tenant.create({
      name: 'Isolated Beta LLC',
      slug: `beta-iso-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'GROWTH'
    });

    otherAdmin = await User.create({
      tenant_id: otherTenant.id,
      email: `beta-admin-${Date.now()}@example.com`,
      password_hash: '$2a$10$w8T0M0tI.fO3W2aB3wO0xOqvJ60M6O5n7YqM8I8z3F0iB5o8l9V3W',
      first_name: 'Beta',
      last_name: 'Admin',
      role_id: 1,
      is_active: true
    });

    otherAdminToken = generateAccessToken({
      id: otherAdmin.id,
      email: otherAdmin.email,
      role_id: 1,
      role_name: 'COMPANY_ADMIN',
      tenant_id: otherTenant.id
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    if (freeTenant) {
      await Subscription.destroy({ where: { tenant_id: freeTenant.id } });
      await SubscriptionInvoice.destroy({ where: { tenant_id: freeTenant.id } });
      await User.destroy({ where: { tenant_id: freeTenant.id } });
      await freeTenant.destroy();
    }
    if (otherTenant) {
      await Subscription.destroy({ where: { tenant_id: otherTenant.id } });
      await SubscriptionInvoice.destroy({ where: { tenant_id: otherTenant.id } });
      await User.destroy({ where: { tenant_id: otherTenant.id } });
      await otherTenant.destroy();
    }
  });

  describe('1. Plan Catalog & Status Inquiries', () => {
    it('GET /api/v1/subscriptions/plans lists all available tiers with feature limits', async () => {
      const res = await request(app).get('/api/v1/subscriptions/plans');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.plans)).toBe(true);

      const tiers = res.body.plans.map((p: any) => p.tier);
      expect(tiers).toContain('FREE');
      expect(tiers).toContain('STARTER');
      expect(tiers).toContain('GROWTH');
      expect(tiers).toContain('ENTERPRISE');
    });

    it('GET /api/v1/subscriptions/status returns current tenant entitlement & limits', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${freeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subscription.plan_tier).toBe('FREE');
      expect(res.body.entitlement.maxUsers).toBe(3);
      expect(res.body.usage.activeUsers).toBe(1);
    });
  });

  describe('2. Entitlement Enforcement & Feature Gates', () => {
    it('Blocks Free plan from accessing FINANCE module (HTTP 403 FEATURE_NOT_ENTITLED)', async () => {
      const res = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${freeAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FEATURE_NOT_ENTITLED');
      expect(res.body.requiredModule).toBe('FINANCE');
    });

    it('Blocks Free plan from accessing HR module (HTTP 403 FEATURE_NOT_ENTITLED)', async () => {
      const res = await request(app)
        .get('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${freeAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FEATURE_NOT_ENTITLED');
      expect(res.body.requiredModule).toBe('HR');
    });
  });

  describe('3. User Seat Quota Enforcement', () => {
    it('Allows adding team members up to the plan seat limit', async () => {
      // Add member #2 (Limit is 3)
      const res2 = await request(app)
        .post('/api/v1/company/members')
        .set('Authorization', `Bearer ${freeAdminToken}`)
        .send({
          email: `free-member-2-${Date.now()}@example.com`,
          firstName: 'Member',
          lastName: 'Two',
          roleId: 2
        });
      expect(res2.status).toBe(201);

      // Add member #3 (Limit is 3)
      const res3 = await request(app)
        .post('/api/v1/company/members')
        .set('Authorization', `Bearer ${freeAdminToken}`)
        .send({
          email: `free-member-3-${Date.now()}@example.com`,
          firstName: 'Member',
          lastName: 'Three',
          roleId: 2
        });
      expect(res3.status).toBe(201);
    });

    it('Rejects adding member #4 when limit of 3 is reached (HTTP 403 USER_LIMIT_REACHED)', async () => {
      const res4 = await request(app)
        .post('/api/v1/company/members')
        .set('Authorization', `Bearer ${freeAdminToken}`)
        .send({
          email: `free-member-4-${Date.now()}@example.com`,
          firstName: 'Member',
          lastName: 'Four',
          roleId: 2
        });

      expect(res4.status).toBe(403);
      expect(res4.body.error).toBe('USER_LIMIT_REACHED');
      expect(res4.body.maxAllowed).toBe(3);
    });
  });

  describe('4. Checkout, Webhook Processing & Upgrades', () => {
    it('POST /api/v1/subscriptions/checkout generates sandbox session', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/checkout')
        .set('Authorization', `Bearer ${freeAdminToken}`)
        .send({ planTier: 'GROWTH' });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.provider).toBe('MOCK');
    });

    it('Processes webhook checkout.completed and upgrades tenant to GROWTH plan', async () => {
      const webhookPayload = {
        id: `evt_test_${Date.now()}`,
        type: 'checkout.completed',
        tenantId: freeTenant.id,
        planTier: 'GROWTH',
        amount: 14999.00,
        currency: 'INR'
      };

      const res = await request(app)
        .post('/api/v1/subscriptions/webhook')
        .set('x-billing-signature', 'mock_valid')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify DB state updated
      const sub = await Subscription.findOne({ where: { tenant_id: freeTenant.id } });
      expect(sub?.plan_tier).toBe('GROWTH');
      expect(sub?.status).toBe('ACTIVE');
    });

    it('Now permits previously locked FINANCE module after GROWTH upgrade', async () => {
      const res = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${freeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Billing Invoices & Tenant Isolation', () => {
    it('Tenant receives subscription invoice upon payment', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions/invoices')
        .set('Authorization', `Bearer ${freeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invoices.length).toBeGreaterThanOrEqual(1);
      expect(res.body.invoices[0].status).toBe('PAID');
      expect(Number(res.body.invoices[0].amount_paid)).toBe(14999.00);
    });

    it('Other tenant cannot view this tenant invoice records', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions/invoices')
        .set('Authorization', `Bearer ${otherAdminToken}`);

      expect(res.status).toBe(200);
      // Other tenant has 0 invoices
      expect(res.body.invoices.length).toBe(0);
    });
  });

  describe('6. Cancellation & Auto-Renew Management', () => {
    it('POST /api/v1/subscriptions/cancel marks auto-renew canceled', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/cancel')
        .set('Authorization', `Bearer ${freeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subscription.cancel_at_period_end).toBe(true);
    });

    it('POST /api/v1/subscriptions/resume restores auto-renew', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/resume')
        .set('Authorization', `Bearer ${freeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subscription.cancel_at_period_end).toBe(false);
    });
  });
});
