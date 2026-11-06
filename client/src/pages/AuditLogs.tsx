import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Info, Copy, Check, FileCode2 } from 'lucide-react';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Tooltip } from '../components/ui/Tooltip';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDateTime } from '../lib/format';

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
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>('All');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const handleCopyHash = (hash: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const actionTypes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.action) set.add(log.action);
    });
    return ['All', ...Array.from(set)];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (selectedAction === 'All') return logs;
    return logs.filter((log) => log.action === selectedAction);
  }, [logs, selectedAction]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [selectedAction]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setForbiddenError(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.get('/audit');
      if (res.data.success) {
        setLogs(res.data.data);
        if (res.data.integrity) {
          setIntegrity(res.data.integrity);
        }
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setForbiddenError(err.response?.data?.error || 'Access Forbidden. Role does not have permission to view audit logs.');
      } else {
        console.error('Failed to fetch audit logs:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tamper-evident activity log"
        subtitle="Cryptographically verified state mutation chain"
        actions={
          <div className="flex items-center gap-2">
            <Tooltip content="SHA-256 chained governance records with mathematical tamper validation">
              <span className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <Info className="w-4 h-4" />
              </span>
            </Tooltip>
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
        }
      />

      {forbiddenError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            403
          </div>
          <h3 className="text-sm font-bold text-slate-800">Access Restricted (RBAC Policy Enforced)</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">{forbiddenError}</p>
          <span className="text-[11px] text-slate-400 block">Switch to a Super Admin account in the top-right header to inspect audit blocks.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Action-Type Filter */}
          <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-500">Filter Action:</span>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {actionTypes.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-slate-400 font-mono">{filteredLogs.length} events logged</span>
          </div>

          <DataTable<AuditLogEntry>
            columns={[
              {
                key: 'id',
                header: 'ID',
                render: (log) => <span className="font-mono font-bold text-slate-900">#{log.id}</span>
              },
              {
                key: 'action',
                header: 'Action',
                render: (log) => <span className="font-semibold text-indigo-600 font-sans">{log.action}</span>
              },
              {
                key: 'entity',
                header: 'Target Entity',
                render: (log) => (
                  <div className="font-sans">
                    <span className="text-slate-700 font-medium">{log.entity_name}</span>
                    <p className="text-xs text-slate-400 font-mono">{log.entity_id}</p>
                  </div>
                )
              },
              {
                key: 'current_hash',
                header: 'SHA-256 Current Hash',
                render: (log) => {
                  const isCopied = copiedHash === log.current_hash;
                  return (
                    <div className="flex items-center gap-1.5 font-mono text-emerald-700">
                      <span title={log.current_hash}>
                        {log.current_hash.substring(0, 12)}...{log.current_hash.substring(56)}
                      </span>
                      <Tooltip content={isCopied ? "Copied!" : "Copy hash"}>
                        <button
                          type="button"
                          onClick={() => handleCopyHash(log.current_hash)}
                          aria-label="Copy hash"
                          className="p-1 text-slate-400 hover:text-emerald-700 rounded transition-colors"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </Tooltip>
                    </div>
                  );
                }
              },
              {
                key: 'previous_hash',
                header: 'Previous Hash',
                render: (log) => {
                  const isCopied = copiedHash === log.previous_hash;
                  return (
                    <div className="flex items-center gap-1.5 font-mono text-slate-400">
                      <span title={log.previous_hash}>
                        {log.previous_hash.substring(0, 12)}...{log.previous_hash.substring(56)}
                      </span>
                      <Tooltip content={isCopied ? "Copied!" : "Copy hash"}>
                        <button
                          type="button"
                          onClick={() => handleCopyHash(log.previous_hash)}
                          aria-label="Copy previous hash"
                          className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </Tooltip>
                    </div>
                  );
                }
              },
              {
                key: 'timestamp',
                header: 'Timestamp',
                align: 'right',
                render: (log) => (
                  <span className="text-slate-500 font-sans text-xs">
                    {formatDateTime(log.timestamp)}
                  </span>
                )
              }
            ]}
            rows={paginatedLogs}
            rowKey={(log) => log.id}
            loading={loading}
            pagination={{
              page,
              pageSize,
              total: filteredLogs.length,
              onPageChange: setPage,
              showJumps: true
            }}
            emptyState={
              <EmptyState
                icon={FileCode2}
                title="No audit logs recorded"
                description={
                  selectedAction !== 'All'
                    ? "No audit records match the selected action filter."
                    : "No state mutations recorded yet in the cryptographic chain."
                }
                action={
                  selectedAction !== 'All' ? (
                    <Button variant="outline" size="sm" onClick={() => setSelectedAction('All')}>
                      Clear action filter
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
