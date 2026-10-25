import { BillingProviderInterface, CheckoutSessionParams, CheckoutSessionResult, WebhookEventPayload } from './types';
import crypto from 'crypto';

/**
 * Deterministic ₹0 Mock Billing Adapter for local development and academic testing.
 * Implements Stripe/Razorpay lifecycle conventions without external network calls or fees.
 */
export class MockBillingAdapter implements BillingProviderInterface {
  private readonly secretKey = 'mock_whsec_entrix_saas_development';

  public async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const sessionId = `cs_mock_${crypto.randomBytes(12).toString('hex')}`;
    const redirectHost = process.env.CLIENT_URL || 'http://localhost:5173';
    const checkoutUrl = `${redirectHost}/settings/billing?session_id=${sessionId}&plan=${params.targetPlan}&mock_checkout=true`;

    return {
      sessionId,
      checkoutUrl,
      provider: 'MOCK'
    };
  }

  public verifyWebhookSignature(payload: string | object, signature?: string): boolean {
    const isProduction = process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_BILLING !== 'true';
    const secret = process.env.STRIPE_WEBHOOK_SECRET || process.env.BILLING_WEBHOOK_SECRET || this.secretKey;

    if (isProduction) {
      if (!signature) return false;
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
      try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expected, 'hex');
        return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
      } catch {
        return false;
      }
    }

    // In local development or pilot simulation mode
    if (!signature || signature === 'mock_valid') return true;

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    return signature === expected;
  }

  public parseWebhookEvent(payload: any): WebhookEventPayload {
    return {
      id: payload.id || `evt_mock_${Date.now()}`,
      type: payload.type || 'checkout.completed',
      tenantId: payload.tenantId,
      planTier: payload.planTier,
      amount: payload.amount || 0,
      currency: payload.currency || 'INR',
      externalInvoiceId: payload.externalInvoiceId,
      timestamp: payload.timestamp || new Date().toISOString()
    };
  }
}

export const billingAdapter = new MockBillingAdapter();
