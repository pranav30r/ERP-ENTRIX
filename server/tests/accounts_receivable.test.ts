import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { LedgerEntry } from '../src/models';

describe('Sprint 3: Customer Accounts Receivable (AR) & Sales Invoicing', () => {
  let adminToken: string;
  const testTenantId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    await sequelize.authenticate();

    const authRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@entrix.local', password: 'Admin@123' });

    adminToken = authRes.body.access_token;
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  it('POST /api/v1/finance/sales-invoice posts balanced Dr 1100 / Cr 4000 entries', async () => {
    const invNumber = `TEST-INV-${Date.now()}`;
    const amount = 25000.00;

    const res = await request(app)
      .post('/api/v1/finance/sales-invoice')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer_name: 'Aerospace Technologies Inc',
        invoice_number: invNumber,
        amount,
        description: 'Automated Test Batch'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(amount);

    // Verify database entries
    const txUuid = res.body.data.transaction_uuid;
    const dbEntries = await LedgerEntry.findAll({ where: { transaction_uuid: txUuid } });
    expect(dbEntries.length).toBe(2);

    const debitRow = dbEntries.find(e => e.account_code.includes('1100'));
    const creditRow = dbEntries.find(e => e.account_code.includes('4000'));

    expect(debitRow).toBeDefined();
    expect(Number(debitRow?.debit_amount)).toBe(amount);
    expect(Number(debitRow?.credit_amount)).toBe(0.00);

    expect(creditRow).toBeDefined();
    expect(Number(creditRow?.credit_amount)).toBe(amount);
    expect(Number(creditRow?.debit_amount)).toBe(0.00);
  });

  it('POST /api/v1/finance/customer-receipt posts balanced Dr 1010 / Cr 1100 entries', async () => {
    const invNumber = `TEST-INV-${Date.now()}`;
    const receiptAmount = 15000.00;

    const res = await request(app)
      .post('/api/v1/finance/customer-receipt')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer_name: 'Aerospace Technologies Inc',
        invoice_number: invNumber,
        amount: receiptAmount,
        payment_method: 'BANK_TRANSFER'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const txUuid = res.body.data.transaction_uuid;
    const dbEntries = await LedgerEntry.findAll({ where: { transaction_uuid: txUuid } });
    expect(dbEntries.length).toBe(2);

    const cashRow = dbEntries.find(e => e.account_code.includes('1010'));
    const arRow = dbEntries.find(e => e.account_code.includes('1100'));

    expect(Number(cashRow?.debit_amount)).toBe(receiptAmount);
    expect(Number(arRow?.credit_amount)).toBe(receiptAmount);
  });

  it('GET /api/v1/finance/receivables returns accurate aggregated totals', async () => {
    const res = await request(app)
      .get('/api/v1/finance/receivables')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_invoiced).toBeGreaterThan(0);
    expect(res.body.data.total_collected).toBeGreaterThan(0);
    expect(res.body.data.outstanding_balance).toBeGreaterThanOrEqual(0);
  });
});
