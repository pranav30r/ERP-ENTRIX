export interface CheckoutSessionParams {
  tenantId: string;
  targetPlan: string;
  customerEmail: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  provider: 'MOCK' | 'STRIPE' | 'RAZORPAY';
}

export interface WebhookEventPayload {
  id: string;
  type: 'checkout.completed' | 'invoice.paid' | 'invoice.payment_failed' | 'subscription.canceled';
  tenantId: string;
  planTier?: string;
  amount?: number;
  currency?: string;
  externalInvoiceId?: string;
  timestamp: string;
}

export interface BillingProviderInterface {
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;
  verifyWebhookSignature(payload: string | object, signature?: string): boolean;
  parseWebhookEvent(payload: any): WebhookEventPayload;
}
