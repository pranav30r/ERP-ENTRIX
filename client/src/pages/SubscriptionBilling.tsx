import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Check,
  HardDrive,
  Users,
  Download,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { formatDateTime, formatCurrency } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { IconButton } from '../components/ui/IconButton';
import { StatusPill } from '../components/ui/StatusPill';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { TestDataToggle } from '../components/ui/TestDataToggle';
import { useTestDataToggle } from '../hooks/useTestDataToggle';
import { isTestRecord } from '../lib/testData';

const PLAN_TIER_RANK: Record<string, number> = {
  FREE: 0,
  STARTER: 1,
  GROWTH: 2,
  ENTERPRISE: 3,
};

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
  const [confirmCancelAutoRenew, setConfirmCancelAutoRenew] = useState(false);
  const [pendingPlanSwitch, setPendingPlanSwitch] = useState<string | null>(null);

  const { showTestData, toggle: toggleTestData } = useTestDataToggle();
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [invoicePage, setInvoicePage] = useState(1);
  const pageSize = 12;

  const hiddenInvoiceTestCount = useMemo(() => {
    return invoices.filter(inv => isTestRecord(inv.invoice_number)).length;
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (!showTestData && isTestRecord(inv.invoice_number)) {
        return false;
      }
      if (statusFilter !== 'All' && inv.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      return true;
    });
  }, [invoices, showTestData, statusFilter]);

  const paginatedInvoices = useMemo(() => {
    const start = (invoicePage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, invoicePage, pageSize]);

  useEffect(() => {
    setInvoicePage(1);
  }, [statusFilter, showTestData]);

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
              <div class="meta">Billing Period: ${formatDateTime(inv.period_start)} to ${formatDateTime(inv.period_end)}</div>
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
    document.title = 'Plans & Billing | ENTRIX ERP';
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
      <PageHeader
        title="Plans & Subscription Management"
        subtitle="Monitor your organization plan status, resource allocations, metered operations, and invoice records."
        actions={
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Billing Enabled
            </span>
          </div>
        }
      />

      {notification && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-xs font-semibold hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Active Subscription Banner */}
      <div className="bg-surface rounded-lg border border-border p-6 shadow-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-text">
                {currentPlan?.name || 'ENTRIX ERP Plan'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  sub?.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : sub?.status === 'TRIALING'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {sub?.status || 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-muted">
              {sub?.cancel_at_period_end
                ? `Expires on ${formatDateTime(sub.current_period_end)} (Auto-renew disabled)`
                : `Next billing date: ${formatDateTime(sub?.current_period_end || Date.now())}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (sub?.cancel_at_period_end) {
                  handleToggleAutoRenew();
                } else {
                  setConfirmCancelAutoRenew(true);
                }
              }}
              disabled={actionLoading}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                sub?.cancel_at_period_end
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                  : 'bg-surface text-slate-700 border-border hover:bg-surface-2'
              }`}
            >
              {sub?.cancel_at_period_end ? 'Resume Auto-Renew' : 'Cancel Auto-Renew'}
            </button>
          </div>
        </div>

        {/* Resource Metering */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-border">
          {/* Seats Meter */}
          <div className="p-4 rounded-lg bg-surface-2 border border-border">
            <div className="flex items-center justify-between text-xs text-muted mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-indigo-500" /> Active Users
              </span>
              <span className="font-semibold text-text">
                {usage?.activeUsers} / {usage && usage.maxUsers >= 999999 ? '∞' : usage?.maxUsers}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.min(100, ((usage?.activeUsers || 0) / (usage?.maxUsers || 1)) * 100)}%`
                }}
              />
            </div>
          </div>

          {/* AI Operation Meter */}
          <div className="p-4 rounded-lg bg-surface-2 border border-border">
            <div className="flex items-center justify-between text-xs text-muted mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Monthly AI Ops
              </span>
              <span className="font-semibold text-text">
                {usage?.aiInferences} / {usage && usage.maxAiInferences >= 999999 ? '∞' : usage?.maxAiInferences}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
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
          <div className="p-4 rounded-lg bg-surface-2 border border-border">
            <div className="flex items-center justify-between text-xs text-muted mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-indigo-500" /> Vault Storage
              </span>
              <span className="font-semibold text-text">
                {usage?.storageMB} MB / {(usage?.maxStorageMB || 0) / 1024 >= 1 ? `${(usage?.maxStorageMB || 0) / 1024} GB` : `${usage?.maxStorageMB} MB`}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
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
          <h2 className="text-lg font-bold text-slate-900">Available Subscription Tiers</h2>
          <p className="text-xs text-slate-500">
            Choose a plan. Changes apply immediately.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => {
            const isCurrent = sub?.plan_tier.toUpperCase() === p.tier.toUpperCase();
            const currentRank = PLAN_TIER_RANK[sub?.plan_tier.toUpperCase() || 'FREE'] ?? 0;
            const targetRank = PLAN_TIER_RANK[p.tier.toUpperCase()] ?? 0;
            const isUpgrade = targetRank > currentRank;
            const buttonLabel = isCurrent
              ? 'Current Plan'
              : actionLoading
              ? 'Processing...'
              : isUpgrade
              ? `Upgrade to ${p.name}`
              : `Downgrade to ${p.name}`;

            return (
              <div
                key={p.tier}
                className={`rounded-xl border p-6 flex flex-col justify-between transition-all bg-white ${
                  isCurrent
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-base text-slate-900">{p.name}</h3>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 mb-4 h-10">{p.tagline}</p>

                  <div className="mb-6">
                    <span className="text-2xl font-extrabold text-slate-900">
                      ₹{p.priceMonthlyINR.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500"> / month</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-600 mb-6">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => setPendingPlanSwitch(p.tier)}
                  disabled={isCurrent || actionLoading}
                  className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20'
                  }`}
                >
                  {buttonLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subscription Invoices Table */}
      <div className="space-y-4">
        {/* Status Filter & Test Data Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-slate-500">Invoice Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Invoices</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <TestDataToggle
            showTestData={showTestData}
            onToggle={toggleTestData}
            hiddenCount={hiddenInvoiceTestCount}
          />
        </div>

        <DataTable<Invoice>
          columns={[
            {
              key: 'invoice_number',
              header: 'Invoice Number',
              render: (inv) => (
                <span className="font-mono text-xs font-semibold text-indigo-600">
                  {inv.invoice_number}
                </span>
              )
            },
            {
              key: 'period',
              header: 'Billing Period',
              render: (inv) => (
                <span className="text-xs text-slate-600">
                  {formatDateTime(inv.period_start)} &ndash; {formatDateTime(inv.period_end)}
                </span>
              )
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              render: (inv) => (
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {formatCurrency(Number(inv.amount_paid))}
                </span>
              )
            },
            {
              key: 'status',
              header: 'Status',
              render: (inv) => {
                const variant =
                  inv.status.toUpperCase() === 'PAID' ? 'success' :
                  inv.status.toUpperCase() === 'PENDING' ? 'warning' : 'danger';
                return <StatusPill variant={variant}>{inv.status}</StatusPill>;
              }
            },
            {
              key: 'receipt',
              header: 'Receipt',
              align: 'right',
              render: (inv) => (
                <IconButton
                  icon={Download}
                  tooltip="View & download electronic receipt"
                  aria-label={`View receipt for invoice ${inv.invoice_number}`}
                  variant="ghost"
                  onClick={() => handleDownloadInvoice(inv)}
                />
              )
            }
          ]}
          rows={paginatedInvoices}
          rowKey={(inv) => inv.id}
          loading={loading}
          pagination={{
            page: invoicePage,
            pageSize,
            total: filteredInvoices.length,
            onPageChange: setInvoicePage
          }}
          emptyState={
            <EmptyState
              icon={CreditCard}
              title="No billing invoices found"
              description={
                statusFilter !== 'All' || !showTestData
                  ? "No billing records match the selected status filter."
                  : "Invoices will be recorded when subscription cycles renew."
              }
              action={
                statusFilter !== 'All' ? (
                  <Button variant="outline" size="sm" onClick={() => setStatusFilter('All')}>
                    Show all invoices
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </div>

      {/* Confirm Cancel Auto-Renew Modal */}
      <ConfirmDialog
        open={confirmCancelAutoRenew}
        onCancel={() => setConfirmCancelAutoRenew(false)}
        title="Confirm Cancellation of Auto-Renew"
        description="Are you sure you want to cancel auto-renewal? Your current subscription benefits remain active until the end of this billing cycle, after which your account will revert to the Free tier."
        confirmLabel="Cancel Auto-Renew"
        cancelLabel="Keep Auto-Renew"
        variant="danger"
        loading={actionLoading}
        onConfirm={async () => {
          setConfirmCancelAutoRenew(false);
          await handleToggleAutoRenew();
        }}
      />

      {/* Confirm Plan Switch / Downgrade Modal */}
      <ConfirmDialog
        open={Boolean(pendingPlanSwitch)}
        onCancel={() => setPendingPlanSwitch(null)}
        title={`Confirm Subscription Change to ${pendingPlanSwitch}`}
        description={`Are you sure you want to change your organization plan to ${pendingPlanSwitch}? Your feature access and resource limits will immediately adapt to this tier.`}
        confirmLabel={actionLoading ? 'Processing...' : 'Confirm Plan Switch'}
        cancelLabel="Cancel"
        variant={
          (PLAN_TIER_RANK[pendingPlanSwitch || 'FREE'] ?? 0) <
          (PLAN_TIER_RANK[sub?.plan_tier.toUpperCase() || 'FREE'] ?? 0)
            ? 'danger'
            : 'default'
        }
        loading={actionLoading}
        onConfirm={async () => {
          const target = pendingPlanSwitch;
          setPendingPlanSwitch(null);
          if (target) await handleSelectPlan(target);
        }}
      />
    </div>
  );
};

export default SubscriptionBilling;
