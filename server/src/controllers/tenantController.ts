import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Tenant, User, Department, Role, TenantInvitation, Subscription } from '../models';
import { sequelize } from '../config/db';
import { generateAccessToken, issueRefreshToken } from '../services/tokenService';
import { ENV } from '../config/env';

export const onboardCompany = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const { company_name, slug, admin_email, admin_password, admin_first_name, admin_last_name } = req.body;

    if (!company_name || !slug || !admin_email || !admin_password || !admin_first_name || !admin_last_name) {
      await transaction.rollback();
      res.status(400).json({
        success: false,
        error: 'All fields are required: company_name, slug, admin_email, admin_password, admin_first_name, admin_last_name.'
      });
      return;
    }

    const normalizedSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const normalizedEmail = String(admin_email).trim().toLowerCase();

    // Check slug availability
    const existingTenant = await Tenant.findOne({ where: { slug: normalizedSlug }, transaction });
    if (existingTenant) {
      await transaction.rollback();
      res.status(409).json({ success: false, error: `Company slug '${normalizedSlug}' is already taken.` });
      return;
    }

    // Check email availability
    const existingUser = await User.findOne({ where: { email: normalizedEmail }, transaction });
    if (existingUser) {
      await transaction.rollback();
      res.status(409).json({ success: false, error: 'User with this email already exists.' });
      return;
    }

    // 1. Create Tenant
    const tenant = await Tenant.create({
      name: company_name,
      slug: normalizedSlug,
      status: 'ACTIVE',
      plan: 'ENTERPRISE'
    }, { transaction });

    // 1b. Create Initial Enterprise Trial Subscription
    const now = new Date();
    await Subscription.create({
      tenant_id: tenant.id,
      plan_tier: 'ENTERPRISE',
      status: 'ACTIVE',
      current_period_start: now,
      current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      trial_ends_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      cancel_at_period_end: false
    }, { transaction });

    // 2. Create Core Departments for Tenant
    const defaultDepartments = [
      { code: 'DEPT-ENG', name: 'Engineering & Technology', quarterly_budget: 1000000.00 },
      { code: 'DEPT-HR', name: 'Human Resources', quarterly_budget: 300000.00 },
      { code: 'DEPT-FIN', name: 'Finance & Accounts', quarterly_budget: 400000.00 },
      { code: 'DEPT-PROC', name: 'Procurement & Logistics', quarterly_budget: 600000.00 }
    ];

    const createdDepts = await Promise.all(
      defaultDepartments.map((d) =>
        Department.create({ ...d, tenant_id: tenant.id }, { transaction })
      )
    );

    // 3. Resolve Company Admin Role (Role 6, or fallback to Super Admin)
    const companyAdminRole = await Role.findOne({ where: { name: 'COMPANY_ADMIN' }, transaction }) ||
                             await Role.findOne({ where: { name: 'SUPER_ADMIN' }, transaction });

    // 4. Create Initial Company Administrator User
    const passwordHash = await bcrypt.hash(String(admin_password), 10);
    const user = await User.create({
      tenant_id: tenant.id,
      email: normalizedEmail,
      password_hash: passwordHash,
      first_name: admin_first_name,
      last_name: admin_last_name,
      role_id: companyAdminRole?.id || 1,
      department_id: createdDepts[0].id,
      is_active: true
    }, { transaction });

    await transaction.commit();

    // Auto-login newly created company administrator
    const userWithRole = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'role' }, { model: Department, as: 'department' }]
    });

    const accessToken = generateAccessToken(userWithRole);
    const refreshToken = await issueRefreshToken(user.id);

    res.status(201).json({
      success: true,
      message: `Company '${company_name}' successfully onboarded with dedicated tenant isolation.`,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status
      },
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: companyAdminRole?.name || 'COMPANY_ADMIN'
      },
      access_token: accessToken,
      refresh_token: refreshToken
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Onboard company error:', error);
    res.status(500).json({ success: false, error: 'Failed to onboard new company tenant.' });
  }
};

export const getCurrentTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      res.status(404).json({ success: false, error: 'No active tenant context found for session.' });
      return;
    }

    const tenant = await Tenant.findByPk(tenantId, {
      include: [
        { model: Department, as: 'departments', attributes: ['id', 'code', 'name', 'quarterly_budget'] }
      ]
    });

    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant record not found.' });
      return;
    }

    res.status(200).json({ success: true, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error retrieving current tenant.' });
  }
};

export const inviteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).tenantId;
    const { email, role_name } = req.body;

    if (!email || !role_name) {
      res.status(400).json({ success: false, error: 'Email and role_name are required.' });
      return;
    }

    // Security check: Company Admin cannot invite a PLATFORM_ADMIN
    if (role_name === 'PLATFORM_ADMIN') {
      res.status(403).json({ success: false, error: 'Cannot invite platform administrators through tenant portal.' });
      return;
    }

    const role = await Role.findOne({ where: { name: role_name } });
    if (!role) {
      res.status(400).json({ success: false, error: `Invalid role '${role_name}'.` });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(409).json({ success: false, error: 'User is already registered.' });
      return;
    }

    // Create cryptographically secure invitation token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await TenantInvitation.create({
      tenant_id: tenantId,
      email: normalizedEmail,
      role_id: role.id,
      token_hash: tokenHash,
      expires_at: expiresAt
    });

    res.status(201).json({
      success: true,
      message: `Invitation issued for ${normalizedEmail}.`,
      invitation_token: rawToken,
      expires_at: expiresAt
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error creating user invitation.' });
  }
};

export const acceptInvite = async (req: Request, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();
  try {
    const { token, password, first_name, last_name } = req.body;

    if (!token || !password || !first_name || !last_name) {
      await transaction.rollback();
      res.status(400).json({ success: false, error: 'Token, password, first_name, and last_name are required.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const invitation = await TenantInvitation.findOne({
      where: { token_hash: tokenHash },
      transaction
    });

    if (!invitation) {
      await transaction.rollback();
      res.status(404).json({ success: false, error: 'Invalid invitation token.' });
      return;
    }

    if (invitation.accepted_at !== null) {
      await transaction.rollback();
      res.status(400).json({ success: false, error: 'Invitation has already been used.' });
      return;
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await transaction.rollback();
      res.status(410).json({ success: false, error: 'Invitation token has expired.' });
      return;
    }

    const tenant = await Tenant.findByPk(invitation.tenant_id, { transaction });
    if (!tenant || tenant.status === 'SUSPENDED') {
      await transaction.rollback();
      res.status(403).json({ success: false, error: 'Cannot accept invite for inactive or suspended company.' });
      return;
    }

    // Default department for tenant
    const dept = await Department.findOne({ where: { tenant_id: tenant.id }, transaction });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      tenant_id: tenant.id,
      email: invitation.email,
      password_hash: passwordHash,
      first_name,
      last_name,
      role_id: invitation.role_id,
      department_id: dept?.id || null,
      is_active: true
    }, { transaction });

    invitation.accepted_at = new Date();
    await invitation.save({ transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully. You can now login.',
      user: {
        id: user.id,
        email: user.email,
        tenant_id: tenant.id
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, error: 'Error processing invitation acceptance.' });
  }
};
