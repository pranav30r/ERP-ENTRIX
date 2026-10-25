import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Tenant, User, Role, Department, Employee, Subscription, InventoryItem, PurchaseRequest, SubscriptionInvoice, SubscriptionHistory } from '../models';
import { getPlanEntitlement, PlanTier } from '../config/plans';

export const getCompanyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const tenant = await Tenant.findByPk(tenantId, {
      include: [{ model: Subscription, as: 'subscription' }]
    });

    if (!tenant) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const memberCount = await User.count({ where: { tenant_id: tenantId, is_active: true } });
    const sub = (tenant as any).subscription;
    const entitlement = getPlanEntitlement((sub?.plan_tier || 'STARTER') as PlanTier);

    res.json({
      company: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        memberCount,
        subscription: sub ? {
          tier: sub.plan_tier,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end
        } : null,
        planEntitlement: entitlement
      }
    });
  } catch (error: any) {
    console.error('[CompanySettingsController] getCompanyProfile error:', error);
    res.status(500).json({ error: 'Failed to retrieve company profile' });
  }
};

export const updateCompanyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    const { name } = req.body;

    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Company name must be at least 2 characters' });
      return;
    }

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    await tenant.update({ name: name.trim() });
    res.json({ message: 'Company profile updated successfully', tenant });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update company profile' });
  }
};

export const getMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const members = await User.findAll({
      where: { tenant_id: tenantId },
      attributes: ['id', 'email', 'first_name', 'last_name', 'role_id', 'department_id', 'is_active', 'created_at'],
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name'] },
        { model: Department, as: 'department', attributes: ['id', 'code', 'name'] },
        { model: Employee, as: 'employee', attributes: ['id', 'designation', 'employee_code'] }
      ],
      order: [['created_at', 'ASC']]
    });

    res.json({ members });
  } catch (error: any) {
    console.error('[CompanySettingsController] getMembers error:', error);
    res.status(500).json({ error: 'Failed to retrieve team members' });
  }
};

export const inviteMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    const { email, firstName, lastName, roleId, departmentId, designation } = req.body;

    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }
    if (!email || !firstName || !lastName || !roleId) {
      res.status(400).json({ error: 'email, firstName, lastName, and roleId are required' });
      return;
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      res.status(409).json({ error: 'A user with this email address already exists' });
      return;
    }

    // Hash default temporary invitation password
    const temporaryPassword = req.body.password || 'EntrixWelcome2026!';
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

    const newUser = await User.create({
      tenant_id: tenantId,
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role_id: Number(roleId),
      department_id: departmentId || null,
      is_active: true
    });

    if (designation) {
      await Employee.create({
        tenant_id: tenantId,
        user_id: newUser.id,
        employee_code: `EMP-${Date.now().toString().slice(-4)}`,
        designation: designation.trim(),
        joining_date: new Date(),
        base_salary: 50000,
        annual_leave_balance: 18
      });
    }

    res.status(201).json({
      message: 'Member invited successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        roleId: newUser.role_id
      }
    });
  } catch (error: any) {
    console.error('[CompanySettingsController] inviteMember error:', error);
    res.status(500).json({ error: 'Failed to invite new member' });
  }
};

export const updateMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    const memberId = req.params.id;
    const { roleId, isActive } = req.body;

    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const member = await User.findOne({
      where: { id: memberId, tenant_id: tenantId }
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found in your organization' });
      return;
    }

    const updates: Partial<{ role_id: number; is_active: boolean }> = {};
    if (roleId !== undefined) updates.role_id = Number(roleId);
    if (isActive !== undefined) updates.is_active = Boolean(isActive);

    await member.update(updates);
    res.json({ message: 'Member updated successfully', member });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update member' });
  }
};

export const exportCompanyData = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const [tenant, members, departments, items, requests, invoices, subscription] = await Promise.all([
      Tenant.findByPk(tenantId),
      User.findAll({ where: { tenant_id: tenantId }, attributes: { exclude: ['password_hash'] } }),
      Department.findAll({ where: { tenant_id: tenantId } }),
      InventoryItem.findAll({ where: { tenant_id: tenantId } }),
      PurchaseRequest.findAll({ where: { tenant_id: tenantId } }),
      SubscriptionInvoice.findAll({ where: { tenant_id: tenantId } }),
      Subscription.findOne({ where: { tenant_id: tenantId } })
    ]);

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json({
      success: true,
      exportTimestamp: new Date().toISOString(),
      metadata: {
        platform: 'ENTRIX Enterprise ERP',
        version: '1.0.0-pilot',
        tenantId: tenant.id,
        tenantSlug: tenant.slug
      },
      data: {
        organization: tenant,
        departments,
        teamRoster: members,
        inventory: items,
        procurementRequests: requests,
        subscription,
        invoices
      }
    });
  } catch (error: any) {
    console.error('[CompanySettingsController] exportCompanyData error:', error);
    res.status(500).json({ error: 'Failed to export company data' });
  }
};

export const closeCompanyAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    const { confirmSlug, reason } = req.body;

    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    if (!confirmSlug || confirmSlug !== tenant.slug) {
      res.status(400).json({
        error: `Confirmation slug '${confirmSlug}' does not match tenant slug '${tenant.slug}'. Operation aborted.`
      });
      return;
    }

    // Suspend company and deactivate users
    await tenant.update({ status: 'SUSPENDED' });
    await User.update({ is_active: false }, { where: { tenant_id: tenantId } });

    const sub = await Subscription.findOne({ where: { tenant_id: tenantId } });
    if (sub) {
      await sub.update({ status: 'CANCELED', cancel_at_period_end: true, canceled_at: new Date() });
      await SubscriptionHistory.create({
        subscription_id: sub.id,
        tenant_id: tenantId,
        from_status: sub.status,
        to_status: 'CANCELED',
        from_plan: sub.plan_tier,
        to_plan: sub.plan_tier,
        reason: `Tenant Account Closure: ${reason || 'User requested deactivation'}`,
        actor_id: user?.id
      });
    }

    res.json({
      success: true,
      message: `Account for '${tenant.name}' has been successfully closed. All member credentials deactivated.`
    });
  } catch (error: any) {
    console.error('[CompanySettingsController] closeCompanyAccount error:', error);
    res.status(500).json({ error: 'Failed to close company account' });
  }
};

