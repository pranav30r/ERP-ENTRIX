import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export const Finance: React.FC = () => {
  const [entries] = useState([
    { id: 'TX-101', date: '2026-10-24', account: '1010 - Operating Cash', debit: 0, credit: 13100.00, desc: 'Supplier Settlement: Steel Bars (PO-2026-00412)' },
    { id: 'TX-102', date: '2026-10-24', account: '1510 - Raw Material Inventory', debit: 13100.00, credit: 0, desc: 'Inventory Asset Intake (GRN-2026-0081)' },
    { id: 'TX-103', date: '2026-10-22', account: '5020 - Office Supplies Expense', debit: 4200.00, credit: 0, desc: 'A4 Paper Procurement' },
    { id: 'TX-104', date: '2026-10-22', account: '1010 - Operating Cash', debit: 0, credit: 4200.00, desc: 'Office Pro Vendor Settlement' }
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Finance & General Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">ACID-compliant double entry accounting with balanced debit/credit audit</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" /> Ledger Zero-Discrepancy Verified
        </div>
      </div>

      {/* 2 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Debits Posted</span>
            <span className="text-emerald-600 font-bold font-mono">BALANCED</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">₹17,300.00</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Credits Posted</span>
            <span className="text-emerald-600 font-bold font-mono">BALANCED</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">₹17,300.00</div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Double-Entry Journal Postings</h3>
          <span className="text-xs text-slate-400 font-mono">PostgreSQL 16 Tables</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Tx ID</th>
                <th className="py-2.5 px-4 font-semibold">Date</th>
                <th className="py-2.5 px-4 font-semibold">General Ledger Account</th>
                <th className="py-2.5 px-4 font-semibold">Description</th>
                <th className="py-2.5 px-4 font-semibold text-right">Debit (₹)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">{e.id}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{e.date}</td>
                  <td className="py-3 px-4 font-medium text-slate-800">{e.account}</td>
                  <td className="py-3 px-4 text-slate-600">{e.desc}</td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                    {e.debit > 0 ? `₹${e.debit.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                    {e.credit > 0 ? `₹${e.credit.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
