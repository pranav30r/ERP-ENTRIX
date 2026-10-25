import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { Employee, User, Department, AttendanceRecord, LeaveRequest } from '../models';
import { sequelize } from '../config/db';
import { AuditService } from '../services/auditService';

export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId && authUser?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const { search, limit = '50', offset = '0' } = req.query;

    const whereClause: any = {};
    if (tenantId) {
      whereClause.tenant_id = tenantId;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { employee_code: { [Op.iLike]: term } },
        { designation: { [Op.iLike]: term } }
      ];
    }

    let employees = await Employee.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name', 'department_id', 'is_active'] }
      ],
      order: [['created_at', 'DESC']],
      limit: Math.min(100, Math.max(1, parseInt(limit as string, 10))),
      offset: Math.max(0, parseInt(offset as string, 10))
    });

    // If empty in default tenant, auto-seed default employee for demo
    if (employees.length === 0 && tenantId === '00000000-0000-0000-0000-000000000001' && !search) {
      const admin = await User.findOne({ where: { email: 'admin@entrix.local' } });
      if (admin) {
        await Employee.create({
          tenant_id: '00000000-0000-0000-0000-000000000001',
          user_id: admin.id,
          employee_code: 'EMP-ENG-001',
          designation: 'Principal Solutions Architect',
          base_salary: 145000.00,
          annual_leave_balance: 18
        });

        employees = await Employee.findAll({
          where: whereClause,
          include: [
            { model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name', 'department_id', 'is_active'] }
          ]
        });
      }
    }

    // Role-based masking of compensation: non-HR/Admin roles cannot inspect base_salary
    const canViewSalary = authUser && ['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER'].includes(authUser.role_name);
    const sanitizedEmployees = employees.map(emp => {
      const json = emp.toJSON() as any;
      if (!canViewSalary) {
        delete json.base_salary;
      }
      return json;
    });

    const totalCount = await Employee.count({ where: whereClause });

    res.status(200).json({
      success: true,
      data: sanitizedEmployees,
      total: totalCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching employee directory.' });
  }
};

export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const {
      first_name,
      last_name,
      email,
      designation,
      employee_code,
      base_salary,
      department_id,
      annual_leave_balance = 18
    } = req.body;

    if (!first_name || !last_name || !email || !designation || !employee_code) {
      res.status(400).json({ success: false, error: 'First name, last name, email, designation, and employee code are required.' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user already exists or create new staff user
    let user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      const defaultPasswordHash = await bcrypt.hash('Staff@123', 10);
      user = await User.create({
        tenant_id: tenantId,
        email: normalizedEmail,
        password_hash: defaultPasswordHash,
        first_name: String(first_name).trim(),
        last_name: String(last_name).trim(),
        role_id: 5, // Staff role
        department_id: department_id || null,
        is_active: true
      });
    }

    // Check if employee code is already taken in this tenant
    const existingEmp = await Employee.findOne({
      where: { tenant_id: tenantId, employee_code: String(employee_code).trim() }
    });
    if (existingEmp) {
      res.status(409).json({ success: false, error: `Employee code '${employee_code}' already exists.` });
      return;
    }

    const newEmployee = await Employee.create({
      tenant_id: tenantId,
      user_id: user.id,
      employee_code: String(employee_code).trim(),
      designation: String(designation).trim(),
      base_salary: Number(base_salary) || 50000,
      annual_leave_balance: Number(annual_leave_balance) || 18
    });

    const populated = await Employee.findByPk(newEmployee.id, {
      include: [{ model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name', 'department_id'] }]
    });

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Employee created successfully.'
    });
  } catch (error: any) {
    console.error('[HR] Error creating employee:', error);
    res.status(500).json({ success: false, error: error?.message || 'Error creating employee record.' });
  }
};

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenant_id || (req as any).tenantId;
    if (!tenantId && user?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const { id } = req.params;
    const { designation, base_salary, annual_leave_balance } = req.body;

    const whereClause: any = { id };
    if (tenantId) whereClause.tenant_id = tenantId;

    const employee = await Employee.findOne({ where: whereClause });
    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found.' });
      return;
    }

    const updates: any = {};
    if (designation !== undefined) updates.designation = String(designation).trim();
    if (base_salary !== undefined) updates.base_salary = Number(base_salary);
    if (annual_leave_balance !== undefined) updates.annual_leave_balance = Number(annual_leave_balance);

    await employee.update(updates);

    res.status(200).json({
      success: true,
      data: employee,
      message: 'Employee record updated successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error updating employee record.' });
  }
};

export const getAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenant_id || (req as any).tenantId;
    if (!tenantId && user?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const { date, employee_id } = req.query;

    const whereClause: any = {};
    if (tenantId) whereClause.tenant_id = tenantId;
    if (date && typeof date === 'string') whereClause.date = date;
    if (employee_id && typeof employee_id === 'string') whereClause.employee_id = employee_id;

    const records = await AttendanceRecord.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          as: 'employee',
          include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name', 'email'] }]
        }
      ],
      order: [['date', 'DESC'], ['created_at', 'DESC']],
      limit: 100
    });

    res.status(200).json({
      success: true,
      data: records
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error retrieving attendance records.' });
  }
};

export const recordAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const { employee_id, date, status = 'PRESENT', check_in_time = '09:00:00', check_out_time = '18:00:00', notes } = req.body;

    if (!employee_id) {
      res.status(400).json({ success: false, error: 'employee_id is required.' });
      return;
    }

    const attendanceDate = date || new Date().toISOString().split('T')[0];

    const [record, created] = await AttendanceRecord.upsert({
      tenant_id: tenantId,
      employee_id,
      date: attendanceDate,
      status,
      check_in_time,
      check_out_time,
      notes: notes || null
    });

    res.status(created ? 201 : 200).json({
      success: true,
      data: record,
      message: created ? 'Attendance recorded successfully.' : 'Attendance updated successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error logging attendance.' });
  }
};

export const getLeaveRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { status, employee_id } = req.query;

    const whereClause: any = {};
    if (tenantId) whereClause.tenant_id = tenantId;
    if (status && typeof status === 'string') whereClause.status = status;
    if (employee_id && typeof employee_id === 'string') whereClause.employee_id = employee_id;

    // Regular staff user only sees their own leaves
    if (authUser?.role_name === 'STAFF_USER') {
      const emp = await Employee.findOne({ where: { user_id: authUser.id } });
      if (emp) {
        whereClause.employee_id = emp.id;
      } else {
        res.status(200).json({ success: true, data: [] });
        return;
      }
    }

    const leaves = await LeaveRequest.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          as: 'employee',
          include: [{ model: User, as: 'user', attributes: ['first_name', 'last_name', 'email'] }]
        },
        { model: User, as: 'reviewer', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({ success: true, data: leaves });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching leave requests.' });
  }
};

export const createLeaveRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    let { employee_id, leave_type = 'ANNUAL', start_date, end_date, days_count, reason } = req.body;

    // If no employee_id provided, look up from authUser
    if (!employee_id && authUser) {
      const selfEmp = await Employee.findOne({ where: { user_id: authUser.id, tenant_id: tenantId } });
      if (selfEmp) {
        employee_id = selfEmp.id;
      }
    }

    if (!employee_id || !start_date || !end_date || !reason) {
      res.status(400).json({
        success: false,
        error: 'employee_id, start_date, end_date, and reason are required.'
      });
      return;
    }

    const employee = await Employee.findOne({ where: { id: employee_id, tenant_id: tenantId } });
    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found in this company.' });
      return;
    }

    const days = Math.max(1, parseInt(days_count, 10) || 1);

    const leave = await LeaveRequest.create({
      tenant_id: tenantId,
      employee_id,
      leave_type,
      start_date,
      end_date,
      days_count: days,
      reason: String(reason).trim(),
      status: 'PENDING'
    });

    if ((req as any).io) {
      (req as any).io.to(`tenant:${tenantId}`).emit('leave_requested', {
        leave,
        message: `New leave request submitted for ${employee.employee_code}`
      });
    }

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully.',
      data: leave
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Error submitting leave request.' });
  }
};

export const reviewLeaveRequest = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { id } = req.params;
    const { action, rejection_reason } = req.body; // 'APPROVE' | 'REJECT'

    if (action !== 'APPROVE' && action !== 'REJECT') {
      await transaction.rollback();
      res.status(400).json({ success: false, error: "Action must be 'APPROVE' or 'REJECT'." });
      return;
    }

    const leave = await LeaveRequest.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!leave) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Leave request not found.' });
      return;
    }

    if (!tenantId || (leave.tenant_id !== tenantId && authUser?.role_name !== 'PLATFORM_ADMIN')) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Access denied: Cannot review leaves of another tenant.' });
      return;
    }

    if (leave.status !== 'PENDING') {
      await transaction.rollback();
      res.status(400).json({ success: false, error: `Leave request has already been ${leave.status.toLowerCase()}.` });
      return;
    }

    const employee = await Employee.findByPk(leave.employee_id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!employee) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Associated employee record not found.' });
      return;
    }

    if (action === 'APPROVE') {
      if (leave.leave_type === 'ANNUAL') {
        const currentBalance = Number(employee.annual_leave_balance);
        if (currentBalance < Number(leave.days_count)) {
          await transaction.rollback();
          res.status(400).json({
            success: false,
            error: `Insufficient annual leave balance. Requested: ${leave.days_count}, Available: ${currentBalance}.`
          });
          return;
        }
        employee.annual_leave_balance = currentBalance - Number(leave.days_count);
        await employee.save({ transaction });
      }

      leave.status = 'APPROVED';
      leave.reviewed_by = authUser ? authUser.id : null;
      leave.reviewed_at = new Date();
      await leave.save({ transaction });

      await AuditService.logMutation(
        authUser ? authUser.id : null,
        'HR_APPROVE_LEAVE',
        'leave_requests',
        leave.id,
        {
          employee_id: employee.id,
          days_deducted: leave.days_count,
          remaining_leave_balance: employee.annual_leave_balance
        },
        transaction,
        leave.tenant_id
      );
    } else {
      leave.status = 'REJECTED';
      leave.rejection_reason = rejection_reason || 'Rejected by HR Management';
      leave.reviewed_by = authUser ? authUser.id : null;
      leave.reviewed_at = new Date();
      await leave.save({ transaction });

      await AuditService.logMutation(
        authUser ? authUser.id : null,
        'HR_REJECT_LEAVE',
        'leave_requests',
        leave.id,
        {
          employee_id: employee.id,
          reason: leave.rejection_reason
        },
        transaction,
        leave.tenant_id
      );
    }

    await transaction.commit();

    if ((req as any).io) {
      (req as any).io.to(`tenant:${leave.tenant_id}`).emit('leave_status_updated', {
        leave,
        message: `Leave request for ${employee.employee_code} was ${leave.status}`
      });
    }

    res.status(200).json({
      success: true,
      message: `Leave request ${leave.status.toLowerCase()} successfully.`,
      data: {
        leave,
        remaining_balance: employee.annual_leave_balance
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Error reviewing leave request. Transaction rolled back.' });
  }
};

export const getHRMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenant_id || (req as any).tenantId;
    if (!tenantId && user?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const whereTenant: any = tenantId ? { tenant_id: tenantId } : {};

    const totalEmployees = await Employee.count({ where: whereTenant });
    const pendingLeaves = await LeaveRequest.count({ where: { ...whereTenant, status: 'PENDING' } });
    const today = new Date().toISOString().split('T')[0];
    const presentToday = await AttendanceRecord.count({ where: { ...whereTenant, date: today, status: 'PRESENT' } });

    res.status(200).json({
      success: true,
      metrics: {
        total_employees: totalEmployees,
        pending_leaves: pendingLeaves,
        present_today: presentToday
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching HR metrics.' });
  }
};

