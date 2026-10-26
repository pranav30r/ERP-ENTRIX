import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  Info,
  Clock,
  Plus,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { WorkflowTimeline, ProcurementStage } from '../components/WorkflowTimeline';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export const Dashboard: React.FC = () => {
  const { hasRole } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ total_items: 0, low_stock_items: 0 });
  const [recentPR, setRecentPR] = useState<any | null>(null);
  const [activeStage, setActiveStage] = useState<ProcurementStage>('PENDING_MANAGER');
  const [activeAmount, setActiveAmount] = useState<number>(24500);
  const [pendingPRCount, setPendingPRCount] = useState<number>(0);
  const [ledgerBalanced, setLedgerBalanced] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureAuthenticated();
      const promises: Promise<any>[] = [
        apiClient.get('/inventory'),
        apiClient.get('/procurement/requests')
      ];

      // If user has finance or admin rights, also query ledger status for real telemetry
      if (hasRole(['SUPER_ADMIN', 'FINANCE_OFFICER'])) {
        promises.push(apiClient.get('/finance/ledger').catch(() => null));
      }

      const [invRes, prsRes, finRes] = await Promise.all(promises);

      if (invRes && invRes.data.success) {
        setInventory(invRes.data.data || []);
        setMetrics(invRes.data.metrics || { total_items: 0, low_stock_items: 0 });
      }

      if (prsRes && prsRes.data.success && Array.isArray(prsRes.data.data)) {
        const prs = prsRes.data.data;
        const activePRs = prs.filter((p: any) => p.status !== 'PAID' && p.status !== 'REJECTED');
        setPendingPRCount(activePRs.length);

        if (prs.length > 0) {
          const latest = prs[0];
          setRecentPR(latest);
          setActiveStage(latest.status as ProcurementStage);
          setActiveAmount(Number(latest.estimated_total));
        }
      }

      if (finRes && finRes.data?.success && finRes.data.summary) {
        setLedgerBalanced(Boolean(finRes.data.summary.is_balanced));
      }
    } catch (e: any) {
      console.warn('Dashboard telemetry error:', e);
      setError('Unable to load full telemetry. Some metrics may be delayed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const totalValuation = inventory.reduce(
    (acc, curr) => acc + Number(curr.stock_qty || 0) * Number(curr.unit_price || 0),
    0
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Executive Operations Dashboard
          </h2>
          <p className="text-sm lg:text-base text-slate-500 mt-1">
            Real-time organizational telemetry across active departments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3.5 py-2 rounded-lg border border-slate-200">
            Tenant Period: FY2026-Q4
          </span>
          <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading} aria-label="Refresh telemetry">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Quick Operations Action Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <span className="text-slate-400 font-mono text-xs font-semibold uppercase tracking-wider mr-1">
          Quick Actions:
        </span>
        <Link
          to="/procurement"
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-semibold text-sm border border-indigo-200/60 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 text-indigo-600" /> New Requisition
        </Link>
        <Link
          to="/inventory"
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-sm border border-slate-200 transition-colors shadow-sm"
        >
          <Boxes className="w-5 h-5 text-slate-600" /> Manage Inventory
        </Link>
        {hasRole(['SUPER_ADMIN', 'FINANCE_OFFICER']) && (
          <Link
            to="/finance"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-sm border border-slate-200 transition-colors shadow-sm"
          >
            <DollarSign className="w-5 h-5 text-emerald-600" /> General Ledger
          </Link>
        )}
        <Link
          to="/audit"
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-sm border border-slate-200 transition-colors shadow-sm"
        >
          <ShieldCheck className="w-5 h-5 text-purple-600" /> Audit Trail
        </Link>
      </div>

      {/* KPI Cards (4-column grid with gap-6, equal heights) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Card 1: Catalog SKUs */}
        <div className="bg-white p-6 xl:p-7 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Catalog Items</span>
              <Boxes className="w-6 h-6 text-indigo-500" aria-hidden="true" />
            </div>
            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="text-3xl lg:text-4xl font-bold text-slate-900 font-mono">{metrics.total_items}</span>
              <span className="text-sm font-semibold text-emerald-600">Active SKUs</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs lg:text-sm text-slate-400 flex items-center gap-1.5 font-mono">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Count of items in warehouse registry</span>
          </div>
        </div>

        {/* Card 2: Inventory Valuation */}
        <div className="bg-white p-6 xl:p-7 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Total Valuation</span>
              <DollarSign className="w-6 h-6 text-emerald-500" aria-hidden="true" />
            </div>
            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="text-3xl lg:text-4xl font-bold text-slate-900 font-mono">
                ₹{totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-slate-400 font-mono">PostgreSQL</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs lg:text-sm text-slate-400 flex items-center gap-1.5 font-mono">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Formula: Σ(stock_qty × unit_price)</span>
          </div>
        </div>

        {/* Card 3: Low Stock Alerts */}
        <div className="bg-white p-6 xl:p-7 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Low Stock Alerts</span>
              <AlertTriangle className="w-6 h-6 text-amber-500" aria-hidden="true" />
            </div>
            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="text-3xl lg:text-4xl font-bold text-amber-600 font-mono">{metrics.low_stock_items}</span>
              <span className="text-sm font-semibold text-amber-700">Needs replenishment</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs lg:text-sm text-slate-400 flex items-center gap-1.5 font-mono">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Criteria: stock_qty ≤ safety_stock</span>
          </div>
        </div>

        {/* Card 4: Active Procurement Pipeline & Ledger Telemetry */}
        <div className="bg-white p-6 xl:p-7 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Pipeline Requests</span>
              <Clock className="w-6 h-6 text-indigo-500" aria-hidden="true" />
            </div>
            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="text-3xl lg:text-4xl font-bold text-slate-900 font-mono">{pendingPRCount}</span>
              <span className="text-sm text-indigo-600 font-semibold">Active PRs</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs lg:text-sm text-slate-500 flex items-center gap-1.5 font-mono">
            {ledgerBalanced === true ? (
              <span className="text-emerald-700 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Ledger Balanced (Δ = ₹0.00)
              </span>
            ) : (
              <span>Requisitions undergoing stage-gate approvals</span>
            )}
          </div>
        </div>
      </div>

      {/* Visual Component: Procurement Pipeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg lg:text-xl font-semibold text-slate-900 tracking-tight">
            {recentPR ? `Latest Requisition Pipeline (${recentPR.pr_code})` : 'Active Procurement Pipeline Visualizer'}
          </h3>
          <Link
            to="/procurement"
            className="text-sm font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 font-medium focus:outline-none focus:underline"
          >
            Manage Pipeline <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
        <WorkflowTimeline currentStage={activeStage} amount={activeAmount} />
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg lg:text-xl font-semibold text-slate-900 tracking-tight">
            Warehouse Inventory Registry
          </h3>
          <Link
            to="/inventory"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-mono flex items-center gap-1.5 font-medium"
          >
            View Master <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th scope="col" className="py-3.5 px-6 font-semibold">SKU Code</th>
                <th scope="col" className="py-3.5 px-6 font-semibold">Item Name</th>
                <th scope="col" className="py-3.5 px-6 font-semibold">Category</th>
                <th scope="col" className="py-3.5 px-6 font-semibold text-right">Unit Price</th>
                <th scope="col" className="py-3.5 px-6 font-semibold text-right">Stock Qty</th>
                <th scope="col" className="py-3.5 px-6 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 font-mono text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                      <span>Loading inventory records from PostgreSQL...</span>
                    </div>
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Boxes className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-slate-900 text-base">No items in warehouse</p>
                      <p className="text-sm text-slate-500">Register SKU items in Inventory Master to begin tracking perpetual valuation.</p>
                      <Link
                        to="/inventory"
                        className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm"
                      >
                        <Plus className="w-5 h-5" /> Open Inventory Master
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors h-14">
                    <td className="py-4 px-6 font-mono font-medium text-indigo-600">{item.sku_code}</td>
                    <td className="py-4 px-6 font-medium text-slate-900">{item.name}</td>
                    <td className="py-4 px-6 text-slate-500">{item.category}</td>
                    <td className="py-4 px-6 text-right font-mono text-slate-900 font-semibold">
                      ₹{Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-semibold">{item.stock_qty}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-medium ${
                        item.stock_qty <= item.safety_stock
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {item.stock_qty <= item.safety_stock ? 'Low Stock' : 'Optimal'}
                      </span>
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

export default Dashboard;
