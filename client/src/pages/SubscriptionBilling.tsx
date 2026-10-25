import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Check,
  HardDrive,
  Users,
  Download,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { API_BASE_URL } from '../services/api';

interface Plan {
  tier: string;
  name: string;
  tagline: string;
  priceMonthlyINR: number;
  maxUsers: number;
  maxStorageMB: number;
  maxMonthlyAiInferences: number;
  allowedModules: string[];
  features: string[];
  supportTier: string;
}

interface SubscriptionDetails {
  subscription: {
    id: string;
    tenant_id: string;
    plan_tier: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    trial_ends_at: string | null;
    cancel_at_period_end: boolean;
  };
  entitlement: Plan;
  usage: {
    activeUsers: number;
    maxUsers: number;
    aiInferences: number;
    maxAiInferences: number;
    storageMB: number;
    maxStorageMB: number;
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  period_start: string;
  period_end: string;
  hosted_invoice_url: string;
}

export const SubscriptionBilling: React.FC = () => {
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleDownloadInvoice = (inv: Invoice) => {
    if (inv.hosted_invoice_url && !inv.hosted_invoice_url.includes('.local')) {
      window.open(inv.hosted_invoice_url, '_blank', 'noopener,noreferrer');
    } else {
      const receiptWindow = window.open('', '_blank');
      if (receiptWindow) {
        receiptWindow.document.write(`
          <html>
            <head>
              <title>Invoice #${inv.invoice_number} - ENTRIX ERP</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
                .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }
                .title { font-size: 24px; font-weight: bold; color: #0f172a; }
                .meta { font-size: 14px; margin: 8px 0; }
                .amount { font-size: 28px; font-weight: 800; color: #4338ca; margin: 20px 0; }
                .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #ecfdf5; color: #047857; font-weight: 600; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="header">
                <div>
                  <div class="title">ENTRIX ERP Receipt</div>
                  <div class="meta">Invoice No: <strong>${inv.invoice_number}</strong></div>
                </div>
                <div>
                  <span class="status">${inv.status}</span>
                </div>
              </div>
              <div class="meta">Billing Period: ${new Date(inv.period_start).toLocaleDateString()} to ${new Date(inv.period_end).toLocaleDateString()}</div>
              <div class="amount">₹${Number(inv.amount_paid).toLocaleString()} ${inv.currency}</div>
              <p style="font-size: 12px; color: #64748b;">This is a system-generated electronic receipt for ENTRIX Enterprise SaaS.</p>
              <script>window.onload = function() { window.print(); };</script>
            </body>
          </html>
        `);
        receiptWindow.document.close();
      }
    }
  };

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('entrix_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };

      const [statusRes, plansRes, invRes] = await Promise.all([
        fetch(`${API_BASE_URL}/subscriptions/status`, { headers }),
        fetch(`${API_BASE_URL}/subscriptions/plans`),
        fetch(`${API_BASE_URL}/subscriptions/invoices`, { headers })
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setDetails(data);
      }
      if (plansRes.ok) {
        const pData = await plansRes.json();
        setPlans(pData.plans || []);
      }
      if (invRes.ok) {
        const iData = await invRes.json();
        setInvoices(iData.invoices || []);
      }
    } catch (err) {
      console.error('Failed to load billing information:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleSelectPlan = async (targetTier: string) => {
    if (!details) return;
    if (targetTier.toUpperCase() === details.subscription.plan_tier.toUpperCase()) return;

    try {
      setActionLoading(true);
      const token = localStorage.getItem('entrix_token') || localStorage.getItem('token') || localStorage.getItem('access_token');

      // 1. Initiate checkout session
      const checkoutRes = await fetch(`${API_BASE_URL}/subscriptions/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ planTier: targetTier })
      });

      if (!checkoutRes.ok) {
        const err = await checkoutRes.json();
        throw new Error(err.error || 'Failed to start checkout session');
      }

      // 2. Mock payment confirmation via simulated webhook for local ₹0 execution
      const webhookRes = await fetch(`${API_BASE_URL}/subscriptions/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-billing-signature': 'mock_valid'
        },
        body: JSON.stringify({
          id: `evt_mock_${Date.now()}`,
          type: 'checkout.completed',
          tenantId: details.subscription.tenant_id,
          planTier: targetTier,
          amount: plans.find((p) => p.tier === targetTier)?.priceMonthlyINR || 0,
          currency: 'INR'
        })
      });

      if (webhookRes.ok) {
        setNotification({
          type: 'success',
          message: `Plan successfully upgraded to ${targetTier}! Entitlements and invoices have been refreshed.`
        });
        await fetchBillingData();
      } else {
        throw new Error('Payment confirmation failed');
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Subscription change failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!details) return;
    const isCurrentlyCanceling = details.subscription.cancel_at_period_end;
    const endpoint = isCurrentlyCanceling
      ? `${API_BASE_URL}/subscriptions/resume`
      : `${API_BASE_URL}/subscriptions/cancel`;

    try {
      setActionLoading(true);
      const token = localStorage.getItem('entrix_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        setNotification({
          type: 'success',
          message: isCurrentlyCanceling
            ? 'Auto-renewal has been successfully resumed.'
            : 'Auto-renewal canceled. Access remains active until period end.'
        });
        await fetchBillingData();
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to update renewal preference.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const sub = details?.subscription;
  const currentPlan = details?.entitlement;
  const usage = details?.usage;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Plans & Monetization Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
              Sandbox Simulation Mode (Zero Cost)
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-charcoal-300">
            Monitor your subscription status, resource allocations, metered operations, and invoice records.
          </p>
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-xs font-semibold hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Active Subscription Banner */}
      <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-charcoal-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {currentPlan?.name || 'ENTRIX ERP Plan'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  sub?.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                    : sub?.status === 'TRIALING'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                }`}
              >
                {sub?.status || 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-charcoal-400">
              {sub?.cancel_at_period_end
                ? `Expires on ${new Date(sub.current_period_end).toLocaleDateString()} (Auto-renew disabled)`
                : `Next billing date: ${new Date(sub?.current_period_end || Date.now()).toLocaleDateString()}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAutoRenew}
              disabled={actionLoading}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                sub?.cancel_at_period_end
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                  : 'bg-white dark:bg-charcoal-800 text-slate-700 dark:text-charcoal-200 border-slate-200 dark:border-charcoal-700 hover:bg-slate-50'
              }`}
            >
              {sub?.cancel_at_period_end ? 'Resume Auto-Renew' : 'Cancel Auto-Renew'}
            </button>
          </div>
        </div>

        {/* Resource Metering */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100 dark:border-charcoal-800">
          {/* Seats Meter */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-charcoal-800/60 border border-slate-100 dark:border-charcoal-700/50">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-charcoal-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-indigo-500" /> Active Users
              </span>
              <span className="font-semibold text-slate-800 dark:text-white">
                {usage?.activeUsers} / {usage && usage.maxUsers >= 999999 ? '∞' : usage?.maxUsers}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-charcoal-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(100, ((usage?.activeUsers || 0) / (usage?.maxUsers || 1)) * 100)}%`
                }}
              />
            </div>
          </div>

          {/* AI Operation Meter */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-charcoal-800/60 border border-slate-100 dark:border-charcoal-700/50">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-charcoal-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Monthly AI Ops
              </span>
              <span className="font-semibold text-slate-800 dark:text-white">
                {usage?.aiInferences} / {usage && usage.maxAiInferences >= 999999 ? '∞' : usage?.maxAiInferences}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-charcoal-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    ((usage?.aiInferences || 0) / (usage?.maxAiInferences || 1)) * 100
                  )}%`
                }}
              />
            </div>
          </div>

          {/* Storage Meter */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-charcoal-800/60 border border-slate-100 dark:border-charcoal-700/50">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-charcoal-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-indigo-500" /> Vault Storage
              </span>
              <span className="font-semibold text-slate-800 dark:text-white">
                {usage?.storageMB} MB / {(usage?.maxStorageMB || 0) / 1024 >= 1 ? `${(usage?.maxStorageMB || 0) / 1024} GB` : `${usage?.maxStorageMB} MB`}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-charcoal-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    ((usage?.storageMB || 0) / (usage?.maxStorageMB || 1)) * 100
                  )}%`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Plan Matrix */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Available Subscription Tiers</h2>
          <p className="text-xs text-slate-500 dark:text-charcoal-400">
            Select a plan to immediately switch with deterministic sandbox zero-cost billing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => {
            const isCurrent = sub?.plan_tier.toUpperCase() === p.tier.toUpperCase();
            return (
              <div
                key={p.tier}
                className={`rounded-xl border p-6 flex flex-col justify-between transition-all bg-white dark:bg-charcoal-900 ${
                  isCurrent
                    ? 'border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                    : 'border-slate-200 dark:border-charcoal-800 hover:border-slate-300 dark:hover:border-charcoal-700'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">{p.name}</h3>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-charcoal-400 mb-4 h-10">{p.tagline}</p>

                  <div className="mb-6">
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                      ₹{p.priceMonthlyINR.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-charcoal-400"> / month</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-600 dark:text-charcoal-300 mb-6">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleSelectPlan(p.tier)}
                  disabled={isCurrent || actionLoading}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 dark:bg-charcoal-800 dark:text-charcoal-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : actionLoading ? 'Processing...' : `Upgrade to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subscription Invoices Table */}
      <div className="bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-charcoal-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-charcoal-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Billing History & Invoices</h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-charcoal-400">
            {invoices.length} billing cycle{invoices.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-charcoal-300">
            <thead className="bg-slate-50 dark:bg-charcoal-800/60 text-xs font-semibold text-slate-500 dark:text-charcoal-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Invoice Number</th>
                <th className="px-6 py-3">Billing Period</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-charcoal-800">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-400">
                    No billing invoices generated yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-charcoal-800/40 transition">
                    <td className="px-6 py-4 font-mono text-xs font-medium text-slate-900 dark:text-white">
                      {inv.invoice_number}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(inv.period_start).toLocaleDateString()} &ndash;{' '}
                      {new Date(inv.period_end).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-900 dark:text-white">
                      ₹{Number(inv.amount_paid).toLocaleString()} {inv.currency}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(inv)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        <Download className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionBilling;
