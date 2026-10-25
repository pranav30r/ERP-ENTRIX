import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';

describe('Inventory Module API', () => {
  let authToken: string;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Authenticate as Super Admin
    const authRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });

    authToken = authRes.body.access_token;
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  it('GET /api/v1/inventory rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/inventory');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/inventory returns inventory items for authenticated users', async () => {
    const res = await request(app)
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.metrics.total_items).toBeDefined();
  });

  it('POST /api/v1/inventory creates a new SKU item', async () => {
    const uniqueSku = `TEST-SKU-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sku_code: uniqueSku,
        name: 'Test Industrial Bearing',
        category: 'Mechanical',
        unit_of_measure: 'PCS',
        unit_price: 150.00,
        stock_qty: 100,
        safety_stock: 20
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sku_code).toBe(uniqueSku);
  });
});
