import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { AuditService } from '../src/services/auditService';

describe('ENTRIX E2E System Lifecycle Integration Smoke Test', () => {
  let authToken: string;
  let testItemId: string;
  let createdPrId: string;

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  it('Step 1: Authenticates as SUPER_ADMIN and retrieves JWT bearer token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.access_token).toBeDefined();
    authToken = res.body.access_token;
  });

  it('Step 2: Fetches current inventory items and extracts SKU item ID', async () => {
    const res = await request(app)
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].sku_code).toBeDefined();
    testItemId = res.body.data[0].id;
  });

  it('Step 3: Creates a new Purchase Requisition (PR)', async () => {
    const res = await request(app)
      .post('/api/v1/procurement/requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        item_id: testItemId,
        quantity: 5,
        justification: 'Smoke test automated procurement workflow verification'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.pr_code).toBeDefined();
    expect(res.body.data.status).toBe('PENDING_MANAGER');
    createdPrId = res.body.data.id;
  });

  it('Step 4: Executes Manager approval transition', async () => {
    const res = await request(app)
      .post(`/api/v1/procurement/requests/${createdPrId}/manager-approval`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(['APPROVED', 'PENDING_FINANCE']).toContain(res.body.data.status);
  });

  it('Step 5: Retrieves cryptographic audit trail and verifies SHA-256 chain integrity', async () => {
    // Ensure at least one audit record exists for chain validation
    const user = await sequelize.models.User.findOne();
    await AuditService.logMutation(
      user ? (user as any).id : null,
      'SMOKE_TEST_EXECUTION',
      'inventory_items',
      testItemId,
      { status: 'SUCCESS' }
    );

    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].current_hash).toBeDefined();
    expect(res.body.integrity.valid).toBe(true);
    expect(res.body.integrity.total_checked).toBeGreaterThan(0);
  });
});
