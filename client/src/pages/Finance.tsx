import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, FileText, ArrowDownLeft } from 'lucide-react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Finance & General Ledger</h2>
          <p className="text-sm text-slate-500 dark:text-charcoal-400 mt-0.5">ACID-compliant double entry accounting with balanced debit/credit audit</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLedger} disabled={loading} className="dark:border-charcoal-700 dark:text-charcoal-200">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold ${
            summary.is_balanced 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800' 
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800'
          }`}>
            {summary.is_balanced ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Ledger Balanced (Zero Discrepancy)</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Imbalance Detected</span>
              </>
            )}
          </div>
        </div>
      </div>

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
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-charcoal-800 pb-2">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'LEDGER'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-charcoal-400'
          }`}
        >
          General Ledger Journal
        </button>
        <button
          onClick={() => setActiveTab('RECEIVABLES')}
          className={`pb-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'RECEIVABLES'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-charcoal-400'
          }`}
        >
          Accounts Receivable (Sales & Receipts)
        </button>
      </div>

      {forbiddenError ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
            403
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">Access Restricted (RBAC Policy Enforced)</h3>
          <p className="text-xs text-slate-600 dark:text-charcoal-300 max-w-md mx-auto">{forbiddenError}</p>
          <span className="text-[11px] text-slate-400 dark:text-charcoal-500 block">Switch to Finance Officer or Super Admin in the top-right header to view ledgers.</span>
        </div>
      ) : activeTab === 'LEDGER' ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-charcoal-400 mb-1">
                <span>Total Debits Posted</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">POSTGRESQL</span>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">
                ₹{summary.total_debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-charcoal-400 mb-1">
                <span>Total Credits Posted</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">POSTGRESQL</span>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono">
                ₹{summary.total_credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-charcoal-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Double-Entry Journal Postings</h3>
              <span className="text-xs text-slate-400 dark:text-charcoal-500 font-mono">{entries.length} PostgreSQL Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-charcoal-800/60 border-b border-slate-200 dark:border-charcoal-800 text-slate-500 dark:text-charcoal-400 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Entry ID</th>
                    <th className="py-3 px-4 font-semibold">General Ledger Account</th>
                    <th className="py-3 px-4 font-semibold">Reference</th>
                    <th className="py-3 px-4 font-semibold text-right">Debit (₹)</th>
                    <th className="py-3 px-4 font-semibold text-right">Credit (₹)</th>
                    <th className="py-3 px-4 font-semibold text-right">Posted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-charcoal-800 text-slate-700 dark:text-charcoal-300">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-charcoal-500">Loading ledger journal entries...</td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-charcoal-500">No ledger entries posted.</td>
                    </tr>
                  ) : (
                    entries.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-charcoal-800/40 font-mono text-xs">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">#{item.id}</td>
                        <td className="py-3.5 px-4 font-sans font-semibold text-slate-800 dark:text-white">{item.account_code}</td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-charcoal-400 font-sans">{item.reference_type || 'N/A'}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                          {Number(item.debit_amount) > 0 ? `₹${Number(item.debit_amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                          {Number(item.credit_amount) > 0 ? `₹${Number(item.credit_amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 dark:text-charcoal-500 font-sans text-xs">
                          {new Date(item.posted_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ACCOUNTS RECEIVABLE TAB */
        <>
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-charcoal-900 rounded-xl border border-slate-200 dark:border-charcoal-800 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Customer Sales & Invoicing</h3>
              <p className="text-xs text-slate-500 dark:text-charcoal-400">Issue outbound customer invoices and record bank receipt payments</p>
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
            <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl p-5 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 dark:text-charcoal-400 uppercase tracking-wider mb-1">
                Total Billed (Dr 1100)
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                ₹{Number(arSummary.total_invoiced).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-xs text-slate-400">Sales Invoices Issued</div>
            </div>

            <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl p-5 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 dark:text-charcoal-400 uppercase tracking-wider mb-1">
                Total Collected (Cr 1100)
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{Number(arSummary.total_collected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-xs text-slate-400">Cash Received in Bank</div>
            </div>

            <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl p-5 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 dark:text-charcoal-400 uppercase tracking-wider mb-1">
                Outstanding Balance
              </div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                ₹{Number(arSummary.outstanding_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-xs text-slate-400">Net Pending Collections</div>
            </div>
          </div>

          {/* AR Ledger Postings Table */}
          <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-charcoal-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Recent Accounts Receivable Ledger Records</h3>
              <span className="text-xs text-slate-400 dark:text-charcoal-500 font-mono">{arSummary.recent_transactions.length} Transactions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-charcoal-800/60 border-b border-slate-200 dark:border-charcoal-800 text-slate-500 dark:text-charcoal-400 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Entry ID</th>
                    <th className="py-3 px-4 font-semibold">Type</th>
                    <th className="py-3 px-4 font-semibold text-right">Debit (Invoiced)</th>
                    <th className="py-3 px-4 font-semibold text-right">Credit (Collected)</th>
                    <th className="py-3 px-4 font-semibold text-right">Transaction Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-charcoal-800 text-slate-700 dark:text-charcoal-300">
                  {arSummary.recent_transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">No customer receivables recorded yet.</td>
                    </tr>
                  ) : (
                    arSummary.recent_transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-charcoal-800/40 font-mono text-xs">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">#{tx.id}</td>
                        <td className="py-3.5 px-4 font-sans font-semibold">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] ${
                            tx.reference_type === 'CUSTOMER_INVOICE' 
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {tx.reference_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-indigo-600">
                          {Number(tx.debit_amount) > 0 ? `₹${Number(tx.debit_amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                          {Number(tx.credit_amount) > 0 ? `₹${Number(tx.credit_amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 font-sans text-xs">
                          {new Date(tx.posted_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal 1: Issue Customer Sales Invoice */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-charcoal-900 rounded-2xl border border-slate-200 dark:border-charcoal-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-charcoal-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Issue Customer Sales Invoice</h3>
              <button onClick={() => setShowInvoiceModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>
            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-charcoal-300 uppercase mb-1.5">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={invoiceForm.customer_name}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })}
                  placeholder="e.g. Acme Aerospace Ltd"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-charcoal-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-charcoal-300 uppercase mb-1.5">Invoice Number *</label>
                <input
                  type="text"
                  required
                  value={invoiceForm.invoice_number}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                  placeholder="e.g. INV-CUST-2026-0042"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-charcoal-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-charcoal-300 uppercase mb-1.5">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                  placeholder="e.g. 50000.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-charcoal-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-charcoal-300 uppercase mb-1.5">Description</label>
                <input
                  type="text"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  placeholder="e.g. Manufacturing components supply batch #1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-charcoal-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-slate-900 dark:text-white"
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
          <div className="bg-white dark:bg-charcoal-900 rounded-2xl border border-slate-200 dark:border-charcoal-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-charcoal-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Record Customer Payment Receipt</h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>
            <form onSubmit={handleRecordReceipt} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-charcoal-300 uppercase mb-1.5">Customer Name</label>
                <input
                  type="text"
                  value={receiptForm.customer_name}
                  onChange={(e) => setReceiptForm({ ...receiptForm, customer_name: e.target.value })}
                  placeholder="e.g. Acme Aerospace Ltd"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-charcoal-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-charcoal-300 uppercase mb-1.5">Invoice Reference *</label>
                <input
                  type="text"
                  required
                  value={receiptForm.invoice_number}
                  onChange={(e) => setReceiptForm({ ...receiptForm, invoice_number: e.target.value })}
                  placeholder="e.g. INV-CUST-2026-0042"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-charcoal-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-charcoal-300 uppercase mb-1.5">Amount Collected (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  value={receiptForm.amount}
                  onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                  placeholder="e.g. 50000.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-charcoal-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-charcoal-300 uppercase mb-1.5">Payment Method</label>
                <select
                  value={receiptForm.payment_method}
                  onChange={(e) => setReceiptForm({ ...receiptForm, payment_method: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-charcoal-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-charcoal-900 text-slate-900 dark:text-white"
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
