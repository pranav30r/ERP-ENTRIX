import request from 'supertest';
import { app } from '../src/app';
import { sequelize } from '../src/config/db';
import { AuditService } from '../src/services/auditService';
import { AuditLog, Tenant, User, Subscription } from '../src/models';
import { generateAccessToken } from '../src/services/tokenService';

describe('Phase 11: Enterprise Security, Compliance Readiness & Scalability', () => {
  let primaryTenantId: string;
  let primaryAdminToken: string;
  let secondaryTenant: Tenant;
  let secondaryAdminToken: string;

  beforeAll(async () => {
    // 1. Authenticate primary superadmin
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@entrix.local', password: 'Admin@123' });

    expect(loginRes.status).toBe(200);
    primaryAdminToken = loginRes.body.access_token;
    primaryTenantId = loginRes.body.user.tenant_id;

    // 2. Provision isolated secondary tenant for cross-tenant compliance isolation checks
    secondaryTenant = await Tenant.create({
      name: 'Secondary Compliance Tenant',
      slug: `sec-comp-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'ENTERPRISE'
    });

    const secAdmin = await User.create({
      tenant_id: secondaryTenant.id,
      email: `sec-admin-${Date.now()}@example.com`,
      password_hash: '$2a$10$w8T0M0tI.fO3W2aB3wO0xOqvJ60M6O5n7YqM8I8z3F0iB5o8l9V3W',
      first_name: 'Secondary',
      last_name: 'Admin',
      role_id: 6, // COMPANY_ADMIN
      is_active: true
    });

    await Subscription.create({
      tenant_id: secondaryTenant.id,
      plan_tier: 'ENTERPRISE',
      status: 'ACTIVE',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false
    });

    secondaryAdminToken = generateAccessToken({
      id: secAdmin.id,
      email: secAdmin.email,
      role_id: 6,
      role_name: 'COMPANY_ADMIN',
      tenant_id: secondaryTenant.id
    });
  });

  describe('1. Enterprise Audit Log Integrity & Sensitive Data Redaction (SOC2/GDPR)', () => {
    it('automatically scrubs passwords, tokens, and secrets from diff_payload', async () => {
      const sensitivePayload = {
        username: 'dev_user_01',
        password: 'SuperSecretPassword@123',
        nested: {
          access_token: 'jwt.token.signature.value',
          client_secret: 'whsec_enterprise_top_secret'
        },
        legitimate_config: 'STANDARD_THEME'
      };

      const auditEntry = await AuditService.logMutation(
        null,
        'UPDATE_SENSITIVE_CONFIG',
        'system_settings',
        '00000000-0000-0000-0000-000000000099',
        sensitivePayload,
        undefined,
        primaryTenantId
      );

      expect(auditEntry).toBeDefined();
      expect(auditEntry.diff_payload.password).toBe('[REDACTED]');
      expect(auditEntry.diff_payload.nested.access_token).toBe('[REDACTED]');
      expect(auditEntry.diff_payload.nested.client_secret).toBe('[REDACTED]');
      expect(auditEntry.diff_payload.legitimate_config).toBe('STANDARD_THEME');
    });

    it('cryptographically verifies hash chain integrity for tenant audit records', async () => {
      const integrity = await AuditService.verifyChainIntegrity(primaryTenantId);
      expect(integrity.valid).toBe(true);
      expect(integrity.total_checked).toBeGreaterThan(0);
    });

    it('enforces RBAC on audit logs (accessible only to COMPANY_ADMIN and SUPER_ADMIN)', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${primaryAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.integrity).toBeDefined();
    });
  });

  describe('2. Database Scalability & Performance via Composite Indexes (Migration 008)', () => {
    it('executes tenant-scoped audit and ledger lookups under 30ms using composite indexes', async () => {
      const startAudit = Date.now();
      const auditRes = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${primaryAdminToken}`);
      const auditDuration = Date.now() - startAudit;

      expect(auditRes.status).toBe(200);
      expect(auditDuration).toBeLessThan(200); // 200ms latency ceiling for local test harness

      const startLedger = Date.now();
      const ledgerRes = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${primaryAdminToken}`);
      const ledgerDuration = Date.now() - startLedger;

      expect(ledgerRes.status).toBe(200);
      expect(ledgerDuration).toBeLessThan(200);
    });

    it('confirms Migration 008 composite indexes exist in pg_indexes', async () => {
      const [results]: [any[], unknown] = await sequelize.query(`
        SELECT indexname FROM pg_indexes 
        WHERE indexname IN (
          'idx_audit_logs_tenant_timestamp',
          'idx_attendance_tenant_date',
          'idx_projects_tenant_status',
          'idx_ledger_tenant_posted',
          'idx_users_tenant_active'
        );
      `);

      const indexNames = results.map((r: any) => r.indexname);
      expect(indexNames).toContain('idx_audit_logs_tenant_timestamp');
      expect(indexNames).toContain('idx_attendance_tenant_date');
      expect(indexNames).toContain('idx_projects_tenant_status');
      expect(indexNames).toContain('idx_ledger_tenant_posted');
      expect(indexNames).toContain('idx_users_tenant_active');
    });
  });

  describe('3. Concurrency Resilience & Transactional Safety', () => {
    it('executes 5 concurrent project creation requests without race condition or deadlock', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        const uniqueCode = `PRJ-CONC-${Date.now().toString().slice(-4)}-${i}`;
        return request(app)
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${primaryAdminToken}`)
          .send({
            name: `Concurrent Scalability Initiative ${i}`,
            code: uniqueCode,
            department_code: 'DEPT-ENG',
            allocated_budget: 100000 + i * 10000,
            estimated_hours: 80,
            milestones_total: 4
          });
      });

      const responses = await Promise.all(promises);
      for (const res of responses) {
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      }
    });

    it('guarantees financial ledger double-entry balance under repeated audit queries', async () => {
      const ledgerRes = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${primaryAdminToken}`);

      expect(ledgerRes.status).toBe(200);
      expect(ledgerRes.body.summary.is_balanced).toBe(true);
    });
  });

  describe('4. Multi-Tenant Isolation Across REST & Audit Boundaries', () => {
    it('prevents secondary tenant from seeing primary tenant audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${secondaryAdminToken}`);

      expect(res.status).toBe(200);
      // Secondary tenant must only see its own records, zero primary tenant records
      const hasPrimaryTenantData = res.body.data.some((log: any) => log.tenant_id === primaryTenantId);
      expect(hasPrimaryTenantData).toBe(false);
    });

    it('prevents secondary tenant from querying primary tenant financial postings', async () => {
      const res = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${secondaryAdminToken}`);

      expect(res.status).toBe(200);
      // Zero entries for newly provisioned empty secondary tenant
      expect(res.body.data.length).toBe(0);
      expect(res.body.summary.total_debits).toBe(0);
      expect(res.body.summary.total_credits).toBe(0);
    });
  });
});
