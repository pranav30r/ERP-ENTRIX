import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Project, ProjectTask, User } from '../models';
import { sequelize } from '../config/db';
import { AuditService } from '../services/auditService';

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = user?.tenant_id || (req as any).tenantId;
    if (!tenantId && user?.role_name !== 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const whereClause: any = {};
    if (tenantId) whereClause.tenant_id = tenantId;

    let projects = await Project.findAll({
      where: whereClause,
      include: [
        {
          model: ProjectTask,
          as: 'tasks',
          include: [{ model: User, as: 'assignee', attributes: ['id', 'first_name', 'last_name', 'email'] }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Auto-seed default projects in default tenant if empty
    if (projects.length === 0 && tenantId === '00000000-0000-0000-0000-000000000001') {
      const defaultTenantId = '00000000-0000-0000-0000-000000000001';
      await Project.bulkCreate([
        {
          tenant_id: defaultTenantId,
          code: 'PRJ-APOLLO',
          name: 'Project Apollo — Core ERP Architecture',
          department_code: 'DEPT-ENG',
          allocated_budget: 150000,
          consumed_budget: 85000,
          milestones_total: 10,
          milestones_completed: 6,
          logged_hours: 120,
          estimated_hours: 180,
          status: 'IN_PROGRESS'
        },
        {
          tenant_id: defaultTenantId,
          code: 'PRJ-RFID',
          name: 'Warehouse Automation & RFID Tagging',
          department_code: 'DEPT-PROC',
          allocated_budget: 80000,
          consumed_budget: 32000,
          milestones_total: 6,
          milestones_completed: 4,
          logged_hours: 65,
          estimated_hours: 90,
          status: 'IN_PROGRESS'
        }
      ]);

      projects = await Project.findAll({
        where: whereClause,
        include: [
          {
            model: ProjectTask,
            as: 'tasks',
            include: [{ model: User, as: 'assignee', attributes: ['id', 'first_name', 'last_name', 'email'] }]
          }
        ],
        order: [['created_at', 'DESC']]
      });
    }

    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching projects from database.' });
  }
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const { name, code, department_code, allocated_budget, estimated_hours, milestones_total } = req.body;

    if (!name || !code || !allocated_budget) {
      res.status(400).json({ success: false, error: 'Name, code, and allocated budget are required.' });
      return;
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const existing = await Project.findOne({
      where: {
        tenant_id: tenantId,
        code: normalizedCode
      }
    });

    if (existing) {
      res.status(409).json({ success: false, error: `Project code '${code}' already exists.` });
      return;
    }

    const newProject = await Project.create({
      tenant_id: tenantId,
      name: String(name).trim(),
      code: normalizedCode,
      department_code: department_code || 'DEPT-ENG',
      allocated_budget: Number(allocated_budget),
      consumed_budget: 0,
      milestones_total: Math.max(1, Number(milestones_total) || 5),
      milestones_completed: 0,
      logged_hours: 0,
      estimated_hours: Math.max(1, Number(estimated_hours) || 100),
      status: 'PLANNING'
    });

    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'CREATE_PROJECT',
      'projects',
      newProject.id,
      { code: newProject.code, name: newProject.name, budget: newProject.allocated_budget },
      undefined,
      tenantId
    );

    res.status(201).json({ success: true, data: newProject, message: 'Project created successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error creating project record.' });
  }
};

export const updateProjectProgress = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    const { id } = req.params;
    const { advance_milestones = 1, additional_hours = 0, additional_cost = 0 } = req.body;

    const project = await Project.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!project) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Project not found.' });
      return;
    }

    if (!tenantId || (project.tenant_id !== tenantId && authUser?.role_name !== 'PLATFORM_ADMIN')) {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Cannot mutate project belonging to another organization.' });
      return;
    }

    project.milestones_completed = Math.min(
      project.milestones_total,
      Number(project.milestones_completed) + Number(advance_milestones)
    );
    project.logged_hours = Number(project.logged_hours) + Number(additional_hours);
    project.consumed_budget = Number(project.consumed_budget) + Number(additional_cost);

    if (project.milestones_completed >= project.milestones_total) {
      project.status = 'COMPLETED';
    } else if (project.status === 'PLANNING') {
      project.status = 'IN_PROGRESS';
    }

    await project.save({ transaction });

    await AuditService.logMutation(
      authUser ? authUser.id : null,
      'UPDATE_PROJECT_PROGRESS',
      'projects',
      project.id,
      {
        milestones_completed: project.milestones_completed,
        consumed_budget: project.consumed_budget,
        logged_hours: project.logged_hours,
        status: project.status
      },
      transaction,
      project.tenant_id
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      data: project,
      message: 'Milestone progress updated.'
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Error updating project progress.' });
  }
};

export const getProjectTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenant_id || (req as any).tenantId;

    const tasks = await ProjectTask.findAll({
      where: tenantId ? { project_id: id, tenant_id: tenantId } : { project_id: id },
      include: [{ model: User, as: 'assignee', attributes: ['id', 'first_name', 'last_name', 'email'] }],
      order: [['created_at', 'ASC']]
    });

    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error retrieving project tasks.' });
  }
};

export const createProjectTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser?.tenant_id || (req as any).tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, error: 'Tenant context required. Access denied.' });
      return;
    }
    const { id: project_id } = req.params;
    const { title, assigned_user_id, estimated_hours = 8, start_date, end_date } = req.body;

    if (!title) {
      res.status(400).json({ success: false, error: 'Task title is required.' });
      return;
    }

    const project = await Project.findByPk(project_id);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found.' });
      return;
    }

    if (!tenantId || (project.tenant_id !== tenantId && authUser?.role_name !== 'PLATFORM_ADMIN')) {
      res.status(403).json({ success: false, error: 'Access denied: Cannot add tasks to another tenant\'s project.' });
      return;
    }

    let resourceConflict: string | null = null;

    // Resource Assignment Conflict Detection: Check if assigned user has overlapping active tasks
    if (assigned_user_id) {
      const assignee = await User.findOne({
        where: { id: assigned_user_id, tenant_id: tenantId, is_active: true }
      });

      if (!assignee) {
        res.status(400).json({ success: false, error: 'Assigned user does not exist, is inactive, or belongs to another company.' });
        return;
      }

      if (start_date && end_date) {
        const overlappingTasks = await ProjectTask.findAll({
          where: {
            assigned_user_id,
            status: { [Op.in]: ['TODO', 'IN_PROGRESS'] },
            [Op.and]: [
              { start_date: { [Op.lte]: end_date } },
              { end_date: { [Op.gte]: start_date } }
            ]
          }
        });

        if (overlappingTasks.length > 0) {
          resourceConflict = `Resource conflict: User ${assignee.first_name} ${assignee.last_name} is already allocated to ${overlappingTasks.length} task(s) during this period.`;
        }
      }
    }

    const task = await ProjectTask.create({
      tenant_id: tenantId,
      project_id,
      title: String(title).trim(),
      assigned_user_id: assigned_user_id || null,
      estimated_hours: Number(estimated_hours) || 8,
      status: 'TODO',
      start_date: start_date || null,
      end_date: end_date || null
    });

    res.status(201).json({
      success: true,
      data: task,
      warning: resourceConflict,
      message: resourceConflict ? `Task created with warning: ${resourceConflict}` : 'Task created successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error creating project task.' });
  }
};
