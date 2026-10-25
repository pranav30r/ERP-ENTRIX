import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';

export const Finance: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total_debits: 0, total_credits: 0, is_balanced: true });
  const [loading, setLoading] = useState(true);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Finance & General Ledger</h2>
          <p className="text-xs text-slate-500 dark:text-charcoal-400 mt-0.5">ACID-compliant double entry accounting with balanced debit/credit audit</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLedger} disabled={loading} className="dark:border-charcoal-700 dark:text-charcoal-200">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Ledger
          </Button>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold ${
            summary.is_balanced 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800' 
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800'
          }`}>
            {summary.is_balanced ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Ledger Balanced (Zero Discrepancy)</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Imbalance Detected</span>
              </>
            )}
          </div>
        </div>
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
      ) : (
        <>
          {/* 2 Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-charcoal-400 mb-1">
            <span>Total Debits Posted</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">POSTGRESQL</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
            ₹{summary.total_debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-charcoal-400 mb-1">
            <span>Total Credits Posted</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">POSTGRESQL</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
            ₹{summary.total_credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-charcoal-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-charcoal-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Double-Entry Journal Postings</h3>
          <span className="text-xs text-slate-400 dark:text-charcoal-500 font-mono">{entries.length} PostgreSQL Records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-charcoal-800/60 border-b border-slate-200 dark:border-charcoal-800 text-slate-500 dark:text-charcoal-400 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Entry ID</th>
                <th className="py-2.5 px-4 font-semibold">General Ledger Account</th>
                <th className="py-2.5 px-4 font-semibold">Reference</th>
                <th className="py-2.5 px-4 font-semibold text-right">Debit (₹)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Credit (₹)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Posted At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-charcoal-800 text-slate-700 dark:text-charcoal-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 dark:text-charcoal-500">Loading ledger journal entries...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 dark:text-charcoal-500">No ledger entries posted.</td>
                </tr>
              ) : (
                entries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-charcoal-800/40 font-mono text-[11px]">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">#{item.id}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-800 dark:text-white">{item.account_code}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-charcoal-400 font-sans">{item.reference_type || 'N/A'}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {Number(item.debit_amount) > 0 ? `₹${Number(item.debit_amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {Number(item.credit_amount) > 0 ? `₹${Number(item.credit_amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 dark:text-charcoal-500 font-sans text-[11px]">
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
      )}
    </div>
  );
};

export default Finance;
