import { Request, Response } from 'express';
import { Employee, User, Department } from '../models';

export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    let employees = await Employee.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name', 'department_id'] }
      ],
      order: [['created_at', 'DESC']]
    });

    // If empty, auto-seed default employees
    if (employees.length === 0) {
      const admin = await User.findOne({ where: { email: 'admin@entrix.local' } });
      if (admin) {
        await Employee.create({
          user_id: admin.id,
          employee_code: 'EMP-ENG-001',
          designation: 'Principal Solutions Architect',
          base_salary: 145000.00,
          annual_leave_balance: 18
        });

        employees = await Employee.findAll({
          include: [
            { model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name', 'department_id'] }
          ]
        });
      }
    }

    res.status(200).json({
      success: true,
      data: employees,
      count: employees.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching employee directory.' });
  }
};
