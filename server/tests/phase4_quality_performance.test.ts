import request from 'supertest';
import { app, server } from '../src/app';
import { sequelize } from '../src/config/db';
import { User, Employee, AttendanceRecord } from '../src/models';

describe('Phase 4: Production Quality, Testing, Performance & UX Verification', () => {
  let adminToken: string;
  let createdEmployeeId: string;
  const testEmpCode = `EMP-TEST-${Date.now().toString().slice(-4)}`;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Authenticate as Super Admin
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@entrix.local', password: 'Admin@123' });

    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    // Cleanup created test employee and attendance records
    if (createdEmployeeId) {
      await AttendanceRecord.destroy({ where: { employee_id: createdEmployeeId } });
      await Employee.destroy({ where: { id: createdEmployeeId } });
    }
    await sequelize.close();
    server.close();
  });

  describe('1. Observability, Diagnostics & Request Tracing', () => {
    it('GET /health and /health/live return liveness probe status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ONLINE');
      expect(res.body.system).toBe('ENTRIX ERP Backend');

      const liveRes = await request(app).get('/health/live');
      expect(liveRes.status).toBe(200);
      expect(liveRes.body.status).toBe('ONLINE');
    });

    it('GET /health/ready evaluates PostgreSQL database readiness probe', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.checks.database).toBe('UP');
    });

    it('propagates or generates X-Request-ID / X-Correlation-ID headers across requests', async () => {
      const customId = 'req-trace-entrix-9999';
      const res = await request(app)
        .get('/health')
        .set('X-Request-ID', customId);

      expect(res.headers['x-request-id']).toBe(customId);
      expect(res.headers['x-correlation-id']).toBe(customId);
    });
  });

  describe('2. HR Module: Employee Creation, Validation, Editing & Attendance', () => {
    it('creates an employee with server-side validation and initial leave balance', async () => {
      const res = await request(app)
        .post('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Priya',
          last_name: 'Sharma',
          email: `priya.${Date.now()}@entrix.local`,
          designation: 'Senior Reliability Engineer',
          employee_code: testEmpCode,
          base_salary: 125000,
          annual_leave_balance: 22
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employee_code).toBe(testEmpCode);
      expect(res.body.data.designation).toBe('Senior Reliability Engineer');
      expect(res.body.data.annual_leave_balance).toBe(22);
      createdEmployeeId = res.body.data.id;
    });

    it('rejects duplicate employee codes in the same tenant', async () => {
      const res = await request(app)
        .post('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Duplicate',
          last_name: 'User',
          email: `duplicate.${Date.now()}@entrix.local`,
          designation: 'DevOps',
          employee_code: testEmpCode,
          base_salary: 80000
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already exists');
    });

    it('updates employee designation and salary via PUT /api/v1/hr/employees/:id', async () => {
      const res = await request(app)
        .put(`/api/v1/hr/employees/${createdEmployeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          designation: 'Staff Reliability Architect',
          base_salary: 140000,
          annual_leave_balance: 20
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.designation).toBe('Staff Reliability Architect');
      expect(Number(res.body.data.base_salary)).toBe(140000);
      expect(res.body.data.annual_leave_balance).toBe(20);
    });

    it('records and queries daily employee attendance', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Record attendance
      const recordRes = await request(app)
        .post('/api/v1/hr/attendance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employee_id: createdEmployeeId,
          date: today,
          status: 'PRESENT',
          check_in_time: '09:15:00',
          check_out_time: '18:30:00',
          notes: 'Completed sprint architecture review'
        });

      expect([200, 201]).toContain(recordRes.status);
      expect(recordRes.body.success).toBe(true);

      // Query attendance
      const queryRes = await request(app)
        .get('/api/v1/hr/attendance')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ date: today });

      expect(queryRes.status).toBe(200);
      expect(queryRes.body.success).toBe(true);
      const found = queryRes.body.data.find((a: any) => a.employee_id === createdEmployeeId);
      expect(found).toBeDefined();
      expect(found.status).toBe('PRESENT');
      expect(found.notes).toBe('Completed sprint architecture review');
    });
  });

  describe('3. Project Milestones & Resource Operations', () => {
    const testProjectCode = `PRJ-TST-${Date.now().toString().slice(-4)}`;

    it('creates a project with allocated budget and estimated milestones', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Telemetry Real-Time Streaming Migration',
          code: testProjectCode,
          department_code: 'DEPT-ENG',
          allocated_budget: 180000,
          estimated_hours: 240,
          milestones_total: 6
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe(testProjectCode);
      expect(res.body.data.status).toBe('PLANNING');
    });

    it('advances project milestones, logs hours, and updates status', async () => {
      const listRes = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${adminToken}`);

      const project = listRes.body.data.find((p: any) => p.code === testProjectCode);
      expect(project).toBeDefined();

      const progressRes = await request(app)
        .put(`/api/v1/projects/${project.id}/progress`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          advance_milestones: 2,
          additional_hours: 45,
          additional_cost: 35000
        });

      expect(progressRes.status).toBe(200);
      expect(progressRes.body.data.milestones_completed).toBe(2);
      expect(progressRes.body.data.logged_hours).toBe(45);
      expect(progressRes.body.data.consumed_budget).toBe(35000);
      expect(progressRes.body.data.status).toBe('IN_PROGRESS');
    });
  });

  describe('4. Full E2E User Journey & Critical Workflow Smoke Verification', () => {
    it('executes full journey: Login -> Browse Inventory -> PR Lifecycle -> Accounting Integrity', async () => {
      // 1. Verify Inventory
      const invRes = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(invRes.status).toBe(200);
      expect(invRes.body.data.length).toBeGreaterThan(0);
      const targetItem = invRes.body.data[0];

      // 2. Submit Requisition
      const prRes = await request(app)
        .post('/api/v1/procurement/requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          item_id: targetItem.id,
          quantity: 5,
          justification: 'Automated E2E Journey Quality Verification'
        });
      expect(prRes.status).toBe(201);
      const prId = prRes.body.data.id;

      // 3. Manager Approval
      const mgrRes = await request(app)
        .post(`/api/v1/procurement/requests/${prId}/manager-approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'APPROVE', comments: 'E2E Approved' });
      expect(mgrRes.status).toBe(200);

      // 4. Verify Double-Entry Ledger Balance
      const finRes = await request(app)
        .get('/api/v1/finance/ledger')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(finRes.status).toBe(200);
      expect(finRes.body.summary.is_balanced).toBe(true);
    });
  });
});
