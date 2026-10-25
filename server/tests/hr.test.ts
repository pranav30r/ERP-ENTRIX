import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';

describe('Human Resources API', () => {
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

  it('GET /api/v1/hr/employees rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/hr/employees');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/hr/employees returns active personnel directory for admin', async () => {
    const res = await request(app)
      .get('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].employee_code).toBeDefined();
    expect(res.body.data[0].designation).toBeDefined();
  });
});
