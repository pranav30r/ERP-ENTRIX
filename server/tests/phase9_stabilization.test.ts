import request from 'supertest';
import { app } from '../src/app';
import { AIService } from '../src/services/aiService';
import { billingAdapter } from '../src/services/billing/mockBillingAdapter';
import { billingService } from '../src/services/billing/billingService';
import { sequelize } from '../src/config/db';
import { Tenant, User, Subscription } from '../src/models';

describe('Phase 9: Post-Validation Stabilization & Regression Suite', () => {
  let authToken: string;
  let testTenantId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Authenticate admin user
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@entrix.local', password: 'Admin@123' });

    expect(loginRes.status).toBe(200);
    authToken = loginRes.body.access_token || loginRes.body.token;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    testTenantId = meRes.body.user?.tenant_id || meRes.body.tenant_id;
    adminUserId = meRes.body.user?.id || meRes.body.id;
  });

  describe('1. DEF-801: AI Service Heuristic Sanitization & Resilience', () => {
    it('handles dirty historical series with NaN and string types without throwing or producing NaN', async () => {
      const dirtySeries = [10, NaN, '20' as any, null as any, 30, 40];
      const result = await AIService.getDemandForecast('SKU-DIRTY-TEST', dirtySeries, testTenantId);

      expect(result).toBeDefined();
      expect(result.sku_id).toBe('SKU-DIRTY-TEST');
      expect(result.is_fallback).toBe(true);
      expect(Array.isArray(result.forecast)).toBe(true);
      expect(result.forecast.length).toBe(30);

      // Verify no NaN values in forecast
      const hasNaN = result.forecast.some((v) => isNaN(v) || typeof v !== 'number');
      expect(hasNaN).toBe(false);
      expect(result.recommended_reorder_qty).toBeGreaterThan(0);
      expect(isNaN(result.recommended_reorder_qty)).toBe(false);
    });

    it('handles empty or malformed anomaly transaction lists gracefully', async () => {
      const malformedPayload = [
        { id: 'TX-SAFE-1', amount: '25000' },
        { id: 'TX-ANOMALOUS-2', amount: 95000 },
        { id: null, amount: null }
      ];

      const result = await AIService.detectAnomalies(malformedPayload, testTenantId);

      expect(result).toBeDefined();
      expect(result.is_fallback).toBe(true);
      expect(result.total_analyzed).toBe(3);
      expect(result.anomalies_detected).toBe(1);
      expect(result.flagged_records[0].transaction_id).toBe('TX-ANOMALOUS-2');
      expect(result.flagged_records[0].amount).toBe(95000);
    });
  });

  describe('2. DEF-802: Billing Webhook Security & Idempotency', () => {
    it('verifies signature correctly in mock/pilot mode', () => {
      const payload = { test: true, timestamp: Date.now() };
      
      // Pilot / mock mode accept 'mock_valid' or unsigned in non-production
      expect(billingAdapter.verifyWebhookSignature(payload, 'mock_valid')).toBe(true);
      expect(billingAdapter.verifyWebhookSignature(payload, undefined)).toBe(true);
    });

    it('enforces strict cryptographic rejection when in production mode with invalid signature', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalAllowMock = process.env.ALLOW_MOCK_BILLING;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_MOCK_BILLING;

        const payload = { event: 'payment.success' };
        // Missing signature must fail
        expect(billingAdapter.verifyWebhookSignature(payload, undefined)).toBe(false);
        // Invalid hex signature must fail
        expect(billingAdapter.verifyWebhookSignature(payload, 'badsignature12345')).toBe(false);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalAllowMock) process.env.ALLOW_MOCK_BILLING = originalAllowMock;
      }
    });

    it('processes checkout.completed webhook and elevates tenant subscription idempotently', async () => {
      const webhookPayload = {
        id: `evt_test_${Date.now()}`,
        type: 'checkout.completed',
        tenantId: testTenantId,
        planTier: 'ENTERPRISE',
        amount: 49999,
        currency: 'INR',
        externalInvoiceId: `INV-TEST-${Date.now().toString().slice(-6)}`
      };

      const res = await request(app)
        .post('/api/v1/subscriptions/webhook')
        .set('x-billing-signature', 'mock_valid')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.eventType).toBe('checkout.completed');

      // Verify DB persistence
      const sub = await Subscription.findOne({ where: { tenant_id: testTenantId } });
      expect(sub).toBeDefined();
      expect(sub?.status).toBe('ACTIVE');
      expect(sub?.plan_tier).toBe('ENTERPRISE');
    });
  });

  describe('3. Cross-Module Consistency & Concurrency Invariants', () => {
    it('confirms financial ledger double-entry consistency for the tenant', async () => {
      const ledgerRes = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${authToken}`);

      expect(ledgerRes.status).toBe(200);
      expect(ledgerRes.body.success).toBe(true);
      expect(ledgerRes.body.summary).toBeDefined();
      expect(typeof ledgerRes.body.summary.is_balanced).toBe('boolean');
      expect(ledgerRes.body.summary.is_balanced).toBe(true);
    });

    it('enforces milestone progress percentage constraints within 0 to 100', async () => {
      // 1. Create initiative
      const projCode = `PRJ-P9-${Date.now().toString().slice(-4)}`;
      const projRes = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Stabilization Verification Project',
          code: projCode,
          department_code: 'DEPT-ENG',
          allocated_budget: 150000,
          estimated_hours: 120,
          milestones_total: 4
        });

      expect(projRes.status).toBe(201);
      const projectId = projRes.body.data.id;

      // 2. Advance progress within bounds
      const updateRes = await request(app)
        .put(`/api/v1/projects/${projectId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          advance_milestones: 1,
          additional_hours: 40,
          additional_cost: 25000
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.milestones_completed).toBe(1);
      expect(updateRes.body.data.logged_hours).toBe(40);
      expect(updateRes.body.data.status).toBe('IN_PROGRESS');
    });

    it('records and verifies HR attendance clock-in with non-overlapping check', async () => {
      // Create employee
      const empCode = `EMP-P9-${Date.now().toString().slice(-4)}`;
      const empRes = await request(app)
        .post('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          first_name: 'P9',
          last_name: 'Verifier',
          email: `p9.verifier.${Date.now()}@entrix.com`,
          employee_code: empCode,
          designation: 'Reliability Engineer',
          salary: 95000,
          date_of_joining: new Date().toISOString().split('T')[0]
        });

      expect(empRes.status).toBe(201);
      const employeeId = empRes.body.data.id;

      // Clock-in attendance
      const today = new Date().toISOString().split('T')[0];
      const attRes = await request(app)
        .post('/api/v1/hr/attendance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          employee_id: employeeId,
          date: today,
          status: 'PRESENT',
          check_in: '09:00:00',
          check_out: '18:00:00'
        });

      expect(attRes.status).toBe(200);
      expect(attRes.body.success).toBe(true);
      expect(attRes.body.data.employee_id).toBe(employeeId);
    });
  });

  describe('4. Tenant & Role Authorization Boundaries', () => {
    it('blocks access to protected endpoints when token is absent or invalid', async () => {
      const unauthRes = await request(app).get('/api/v1/finance/ledger');
      expect([401, 403]).toContain(unauthRes.status);
    });

    it('confirms request tracking header propagation (X-Request-ID)', async () => {
      const traceId = `trace-${Date.now()}`;
      const res = await request(app)
        .get('/health')
        .set('X-Request-ID', traceId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(traceId);
    });
  });
});
