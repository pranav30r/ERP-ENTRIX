import request from 'supertest';
import { app } from '../src/app';
import {
  User,
  Tenant,
  Employee,
  LeaveRequest,
  InventoryItem,
  PurchaseRequest,
  PurchaseOrder,
  GoodsReceivedNote,
  Supplier,
  SupplierInvoice,
  InventoryMovement,
  Project,
  ProjectTask,
  LedgerEntry
} from '../src/models';
import { generateAccessToken } from '../src/services/tokenService';

describe('Phase 7: Enterprise ERP Completeness & Cross-Module Integration', () => {
  let adminToken: string;
  let hrToken: string;
  let staffToken: string;
  let tenantId: string;
  let testUserId: string;
  let testEmpId: string;
  let testItemId: string;

  beforeAll(async () => {
    tenantId = '00000000-0000-0000-0000-000000000001';

    // 1. Admin user token
    const adminUser = await User.findOne({ where: { email: 'admin@entrix.local' } });
    adminToken = generateAccessToken({
      id: adminUser!.id,
      email: adminUser!.email,
      role_id: 1,
      role_name: 'SUPER_ADMIN',
      tenant_id: tenantId
    });

    // 2. HR Manager user token
    const hrUser = await User.findOne({ where: { email: 'hr@entrix.local' } });
    hrToken = generateAccessToken({
      id: hrUser!.id,
      email: hrUser!.email,
      role_id: 2,
      role_name: 'HR_MANAGER',
      tenant_id: tenantId
    });

    // 3. Staff user token
    let staffUser = await User.findOne({ where: { email: 'staff.p7@entrix.local' } });
    if (!staffUser) {
      staffUser = await User.create({
        tenant_id: tenantId,
        email: 'staff.p7@entrix.local',
        password_hash: 'hashed_password',
        first_name: 'Priya',
        last_name: 'Sharma',
        role_id: 5,
        is_active: true
      });
    }
    testUserId = staffUser.id;
    // Clean up any lingering tasks from previous test runs to ensure idempotency
    await ProjectTask.destroy({ where: { assigned_user_id: staffUser.id } });

    staffToken = generateAccessToken({
      id: staffUser.id,
      email: staffUser.email,
      role_id: 5,
      role_name: 'STAFF_USER',
      tenant_id: tenantId
    });

    // Create staff employee record if not exists
    let emp = await Employee.findOne({ where: { user_id: staffUser.id } });
    if (!emp) {
      emp = await Employee.create({
        tenant_id: tenantId,
        user_id: staffUser.id,
        employee_code: 'EMP-P7-TEST',
        designation: 'Senior Process Engineer',
        base_salary: 85000.00,
        annual_leave_balance: 20
      });
    } else {
      await emp.update({ annual_leave_balance: 20 });
    }
    testEmpId = emp.id;

    // Create test inventory item
    let item = await InventoryItem.findOne({ where: { sku_code: 'SKU-P7-STEEL', tenant_id: tenantId } });
    if (!item) {
      item = await InventoryItem.create({
        tenant_id: tenantId,
        sku_code: 'SKU-P7-STEEL',
        name: 'Industrial High-Tensile Steel Bar',
        category: 'RAW_MATERIALS',
        unit_of_measure: 'KG',
        unit_price: 250.00,
        stock_qty: 100,
        safety_stock: 20
      });
    }
    testItemId = item.id;
  });

  // ====================================================================
  // HR Module Verification
  // ====================================================================
  describe('HR Module: Leave Lifecycle & Salary Masking', () => {
    let leaveRequestId: string;

    it('Employee listing masks base_salary for non-HR staff users', async () => {
      const res = await request(app)
        .get('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${staffToken}`);

      // Staff user is restricted from viewing full directory (403) or salary is omitted
      if (res.status === 200) {
        expect(res.body.data.every((e: any) => e.base_salary === undefined)).toBe(true);
      } else {
        expect(res.status).toBe(403);
      }
    });

    it('HR Manager can submit and inspect leave requests', async () => {
      const res = await request(app)
        .post('/api/v1/hr/leave-requests')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          employee_id: testEmpId,
          leave_type: 'ANNUAL',
          start_date: '2026-11-10',
          end_date: '2026-11-13',
          days_count: 3,
          reason: 'Family wedding event'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.days_count).toBe(3);
      leaveRequestId = res.body.data.id;
    });

    it('HR Manager approval atomically decrements annual leave balance', async () => {
      const empBefore = await Employee.findByPk(testEmpId);
      const balanceBefore = Number(empBefore!.annual_leave_balance);

      const res = await request(app)
        .patch(`/api/v1/hr/leave-requests/${leaveRequestId}/review`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ action: 'APPROVE' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.leave.status).toBe('APPROVED');
      expect(res.body.data.remaining_balance).toBe(balanceBefore - 3);

      const empAfter = await Employee.findByPk(testEmpId);
      expect(Number(empAfter!.annual_leave_balance)).toBe(balanceBefore - 3);
    });
  });

  // ====================================================================
  // Procurement & 3-Way Matching Verification
  // ====================================================================
  describe('Procurement: End-to-End Workflow with 3-Way Match & Stock Ledger', () => {
    let prId: string;
    let supplierId: string;
    let poId: string;
    let grnId: string;

    it('Registers a verified supplier', async () => {
      const res = await request(app)
        .post('/api/v1/procurement/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `SUP-P7-${Date.now().toString().slice(-4)}`,
          name: 'Precision Metal Works Pvt Ltd',
          email: 'sales@precisionmetal.local',
          phone: '+91 99000 88776',
          payment_terms: 'NET30',
          rating: 4.9
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      supplierId = res.body.data.id;
    });

    it('Executes PR -> Approvals -> Supplier Selection -> PO Issued', async () => {
      // 1. Create PR for 20 units (Total: 20 * 250 = ₹5,000)
      const prRes = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_id: testItemId,
          quantity: 20,
          justification: 'Quarterly manufacturing batch quota'
        });

      expect(prRes.status).toBe(201);
      prId = prRes.body.data.id;

      // 2. Manager Approval (<10,000 moves directly to APPROVED)
      const appRes = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/manager-approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE', comments: 'Budget allocated' });

      expect(appRes.status).toBe(200);
      expect(appRes.body.data.status).toBe('APPROVED');

      // 3. Supplier Selection transitions to PO_ISSUED
      const suppRes = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/select-supplier`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ supplier_id: supplierId });

      expect(suppRes.status).toBe(200);
      expect(suppRes.body.data.pr.status).toBe('PO_ISSUED');
      expect(suppRes.body.data.po).toBeDefined();
      poId = suppRes.body.data.po.id;
    });

    it('Receives goods, increments inventory stock, and logs auditable movement', async () => {
      const itemBefore = await InventoryItem.findByPk(testItemId);
      const stockBefore = Number(itemBefore!.stock_qty);

      const res = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/receive-goods`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.updated_stock).toBe(stockBefore + 20);
      grnId = res.body.data.grn.id;

      // Verify immutable inventory movement ledger record
      const movement = await InventoryMovement.findOne({
        where: { reference_id: grnId, movement_type: 'IN' }
      });
      expect(movement).toBeDefined();
      expect(Number(movement!.quantity)).toBe(20);
      expect(Number(movement!.previous_stock)).toBe(stockBefore);
      expect(Number(movement!.new_stock)).toBe(stockBefore + 20);
    });

    it('Detects 3-way match discrepancy when billed amount diverges', async () => {
      const res = await request(app)
        .post('/api/v1/procurement/invoices/match')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoice_number: `INV-DISC-${Date.now()}`,
          po_id: poId,
          grn_id: grnId,
          billed_quantity: 20,
          invoice_amount: 8500.00 // PO was ₹5,000 -> 70% divergence!
        });

      expect(res.status).toBe(200);
      expect(res.body.match_status).toBe('DISCREPANCY');
      expect(res.body.discrepancies).toContain('Price mismatch');
    });

    it('Confirms 3-way match when quantities and amounts align within tolerance', async () => {
      const res = await request(app)
        .post('/api/v1/procurement/invoices/match')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoice_number: `INV-MATCH-${Date.now()}`,
          po_id: poId,
          grn_id: grnId,
          billed_quantity: 20,
          invoice_amount: 5000.00
        });

      expect(res.status).toBe(200);
      expect(res.body.match_status).toBe('MATCHED');

      // Verify PR transitioned to INVOICE_MATCHED
      const updatedPR = await PurchaseRequest.findByPk(prId);
      expect(updatedPR!.status).toBe('INVOICE_MATCHED');

      // Verify balanced double-entry General Ledger postings exist
      const ledgerRows = await LedgerEntry.findAll({
        where: { reference_id: res.body.data.id }
      });
      expect(ledgerRows.length).toBe(2);
      const debitRow = ledgerRows.find((r) => Number(r.debit_amount) > 0);
      const creditRow = ledgerRows.find((r) => Number(r.credit_amount) > 0);
      expect(debitRow?.account_code).toBe('2015 - GR/IR Clearing Suspense');
      expect(creditRow?.account_code).toBe('2010 - Accounts Payable');
      expect(Number(debitRow?.debit_amount)).toBe(5000.00);
      expect(Number(creditRow?.credit_amount)).toBe(5000.00);
    });
  });

  // ====================================================================
  // Projects & Operations Verification
  // ====================================================================
  describe('Projects & Resource Management: PostgreSQL Backend & Conflict Detection', () => {
    let projectId: string;

    it('Persists project to PostgreSQL and fetches via API', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Next-Gen SCADA Integration',
          code: `PRJ-SCADA-${Date.now().toString().slice(-4)}`,
          department_code: 'DEPT-ENG',
          allocated_budget: 180000,
          estimated_hours: 240,
          milestones_total: 8
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PLANNING');
      projectId = res.body.data.id;

      const projectInDb = await Project.findByPk(projectId);
      expect(projectInDb).toBeDefined();
      expect(projectInDb!.name).toBe('Next-Gen SCADA Integration');
    });

    it('Detects overlapping task assignment conflict for engineer', async () => {
      // 1. Assign Task 1: Nov 1 to Nov 15
      const task1Res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Design SCADA telemetry pipelines',
          assigned_user_id: testUserId,
          estimated_hours: 40,
          start_date: '2026-11-01',
          end_date: '2026-11-15'
        });

      expect(task1Res.status).toBe(201);
      expect(task1Res.body.warning).toBeNull();

      // 2. Assign Task 2 overlapping: Nov 10 to Nov 20
      const task2Res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Deploy edge gateway protocol translator',
          assigned_user_id: testUserId,
          estimated_hours: 32,
          start_date: '2026-11-10',
          end_date: '2026-11-20'
        });

      expect(task2Res.status).toBe(201);
      expect(task2Res.body.warning).toContain('Resource conflict');
    });

    it('Updates project milestone progress in PostgreSQL', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${projectId}/progress`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          advance_milestones: 2,
          additional_hours: 35,
          additional_cost: 25000
        });

      expect(res.status).toBe(200);
      expect(res.body.data.milestones_completed).toBe(2);
      expect(res.body.data.logged_hours).toBe(35);
      expect(res.body.data.consumed_budget).toBe(25000);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });
  });
});
