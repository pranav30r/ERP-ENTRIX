import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, FileText, ArrowDownLeft, Info, BookOpen } from 'lucide-react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Tooltip } from '../components/ui/Tooltip';
import { StatusPill } from '../components/ui/StatusPill';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDateTime, formatCurrency } from '../lib/format';

export const Finance: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'RECEIVABLES'>('LEDGER');
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total_debits: 0, total_credits: 0, is_balanced: true });
  const [arSummary, setArSummary] = useState({ total_invoiced: 0, total_collected: 0, outstanding_balance: 0, recent_transactions: [] as any[] });
  const [loading, setLoading] = useState(true);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);

  // Modals state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ customer_name: '', invoice_number: '', amount: '', description: '' });
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ customer_name: '', invoice_number: '', amount: '', payment_method: 'BANK_TRANSFER' });
  const [receiptLoading, setReceiptLoading] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [ledgerPage, setLedgerPage] = useState(1);
  const [arPage, setArPage] = useState(1);
  const pageSize = 25;

  const paginatedEntries = useMemo(() => {
    const start = (ledgerPage - 1) * pageSize;
    return entries.slice(start, start + pageSize);
  }, [entries, ledgerPage, pageSize]);

  const paginatedArTransactions = useMemo(() => {
    const start = (arPage - 1) * pageSize;
    return (arSummary.recent_transactions || []).slice(start, start + pageSize);
  }, [arSummary.recent_transactions, arPage, pageSize]);

  const fetchLedger = async () => {
    setLoading(true);
    setForbiddenError(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.get('/finance/ledger');
      if (res.data.success && Array.isArray(res.data.data)) {
        setEntries(res.data.data);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }

      // Also fetch AR summary
      const arRes = await apiClient.get('/finance/receivables');
      if (arRes.data.success && arRes.data.data) {
        setArSummary(arRes.data.data);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setForbiddenError(err.response?.data?.error || 'Access Forbidden. Role does not have permission to view financial ledger.');
      } else {
        console.error('Failed to load ledger postings:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvoiceLoading(true);
    setFeedbackMsg(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/finance/sales-invoice', {
        ...invoiceForm,
        amount: Number(invoiceForm.amount)
      });
      if (res.data.success) {
        setFeedbackMsg({ type: 'success', text: res.data.message });
        setShowInvoiceModal(false);
        setInvoiceForm({ customer_name: '', invoice_number: '', amount: '', description: '' });
        await fetchLedger();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.error || 'Failed to issue sales invoice.' });
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleRecordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiptLoading(true);
    setFeedbackMsg(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/finance/customer-receipt', {
        ...receiptForm,
        amount: Number(receiptForm.amount)
      });
      if (res.data.success) {
        setFeedbackMsg({ type: 'success', text: res.data.message });
        setShowReceiptModal(false);
        setReceiptForm({ customer_name: '', invoice_number: '', amount: '', payment_method: 'BANK_TRANSFER' });
        await fetchLedger();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.error || 'Failed to record customer receipt.' });
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & General Ledger"
        subtitle="Double-entry journal with balanced debits and credits"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchLedger} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold ${
              summary.is_balanced 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {summary.is_balanced ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Ledger Balanced (Zero Discrepancy)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Imbalance Detected</span>
                </>
              )}
            </div>
          </div>
        }
      />

      {feedbackMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-bold uppercase underline">Dismiss</button>
        </div>
      )}

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'LEDGER'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          General Ledger Journal
        </button>
        <button
          onClick={() => setActiveTab('RECEIVABLES')}
          className={`pb-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'RECEIVABLES'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Accounts Receivable (Sales & Receipts)
        </button>
      </div>

      {forbiddenError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            403
          </div>
          <h3 className="text-sm font-bold text-slate-800">Access Restricted (RBAC Policy Enforced)</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">{forbiddenError}</p>
          <span className="text-[11px] text-slate-400 block">Switch to Finance Officer or Super Admin in the top-right header to view ledgers.</span>
        </div>
      ) : activeTab === 'LEDGER' ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
              <div className="flex items-center justify-between text-xs text-muted mb-1">
                <div className="flex items-center gap-1.5">
                  <span>Total Debits Posted</span>
                  <Tooltip content="Source: PostgreSQL ledger">
                    <Info className="w-3.5 h-3.5 text-muted cursor-pointer" aria-label="Debits source info" />
                  </Tooltip>
                </div>
              </div>
              <div className="text-3xl font-bold text-text font-mono">
                ₹{summary.total_debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
              <div className="flex items-center justify-between text-xs text-muted mb-1">
                <div className="flex items-center gap-1.5">
                  <span>Total Credits Posted</span>
                  <Tooltip content="Source: PostgreSQL ledger">
                    <Info className="w-3.5 h-3.5 text-muted cursor-pointer" aria-label="Credits source info" />
                  </Tooltip>
                </div>
              </div>
              <div className="text-3xl font-bold text-text font-mono">
                ₹{summary.total_credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <DataTable<any>
            columns={[
              {
                key: 'id',
                header: 'Entry ID',
                render: (item) => <span className="font-mono font-bold text-slate-900">#{item.id}</span>
              },
              {
                key: 'account_code',
                header: 'General Ledger Account',
                render: (item) => <span className="font-semibold text-slate-800">{item.account_code}</span>
              },
              {
                key: 'reference_type',
                header: 'Reference',
                render: (item) => <span className="text-slate-500">{item.reference_type || 'N/A'}</span>
              },
              {
                key: 'debit_amount',
                header: 'Debit (₹)',
                align: 'right',
                render: (item) => (
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {Number(item.debit_amount) > 0 ? formatCurrency(Number(item.debit_amount)) : '—'}
                  </span>
                )
              },
              {
                key: 'credit_amount',
                header: 'Credit (₹)',
                align: 'right',
                render: (item) => (
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {Number(item.credit_amount) > 0 ? formatCurrency(Number(item.credit_amount)) : '—'}
                  </span>
                )
              },
              {
                key: 'posted_at',
                header: 'Posted At',
                align: 'right',
                render: (item) => (
                  <span className="text-slate-500 font-sans text-xs">
                    {formatDateTime(item.posted_at)}
                  </span>
                )
              }
            ]}
            rows={paginatedEntries}
            rowKey={(item) => item.id}
            loading={loading}
            rowClassName={(_row, index) => (index > 0 && index % 2 === 0 ? 'border-t-2 border-slate-300' : '')}
            pagination={{
              page: ledgerPage,
              pageSize,
              total: entries.length,
              onPageChange: setLedgerPage,
              showJumps: true
            }}
            footer={
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs w-full">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-500">Ledger Status:</span>
                  {summary.is_balanced ? (
                    <StatusPill variant="success">Balanced</StatusPill>
                  ) : (
                    <StatusPill variant="danger">Out of balance</StatusPill>
                  )}
                </div>
                <div className="flex items-center gap-6 font-mono">
                  <div>
                    <span className="text-slate-500 mr-2">Total Debits:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(summary.total_debits)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 mr-2">Total Credits:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(summary.total_credits)}</span>
                  </div>
                </div>
              </div>
            }
            emptyState={
              <EmptyState
                icon={BookOpen}
                title="No ledger entries posted"
                description="Financial transactions and requisitions will automatically post double-entry records here."
              />
            }
          />
        </>
      ) : (
        /* ACCOUNTS RECEIVABLE TAB */
        <>
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface rounded-lg border border-border shadow-card">
            <div>
              <h3 className="text-sm font-bold text-text">Customer Sales & Invoicing</h3>
              <p className="text-xs text-muted">Issue outbound customer invoices and record bank receipt payments</p>
            </div>
            <div className="flex items-center gap-2.5">
              <Button size="sm" onClick={() => setShowInvoiceModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <FileText className="w-4 h-4 mr-1.5" />
                Issue Sales Invoice
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowReceiptModal(true)} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <ArrowDownLeft className="w-4 h-4 mr-1.5" />
                Record Payment Receipt
              </Button>
            </div>
          </div>

          {/* 3 AR Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Total Billed (Dr 1100)
              </div>
              <div className="text-2xl font-bold text-text font-mono">
                ₹{Number(arSummary.total_invoiced).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-xs text-slate-400">Sales Invoices Issued</div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Total Collected (Cr 1100)
              </div>
              <div className="text-2xl font-bold text-emerald-600 font-mono">
                ₹{Number(arSummary.total_collected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-xs text-slate-400">Cash Received in Bank</div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-5 shadow-card">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Outstanding Balance
              </div>
              <div className="text-2xl font-bold text-indigo-600 font-mono">
                ₹{Number(arSummary.outstanding_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-xs text-slate-400">Net Pending Collections</div>
            </div>
          </div>

          {/* AR Ledger Postings Table */}
          <DataTable<any>
            columns={[
              {
                key: 'id',
                header: 'Entry ID',
                render: (tx) => <span className="font-mono font-bold text-slate-900">#{tx.id}</span>
              },
              {
                key: 'reference_type',
                header: 'Type',
                render: (tx) => (
                  <StatusPill variant={tx.reference_type === 'CUSTOMER_INVOICE' ? 'info' : 'success'}>
                    {tx.reference_type}
                  </StatusPill>
                )
              },
              {
                key: 'debit_amount',
                header: 'Debit (Invoiced)',
                align: 'right',
                render: (tx) => (
                  <span className="font-mono font-bold text-indigo-600 tabular-nums">
                    {Number(tx.debit_amount) > 0 ? formatCurrency(Number(tx.debit_amount)) : '—'}
                  </span>
                )
              },
              {
                key: 'credit_amount',
                header: 'Credit (Collected)',
                align: 'right',
                render: (tx) => (
                  <span className="font-mono font-bold text-emerald-600 tabular-nums">
                    {Number(tx.credit_amount) > 0 ? formatCurrency(Number(tx.credit_amount)) : '—'}
                  </span>
                )
              },
              {
                key: 'posted_at',
                header: 'Transaction Date',
                align: 'right',
                render: (tx) => (
                  <span className="text-slate-500 font-sans text-xs">
                    {formatDateTime(tx.posted_at)}
                  </span>
                )
              }
            ]}
            rows={paginatedArTransactions}
            rowKey={(tx) => tx.id}
            loading={loading}
            pagination={{
              page: arPage,
              pageSize,
              total: arSummary.recent_transactions?.length || 0,
              onPageChange: setArPage,
              showJumps: true
            }}
            emptyState={
              <EmptyState
                icon={FileText}
                title="No customer receivables recorded yet"
                description="Issue customer invoices or log payment receipts to track AR cash flows."
              />
            }
          />
        </>
      )}

      {/* Modal 1: Issue Customer Sales Invoice */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-lg border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-text">Issue Customer Sales Invoice</h3>
              <button onClick={() => setShowInvoiceModal(false)} className="text-muted hover:text-text font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={invoiceForm.customer_name}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })}
                  placeholder="e.g. Acme Aerospace Ltd"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface text-text"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Invoice Number *</label>
                <input
                  type="text"
                  required
                  value={invoiceForm.invoice_number}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                  placeholder="e.g. INV-CUST-2026-0042"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface text-text"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                  placeholder="e.g. 50000.00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface text-text"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Description</label>
                <input
                  type="text"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  placeholder="e.g. Manufacturing components supply batch #1"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface text-text"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button type="button" variant="outline" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
                <Button type="submit" disabled={invoiceLoading} className="bg-indigo-600 text-white hover:bg-indigo-700">
                  {invoiceLoading ? 'Posting...' : 'Post Sales Invoice'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Record Customer Payment Receipt */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-lg border border-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-text">Record Customer Payment Receipt</h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-muted hover:text-text font-bold">&times;</button>
            </div>
            <form onSubmit={handleRecordReceipt} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Customer Name</label>
                <input
                  type="text"
                  value={receiptForm.customer_name}
                  onChange={(e) => setReceiptForm({ ...receiptForm, customer_name: e.target.value })}
                  placeholder="e.g. Acme Aerospace Ltd"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface text-text"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Invoice Reference *</label>
                <input
                  type="text"
                  required
                  value={receiptForm.invoice_number}
                  onChange={(e) => setReceiptForm({ ...receiptForm, invoice_number: e.target.value })}
                  placeholder="e.g. INV-CUST-2026-0042"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface text-text"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Amount Collected (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  value={receiptForm.amount}
                  onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                  placeholder="e.g. 50000.00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface text-text"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Payment Method</label>
                <select
                  value={receiptForm.payment_method}
                  onChange={(e) => setReceiptForm({ ...receiptForm, payment_method: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-surface text-text"
                >
                  <option value="BANK_TRANSFER">Bank Wire / NEFT / RTGS</option>
                  <option value="UPI">UPI Instant Payment</option>
                  <option value="CREDIT_CARD">Credit Card / Gateway</option>
                  <option value="CHEQUE">Corporate Cheque</option>
                </select>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button type="button" variant="outline" onClick={() => setShowReceiptModal(false)}>Cancel</Button>
                <Button type="submit" disabled={receiptLoading} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  {receiptLoading ? 'Recording...' : 'Record Payment in Bank'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
