import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';

describe('Role-Based Access Control (RBAC) Enforcement Tests', () => {
  let superAdminToken: string;
  let financeToken: string;
  let hrToken: string;
  let staffToken: string;

  beforeAll(async () => {
    await sequelize.authenticate();

    // 1. Login Super Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@entrix.local', password: 'Admin@123' });
    superAdminToken = adminRes.body.access_token;

    // 2. Login Finance Officer
    const finRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'finance@entrix.local', password: 'Admin@123' });
    financeToken = finRes.body.access_token;

    // 3. Login HR Manager
    const hrRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'hr@entrix.local', password: 'Admin@123' });
    hrToken = hrRes.body.access_token;

    // 4. Login Staff User
    const staffRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'staff@entrix.local', password: 'Admin@123' });
    staffToken = staffRes.body.access_token;
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  it('SUPER_ADMIN: grants access to cryptographic audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('STAFF_USER: strictly forbids access to audit logs (HTTP 403)', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Forbidden');
  });

  it('STAFF_USER: strictly forbids access to finance ledger (HTTP 403)', async () => {
    const res = await request(app)
      .get('/api/v1/finance/ledger')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('STAFF_USER: strictly forbids access to HR employee roster (HTTP 403)', async () => {
    const res = await request(app)
      .get('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('FINANCE_OFFICER: grants access to finance ledger (HTTP 200)', async () => {
    const res = await request(app)
      .get('/api/v1/finance/ledger')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('HR_MANAGER: grants access to employee directory (HTTP 200)', async () => {
    const res = await request(app)
      .get('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
