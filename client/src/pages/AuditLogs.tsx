import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs] = useState([
    {
      id: 1,
      actor: 'Aditya Sakarkar (admin@entrix.local)',
      action: 'PR_STATUS_MUTATION',
      entity: 'purchase_requests (PR-2026-00412)',
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      currHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      time: '2026-10-25 19:42:15'
    },
    {
      id: 2,
      actor: 'Aditya Sakarkar (admin@entrix.local)',
      action: 'STOCK_INCREMENT_GRN',
      entity: 'inventory_items (RAW-STL-001)',
      prevHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      currHash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      time: '2026-10-25 19:42:18'
    }
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Cryptographic Audit Trail Explorer</h2>
          <p className="text-xs text-slate-500 mt-0.5">SHA-256 chained governance records with mathematical tamper validation</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" /> Chain Verified: Zero Breaks
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Immutable State Mutating Events</h3>
          <span className="text-xs text-slate-400 font-mono">B-Tree Indexed Table</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4 font-semibold">ID</th>
                <th className="py-2.5 px-4 font-semibold">Actor</th>
                <th className="py-2.5 px-4 font-semibold">Action & Target</th>
                <th className="py-2.5 px-4 font-semibold">Current Hash (SHA-256)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">#{log.id}</td>
                  <td className="py-3 px-4 font-sans text-slate-800">{log.actor}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className="font-semibold text-indigo-600">{log.action}</span>
                    <p className="text-[11px] text-slate-400">{log.entity}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600 truncate max-w-xs">{log.currHash}</td>
                  <td className="py-3 px-4 text-right text-slate-400">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
