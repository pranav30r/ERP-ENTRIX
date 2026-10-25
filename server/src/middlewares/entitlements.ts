import { Request, Response, NextFunction } from 'express';
import { Subscription, Tenant, User, TenantUsageCounter } from '../models';
import { getPlanEntitlement, PlanTier } from '../config/plans';

/**
 * Ensures the tenant's current subscription plan allows access to the requested module.
 */
export const requireModuleEntitlement = (moduleName: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
      const roleName = user?.role_name || user?.role;

      // Global platform administrators bypass tenant module restrictions
      if (!tenantId || roleName === 'ADMIN' || roleName === 'SUPER_ADMIN' || roleName === 'PLATFORM_ADMIN') {
        return next();
      }

      // Fetch active subscription for tenant
      const subscription = await Subscription.findOne({
        where: { tenant_id: tenantId }
      });

      let rawTier = subscription?.plan_tier;
      if (!rawTier) {
        const tenant = await Tenant.findByPk(tenantId);
        rawTier = tenant?.plan || 'ENTERPRISE';
      }
      const planTier = rawTier.toUpperCase() as PlanTier;
      const entitlement = getPlanEntitlement(planTier);

      // Check lifecycle status
      if (subscription) {
        const now = new Date();
        if (subscription.status === 'SUSPENDED') {
          res.status(403).json({
            error: 'SUBSCRIPTION_SUSPENDED',
            message: 'Your organization subscription is suspended due to unpaid invoices or administrative hold.'
          });
          return;
        }

        if (subscription.status === 'CANCELED' && new Date(subscription.current_period_end) < now) {
          res.status(403).json({
            error: 'SUBSCRIPTION_EXPIRED',
            message: 'Your subscription period has expired. Please reactivate your plan to access ENTRIX.'
          });
          return;
        }
      }

      // Verify module entitlement
      const isAllowed = entitlement.allowedModules.includes(moduleName.toUpperCase());
      if (!isAllowed) {
        res.status(403).json({
          error: 'FEATURE_NOT_ENTITLED',
          message: `The '${moduleName}' module is not available on your current (${entitlement.name}) plan.`,
          currentPlan: entitlement.tier,
          requiredModule: moduleName
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[EntitlementMiddleware] Error verifying entitlement:', error);
      res.status(500).json({ error: 'Failed to verify module entitlement' });
    }
  };
};

/**
 * Enforces seat limits before a new user or member is registered/invited to a tenant.
 */
export const checkUserQuota = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    if (!tenantId) {
      return next();
    }

    const subscription = await Subscription.findOne({ where: { tenant_id: tenantId } });
    const planTier = (subscription?.plan_tier || 'STARTER').toUpperCase() as PlanTier;
    const entitlement = getPlanEntitlement(planTier);

    const currentUserCount = await User.count({
      where: {
        tenant_id: tenantId,
        is_active: true
      }
    });

    if (currentUserCount >= entitlement.maxUsers) {
      res.status(403).json({
        error: 'USER_LIMIT_REACHED',
        message: `Plan limit reached (${currentUserCount}/${entitlement.maxUsers} users). Upgrade to add more team members.`,
        currentCount: currentUserCount,
        maxAllowed: entitlement.maxUsers,
        planTier: entitlement.tier
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[EntitlementMiddleware] Error checking user quota:', error);
    res.status(500).json({ error: 'Failed to evaluate user limit quota' });
  }
};

/**
 * Rate-limits and tracks AI operations against plan quotas.
 */
export const trackAiUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    if (!tenantId) {
      return next();
    }

    const subscription = await Subscription.findOne({ where: { tenant_id: tenantId } });
    const planTier = (subscription?.plan_tier || 'STARTER').toUpperCase() as PlanTier;
    const entitlement = getPlanEntitlement(planTier);

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [counter] = await TenantUsageCounter.findOrCreate({
      where: {
        tenant_id: tenantId,
        metric_name: 'AI_INFERENCE',
        period_start: periodStart
      },
      defaults: {
        tenant_id: tenantId,
        metric_name: 'AI_INFERENCE',
        current_value: 0,
        period_start: periodStart,
        period_end: periodEnd
      }
    });

    if (counter.current_value >= entitlement.maxMonthlyAiInferences) {
      res.status(429).json({
        error: 'AI_QUOTA_EXCEEDED',
        message: `Monthly AI inference limit reached (${counter.current_value}/${entitlement.maxMonthlyAiInferences}). Upgrade plan for additional capacity.`,
        currentUsage: counter.current_value,
        quota: entitlement.maxMonthlyAiInferences
      });
      return;
    }

    // Atomically increment usage
    await counter.increment('current_value', { by: 1 });
    next();
  } catch (error) {
    console.error('[EntitlementMiddleware] Error checking AI usage:', error);
    res.status(500).json({ error: 'Failed to check AI usage limits' });
  }
};

