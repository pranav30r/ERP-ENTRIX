import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';

interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  action: string;
  entity_name: string;
  entity_id: string;
  previous_hash: string;
  current_hash: string;
  diff_payload: Record<string, any>;
  timestamp: string;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [integrity, setIntegrity] = useState<{ valid: boolean; total_checked: number }>({ valid: true, total_checked: 0 });
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.get('/audit');
      if (res.data.success) {
        setLogs(res.data.data);
        if (res.data.integrity) {
          setIntegrity(res.data.integrity);
        }
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Cryptographic Audit Trail Explorer</h2>
          <p className="text-xs text-slate-500 mt-0.5">SHA-256 chained governance records with mathematical tamper validation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Re-verify Chain
          </Button>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold ${
            integrity.valid 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {integrity.valid ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Chain Verified ({integrity.total_checked} Records)</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Tamper Detected! Chain Broken</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Immutable State Mutating Events (PostgreSQL B-Tree)</h3>
          <span className="text-xs text-slate-400 font-mono">{logs.length} Live Audit Blocks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4 font-semibold">ID</th>
                <th className="py-2.5 px-4 font-semibold">Action</th>
                <th className="py-2.5 px-4 font-semibold">Target Entity</th>
                <th className="py-2.5 px-4 font-semibold">SHA-256 Current Hash</th>
                <th className="py-2.5 px-4 font-semibold">Previous Hash</th>
                <th className="py-2.5 px-4 font-semibold text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                    Verifying SHA-256 cryptographic chain...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                    No state mutations recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">#{log.id}</td>
                    <td className="py-3 px-4 font-sans">
                      <span className="font-semibold text-indigo-600">{log.action}</span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="text-slate-700 font-medium">{log.entity_name}</span>
                      <p className="text-[10px] text-slate-400 font-mono">{log.entity_id}</p>
                    </td>
                    <td className="py-3 px-4 text-emerald-700 truncate max-w-xs" title={log.current_hash}>
                      {log.current_hash.substring(0, 16)}...{log.current_hash.substring(48)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-xs" title={log.previous_hash}>
                      {log.previous_hash.substring(0, 16)}...{log.previous_hash.substring(48)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 font-sans text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
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

export default AuditLogs;
