import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';

describe('Finance & General Ledger API', () => {
  let adminToken: string;

  beforeAll(async () => {
    await sequelize.authenticate();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@entrix.local', password: 'Admin@123' });
    adminToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  it('GET /api/v1/finance/ledger rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/finance/ledger');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/finance/ledger returns balanced double-entry ledger records for admin', async () => {
    const res = await request(app)
      .get('/api/v1/finance/ledger')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.is_balanced).toBe(true);
    expect(res.body.summary.total_debits).toBe(res.body.summary.total_credits);
  });
});
