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
    <div className="space-y-6">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Executive Operations Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time organizational telemetry across active departments</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            Tenant Period: FY2026-Q4
          </span>
          <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading} aria-label="Refresh telemetry">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Quick Operations Action Bar */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 bg-white rounded-xl border border-slate-200 shadow-sm text-xs">
        <span className="text-slate-400 font-mono text-[11px] font-semibold uppercase tracking-wider mr-1">Quick Actions:</span>
        <Link
          to="/procurement"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md font-semibold text-xs border border-indigo-200/60 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-600" /> New Requisition
        </Link>
        <Link
          to="/inventory"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-md font-semibold text-xs border border-slate-200 transition-colors"
        >
          <Boxes className="w-3.5 h-3.5 text-slate-600" /> Manage Inventory
        </Link>
        {hasRole(['SUPER_ADMIN', 'FINANCE_OFFICER']) && (
          <Link
            to="/finance"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-md font-semibold text-xs border border-slate-200 transition-colors"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> General Ledger
          </Link>
        )}
        <Link
          to="/audit"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-md font-semibold text-xs border border-slate-200 transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" /> Audit Trail
        </Link>
      </div>

      {/* KPI Cards (Stripe Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Catalog SKUs */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Catalog Items</span>
            <Boxes className="w-4 h-4 text-indigo-500" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">{metrics.total_items}</span>
            <span className="text-xs font-medium text-emerald-600">Active SKUs</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
            <Info className="w-3 h-3" aria-hidden="true" />
            <span>Count of items in warehouse registry</span>
          </div>
        </div>

        {/* Card 2: Inventory Valuation */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Total Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              ₹{totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-slate-400 font-mono">PostgreSQL</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
            <Info className="w-3 h-3" aria-hidden="true" />
            <span>Formula: Σ(stock_qty × unit_price)</span>
          </div>
        </div>

        {/* Card 3: Low Stock Alerts */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 font-mono">{metrics.low_stock_items}</span>
            <span className="text-xs text-amber-700">Needs replenishment</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
            <Info className="w-3 h-3" aria-hidden="true" />
            <span>Criteria: stock_qty ≤ safety_stock</span>
          </div>
        </div>

        {/* Card 4: Active Procurement Pipeline & Ledger Telemetry */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">Pipeline Requests</span>
            <Clock className="w-4 h-4 text-indigo-500" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">{pendingPRCount}</span>
            <span className="text-xs text-indigo-600 font-semibold">Active PRs</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 font-mono">
            {ledgerBalanced === true ? (
              <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ledger Balanced (Δ = ₹0.00)
              </span>
            ) : (
              <span>Requisitions undergoing stage-gate approvals</span>
            )}
          </div>
        </div>
      </div>

      {/* Visual Component: Procurement Pipeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            {recentPR ? `Latest Requisition Pipeline (${recentPR.pr_code})` : 'Active Procurement Pipeline Visualizer'}
          </h3>
          <Link
            to="/procurement"
            className="text-xs font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium focus:outline-none focus:underline"
          >
            Manage Pipeline <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
        <WorkflowTimeline currentStage={activeStage} amount={activeAmount} />
      </div>

      {/* Inventory Table (Stripe Style) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Warehouse Inventory Registry</h3>
          <Link
            to="/inventory"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-mono flex items-center gap-1 font-medium"
          >
            View Master <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
              <tr>
                <th scope="col" className="py-2.5 px-4 font-semibold">SKU Code</th>
                <th scope="col" className="py-2.5 px-4 font-semibold">Item Name</th>
                <th scope="col" className="py-2.5 px-4 font-semibold">Category</th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-right">Unit Price</th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-right">Stock Qty</th>
                <th scope="col" className="py-2.5 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-mono">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>Loading inventory records from PostgreSQL...</span>
                    </div>
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Boxes className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">No items in warehouse</p>
                      <p className="text-xs text-slate-500">Register SKU items in Inventory Master to begin tracking perpetual valuation.</p>
                      <Link
                        to="/inventory"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700"
                      >
                        <Plus className="w-3.5 h-3.5" /> Open Inventory Master
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">{item.sku_code}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                    <td className="py-3 px-4 text-slate-500">{item.category}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 font-semibold">
                      ₹{Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">{item.stock_qty}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
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
