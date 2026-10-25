import { Request, Response } from 'express';
import { billingService } from '../services/billing/billingService';
import { PLANS } from '../config/plans';

export const getSubscriptionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const details = await billingService.getSubscription(tenantId);
    res.json(details);
  } catch (error: any) {
    console.error('[SubscriptionController] getSubscriptionStatus error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve subscription status' });
  }
};

export const getPlansList = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      plans: Object.values(PLANS)
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve plans' });
  }
};

export const createCheckout = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    const { planTier } = req.body;

    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }
    if (!planTier) {
      res.status(400).json({ error: 'planTier is required' });
      return;
    }

    const session = await billingService.createCheckoutSession(
      tenantId,
      planTier,
      user?.email || 'admin@tenant.local'
    );

    res.json(session);
  } catch (error: any) {
    console.error('[SubscriptionController] createCheckout error:', error);
    res.status(400).json({ error: error.message || 'Failed to initialize checkout session' });
  }
};

export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const sub = await billingService.cancelSubscription(tenantId, user?.id);
    res.json({ message: 'Subscription auto-renew canceled successfully', subscription: sub });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
};

export const resumeSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const sub = await billingService.resumeSubscription(tenantId, user?.id);
    res.json({ message: 'Subscription auto-renew resumed successfully', subscription: sub });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to resume subscription' });
  }
};

export const getInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenant_id || user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant context required' });
      return;
    }

    const invoices = await billingService.getInvoices(tenantId);
    res.json({ invoices });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch invoices' });
  }
};

export const adminOverrideSubscriptionPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { tenantId, planTier, reason } = req.body;

    if (!tenantId || !planTier) {
      res.status(400).json({ error: 'tenantId and planTier are required' });
      return;
    }

    const sub = await billingService.adminOverridePlan(tenantId, planTier, reason, user?.id);
    res.json({ message: 'Plan overridden successfully by platform admin', subscription: sub });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to override plan' });
  }
};

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = (req.headers['x-billing-signature'] || req.headers['stripe-signature']) as string | undefined;
    const result = await billingService.processWebhook(req.body, signature);
    res.json(result);
  } catch (error: any) {
    console.error('[SubscriptionController] handleWebhook error:', error);
    res.status(400).json({ error: error.message || 'Webhook processing failed' });
  }
};
