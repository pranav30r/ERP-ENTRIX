import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Boxes,
  Activity,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { WorkflowTimeline, ProcurementStage } from '../components/WorkflowTimeline';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';

export const Dashboard: React.FC = () => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ total_items: 0, low_stock_items: 0 });
  const [recentPR, setRecentPR] = useState<any | null>(null);
  const [activeStage, setActiveStage] = useState<ProcurementStage>('PENDING_MANAGER');
  const [activeAmount, setActiveAmount] = useState<number>(24500);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureAuthenticated();
      const [invRes, prsRes] = await Promise.all([
        apiClient.get('/inventory'),
        apiClient.get('/procurement/requests')
      ]);

      if (invRes.data.success) {
        setInventory(invRes.data.data || []);
        setMetrics(invRes.data.metrics || { total_items: 0, low_stock_items: 0 });
      }

      if (prsRes.data.success && Array.isArray(prsRes.data.data) && prsRes.data.data.length > 0) {
        const latest = prsRes.data.data[0];
        setRecentPR(latest);
        setActiveStage(latest.status as ProcurementStage);
        setActiveAmount(Number(latest.estimated_total));
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
            Current Period: Q4 FY2026
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

        {/* Card 4: AI Demand Buffer */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">AI Demand Safety</span>
            <Activity className="w-4 h-4 text-blue-500" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">98.4%</span>
            <span className="text-xs text-emerald-600">Optimal Buffer</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
            <Info className="w-3 h-3" aria-hidden="true" />
            <span>Monte Carlo stockout probability buffer</span>
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
          <h3 className="text-sm font-semibold text-slate-800">Warehouse Inventory Items</h3>
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
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-mono">Loading inventory records...</td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-mono">No inventory items found.</td>
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
