import { sequelize } from '../../config/db';
import { Subscription, SubscriptionHistory, SubscriptionInvoice, Tenant, TenantUsageCounter, User } from '../../models';
import { PLANS, getPlanEntitlement, PlanTier } from '../../config/plans';
import { billingAdapter } from './mockBillingAdapter';
import { WebhookEventPayload } from './types';
import { Op } from 'sequelize';

export class BillingService {
  /**
   * Retrieves active subscription & entitlements for a tenant, lazily creating trial if missing.
   */
  public async getSubscription(tenantId: string) {
    let sub = await Subscription.findOne({ where: { tenant_id: tenantId } });

    if (!sub) {
      const now = new Date();
      const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      sub = await Subscription.create({
        tenant_id: tenantId,
        plan_tier: 'STARTER',
        status: 'TRIALING',
        current_period_start: now,
        current_period_end: periodEnd,
        trial_ends_at: trialEnds,
        cancel_at_period_end: false
      });
    }

    const entitlement = getPlanEntitlement(sub.plan_tier);

    // Fetch active users count
    const activeUsers = await User.count({
      where: { tenant_id: tenantId, is_active: true }
    });

    // Fetch current month AI usage
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const aiUsageCounter = await TenantUsageCounter.findOne({
      where: {
        tenant_id: tenantId,
        metric_name: 'AI_INFERENCE',
        period_start: periodStart
      }
    });

    return {
      subscription: sub,
      entitlement,
      usage: {
        activeUsers,
        maxUsers: entitlement.maxUsers,
        aiInferences: aiUsageCounter ? Number(aiUsageCounter.current_value) : 0,
        maxAiInferences: entitlement.maxMonthlyAiInferences,
        storageMB: 42, // Current estimated tenant storage
        maxStorageMB: entitlement.maxStorageMB
      }
    };
  }

  /**
   * Generates a checkout session for upgrading or changing tiers.
   */
  public async createCheckoutSession(tenantId: string, targetPlan: string, customerEmail: string) {
    const normalizedPlan = targetPlan.toUpperCase() as PlanTier;
    if (!PLANS[normalizedPlan]) {
      throw new Error(`Invalid plan tier requested: ${targetPlan}`);
    }

    return await billingAdapter.createCheckoutSession({
      tenantId,
      targetPlan: normalizedPlan,
      customerEmail
    });
  }

  /**
   * Idempotent webhook event processor supporting simulated and live events.
   */
  public async processWebhook(payload: any, signature?: string): Promise<{ success: boolean; eventType: string; duplicate?: boolean }> {
    const isValid = billingAdapter.verifyWebhookSignature(payload, signature);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const event: WebhookEventPayload = billingAdapter.parseWebhookEvent(payload);

    return await sequelize.transaction(async (t) => {
      // Idempotency guard: check if this event ID has already been recorded
      const existingHistory = await SubscriptionHistory.findOne({
        where: {
          tenant_id: event.tenantId,
          reason: { [Op.like]: `%event_id:${event.id}%` }
        },
        transaction: t
      });

      if (existingHistory) {
        return { success: true, eventType: event.type, duplicate: true };
      }

      let sub = await Subscription.findOne({ where: { tenant_id: event.tenantId }, transaction: t });
      const previousStatus = sub?.status || 'TRIALING';
      const previousPlan = sub?.plan_tier || 'STARTER';

      if (event.type === 'checkout.completed' || event.type === 'invoice.paid') {
        const targetPlan = (event.planTier || sub?.plan_tier || 'STARTER').toUpperCase();
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        if (sub) {
          await sub.update({
            status: 'ACTIVE',
            plan_tier: targetPlan,
            current_period_start: now,
            current_period_end: periodEnd,
            cancel_at_period_end: false
          }, { transaction: t });
        } else {
          sub = await Subscription.create({
            tenant_id: event.tenantId,
            status: 'ACTIVE',
            plan_tier: targetPlan,
            current_period_start: now,
            current_period_end: periodEnd,
            cancel_at_period_end: false
          }, { transaction: t });
        }

        // Record history with event_id tag for deduplication
        await SubscriptionHistory.create({
          subscription_id: sub.id,
          tenant_id: event.tenantId,
          from_status: previousStatus,
          to_status: 'ACTIVE',
          from_plan: previousPlan,
          to_plan: targetPlan,
          reason: `Payment processed: ${event.type} (event_id:${event.id})`
        }, { transaction: t });

        // Generate paid invoice record
        const invNumber = event.externalInvoiceId || `INV-ENTRIX-${Date.now().toString(36).toUpperCase()}`;
        const planCost = PLANS[targetPlan as PlanTier]?.priceMonthlyINR || event.amount || 0;

        await SubscriptionInvoice.create({
          tenant_id: event.tenantId,
          subscription_id: sub.id,
          invoice_number: invNumber,
          amount_due: planCost,
          amount_paid: planCost,
          currency: event.currency || 'INR',
          status: 'PAID',
          period_start: now,
          period_end: periodEnd,
          hosted_invoice_url: `https://billing.entrix-erp.local/invoices/${invNumber}`
        }, { transaction: t });

      } else if (event.type === 'invoice.payment_failed') {
        if (sub) {
          await sub.update({ status: 'PAST_DUE' }, { transaction: t });
          await SubscriptionHistory.create({
            subscription_id: sub.id,
            tenant_id: event.tenantId,
            from_status: previousStatus,
            to_status: 'PAST_DUE',
            from_plan: previousPlan,
            to_plan: sub.plan_tier,
            reason: `Invoice payment failed (event_id:${event.id})`
          }, { transaction: t });
        }
      } else if (event.type === 'subscription.canceled') {
        if (sub) {
          await sub.update({
            status: 'CANCELED',
            cancel_at_period_end: true,
            canceled_at: new Date()
          }, { transaction: t });
          await SubscriptionHistory.create({
            subscription_id: sub.id,
            tenant_id: event.tenantId,
            from_status: previousStatus,
            to_status: 'CANCELED',
            from_plan: previousPlan,
            to_plan: sub.plan_tier,
            reason: `Subscription canceled by customer or provider (event_id:${event.id})`
          }, { transaction: t });
        }
      }

      return { success: true, eventType: event.type };
    });
  }

  /**
   * Schedule cancellation at end of current period.
   */
  public async cancelSubscription(tenantId: string, actorId?: string) {
    const sub = await Subscription.findOne({ where: { tenant_id: tenantId } });
    if (!sub) {
      throw new Error('No subscription found for tenant');
    }

    await sub.update({
      cancel_at_period_end: true,
      canceled_at: new Date()
    });

    await SubscriptionHistory.create({
      subscription_id: sub.id,
      tenant_id: tenantId,
      from_status: sub.status,
      to_status: sub.status,
      from_plan: sub.plan_tier,
      to_plan: sub.plan_tier,
      reason: 'Scheduled cancellation at period end',
      actor_id: actorId
    });

    return sub;
  }

  /**
   * Cancel the cancellation schedule and keep active.
   */
  public async resumeSubscription(tenantId: string, actorId?: string) {
    const sub = await Subscription.findOne({ where: { tenant_id: tenantId } });
    if (!sub) {
      throw new Error('No subscription found for tenant');
    }

    await sub.update({
      cancel_at_period_end: false,
      canceled_at: null
    });

    await SubscriptionHistory.create({
      subscription_id: sub.id,
      tenant_id: tenantId,
      from_status: sub.status,
      to_status: sub.status,
      from_plan: sub.plan_tier,
      to_plan: sub.plan_tier,
      reason: 'Resumed auto-renewal',
      actor_id: actorId
    });

    return sub;
  }

  /**
   * Platform Administrator plan override with explicit audit record.
   */
  public async adminOverridePlan(tenantId: string, targetPlan: string, reason: string, actorId?: string) {
    const normalizedPlan = targetPlan.toUpperCase() as PlanTier;
    if (!PLANS[normalizedPlan]) {
      throw new Error(`Invalid plan tier requested: ${targetPlan}`);
    }

    let sub = await Subscription.findOne({ where: { tenant_id: tenantId } });
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const previousStatus = sub?.status || 'TRIALING';
    const previousPlan = sub?.plan_tier || 'STARTER';

    if (sub) {
      await sub.update({
        plan_tier: normalizedPlan,
        status: 'ACTIVE',
        current_period_start: now,
        current_period_end: periodEnd,
        cancel_at_period_end: false
      });
    } else {
      sub = await Subscription.create({
        tenant_id: tenantId,
        plan_tier: normalizedPlan,
        status: 'ACTIVE',
        current_period_start: now,
        current_period_end: periodEnd,
        cancel_at_period_end: false
      });
    }

    let validActorId: string | null = null;
    if (actorId) {
      const existingActor = await User.findByPk(actorId);
      if (existingActor) {
        validActorId = actorId;
      }
    }

    await SubscriptionHistory.create({
      subscription_id: sub.id,
      tenant_id: tenantId,
      from_status: previousStatus,
      to_status: 'ACTIVE',
      from_plan: previousPlan,
      to_plan: normalizedPlan,
      reason: `Platform Administrator Override: ${reason || 'Manual entitlement modification'}`,
      actor_id: validActorId
    });

    return sub;
  }

  /**
   * Get all SaaS subscription invoices for a tenant.
   */
  public async getInvoices(tenantId: string) {
    return await SubscriptionInvoice.findAll({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']]
    });
  }
}

export const billingService = new BillingService();
