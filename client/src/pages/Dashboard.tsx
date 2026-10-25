import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle
} from 'lucide-react';
import { WorkflowTimeline, ProcurementStage } from '../components/WorkflowTimeline';

export const Dashboard: React.FC = () => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ total_items: 0, low_stock_items: 0 });
  const [activeStage] = useState<ProcurementStage>('PENDING_MANAGER');
  const [activeAmount] = useState<number>(24500);

  useEffect(() => {
    // Fetch seed inventory from backend API
    const fetchInventory = async () => {
      try {
        // Authenticate as demo admin
        const auth = await axios.post('http://localhost:5000/api/v1/auth/login', {
          email: 'admin@entrix.local',
          password: 'Admin@123'
        });

        if (auth.data.access_token) {
          const res = await axios.get('http://localhost:5000/api/v1/inventory', {
            headers: { Authorization: `Bearer ${auth.data.access_token}` }
          });
          setInventory(res.data.data);
          setMetrics(res.data.metrics);
        }
      } catch (e) {
        console.warn('Backend API connection pending or loading local mock...');
        // Fallback realistic seed data if server is offline
        setInventory([
          { id: '1', sku_code: 'RAW-STL-001', name: 'Structural Steel Bars (12mm)', category: 'Raw Materials', unit_price: 65.50, stock_qty: 450, safety_stock: 100 },
          { id: '2', sku_code: 'ELEC-SMR-002', name: 'Microcontroller Boards STM32', category: 'Electronics', unit_price: 850.00, stock_qty: 25, safety_stock: 30 },
          { id: '3', sku_code: 'OFF-PPR-003', name: 'A4 Executive Copy Paper (500s)', category: 'Office Supplies', unit_price: 280.00, stock_qty: 80, safety_stock: 20 }
        ]);
        setMetrics({ total_items: 3, low_stock_items: 1 });
      }
    };

    fetchInventory();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Title & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Executive Operations Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time organizational telemetry across active departments</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            Export Report
          </button>
          <button className="px-3 py-1.5 bg-indigo-600 rounded-md text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20">
            + New Purchase Request
          </button>
        </div>
      </div>

      {/* Stripe-style 4 KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <span>Quarterly Procurement Spend</span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> 84% Cap
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
            ₹4,20,500<span className="text-sm font-normal text-slate-400">.00</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            Allocated: <span className="font-semibold text-slate-600 font-mono">₹5,00,000.00</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <span>Active Requisitions</span>
            <span className="text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] flex items-center">
              <Clock className="w-3 h-3 mr-0.5" /> 3 Pending
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
            14 <span className="text-sm font-normal text-slate-400">Orders</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            Avg Turnaround: <span className="font-semibold text-slate-600 font-mono">1.8 Days</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <span>Inventory SKUs Tracked</span>
            <span className="text-rose-700 font-semibold bg-rose-50 px-1.5 py-0.5 rounded text-[11px] flex items-center">
              <AlertTriangle className="w-3 h-3 mr-0.5" /> {metrics.low_stock_items} Critical
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
            {metrics.total_items} <span className="text-sm font-normal text-slate-400">Master SKUs</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            Warehouse Capacity: <span className="font-semibold text-slate-600 font-mono">68%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <span>AI Demand Forecast Status</span>
            <span className="text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] flex items-center">
              Scikit-learn
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 tracking-tight font-mono">
            Optimal <span className="text-sm font-normal text-slate-400">94.2% Acc.</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            Next Restock Cycle: <span className="font-semibold text-slate-600 font-mono">03 Nov 2026</span>
          </div>
        </div>
      </div>

      {/* 3. Custom ENTRIX Workflow Timeline Component */}
      <WorkflowTimeline currentStage={activeStage} amount={activeAmount} />

      {/* Stripe-style Compact Data Grid: Live Inventory Master */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Master Stock Ledger</h3>
            <p className="text-xs text-slate-500">Atomic inventory levels synced directly with warehouse GRN receipts</p>
          </div>
          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded">
            PostgreSQL 16 Synced
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">SKU Code</th>
                <th className="py-2.5 px-4 font-semibold">Description</th>
                <th className="py-2.5 px-4 font-semibold">Category</th>
                <th className="py-2.5 px-4 font-semibold text-right">Unit Price</th>
                <th className="py-2.5 px-4 font-semibold text-right">Stock on Hand</th>
                <th className="py-2.5 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {inventory.map((item) => {
                const isCritical = item.stock_qty <= item.safety_stock;
                return (
                  <tr key={item.sku_code} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{item.sku_code}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{item.name}</td>
                    <td className="py-3 px-4 text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800 font-medium">
                      ₹{Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {item.stock_qty} <span className="text-[10px] text-slate-400 font-normal">{item.unit_of_measure}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" /> Reorder Triggered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
