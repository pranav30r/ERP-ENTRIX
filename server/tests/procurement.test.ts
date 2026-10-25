import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { InventoryItem } from '../src/models';

describe('Procurement State Machine & Approval Pipeline', () => {
  let adminToken: string;
  let testItem: any;

  beforeAll(async () => {
    await sequelize.authenticate();

    const authRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });
    adminToken = authRes.body.access_token;

    // Fetch an inventory item for requisition
    testItem = await InventoryItem.findOne();
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  it('Branch 1: PR under ₹10,000 approves directly upon Manager approval', async () => {
    // 10 units of 65.50 = 655.00 (< 10k)
    const prRes = await request(app)
      .post('/api/v1/procurement/requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        item_id: testItem.id,
        quantity: 10,
        justification: 'Office low value purchase'
      });

    expect(prRes.status).toBe(201);
    expect(prRes.body.data.status).toBe('PENDING_MANAGER');
    expect(prRes.body.requires_finance_approval).toBe(false);

    const prId = prRes.body.data.id;

    // Manager Approves
    const approveRes = await request(app)
      .post(`/api/v1/procurement/requests/${prId}/manager-approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
  });

  it('Branch 2: PR >= ₹10,000 advances to PENDING_FINANCE upon Manager approval', async () => {
    // 200 units of 65.50 = 13,100.00 (>= 10k)
    const prRes = await request(app)
      .post('/api/v1/procurement/requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        item_id: testItem.id,
        quantity: 200,
        justification: 'Factory bulk purchase'
      });

    expect(prRes.status).toBe(201);
    expect(prRes.body.requires_finance_approval).toBe(true);

    const prId = prRes.body.data.id;

    // Manager Approves
    const mgrRes = await request(app)
      .post(`/api/v1/procurement/requests/${prId}/manager-approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' });

    expect(mgrRes.status).toBe(200);
    expect(mgrRes.body.data.status).toBe('PENDING_FINANCE');

    // Finance Approves
    const finRes = await request(app)
      .post(`/api/v1/procurement/requests/${prId}/finance-approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' });

    expect(finRes.status).toBe(200);
    expect(finRes.body.data.status).toBe('APPROVED');

    // Goods Receipt (GRN) atomically increments inventory
    const initialStock = Number(testItem.stock_qty);
    const grnRes = await request(app)
      .post(`/api/v1/procurement/requests/${prId}/receive-goods`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(grnRes.status).toBe(200);
    expect(grnRes.body.data.pr.status).toBe('GOODS_RECEIVED');

    // Verify stock incremented by 200 in DB
    const refreshedItem = await InventoryItem.findByPk(testItem.id);
    expect(Number(refreshedItem?.stock_qty)).toBe(initialStock + 200);
  });
});
