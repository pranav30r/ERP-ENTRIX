import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, RefreshCw, PackageCheck, ShieldAlert } from 'lucide-react';
import { WorkflowTimeline, ProcurementStage } from '../components/WorkflowTimeline';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export const Procurement: React.FC = () => {
  const { hasRole, role } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPR, setSelectedPR] = useState<any | null>(null);

  // Form state
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPRs = async () => {
    setLoading(true);
    try {
      await ensureAuthenticated();
      const [prsRes, invRes] = await Promise.all([
        apiClient.get('/procurement/requests'),
        apiClient.get('/inventory')
      ]);

      if (prsRes.data.success && Array.isArray(prsRes.data.data)) {
        setRequests(prsRes.data.data);
        if (prsRes.data.data.length > 0) {
          setSelectedPR(prsRes.data.data[0]);
        }
      }

      if (invRes.data.success && Array.isArray(invRes.data.data)) {
        setInventoryItems(invRes.data.data);
        if (invRes.data.data.length > 0 && !itemId) {
          setItemId(invRes.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Procurement data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
  }, []);

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/procurement/requests', {
        item_id: itemId,
        quantity: Number(quantity),
        justification
      });

      if (res.data.success) {
        setShowModal(false);
        setJustification('');
        await fetchPRs();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error creating purchase request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async (id: string, type: 'manager' | 'finance', action: 'APPROVE' | 'REJECT') => {
    try {
      await ensureAuthenticated();
      await apiClient.post(`/procurement/requests/${id}/${type}-approval`, {
        action,
        comments: `${action} executed by ${role}`
      });
      await fetchPRs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Approval error.');
    }
  };

  const handleReceiveGoods = async (id: string) => {
    try {
      await ensureAuthenticated();
      await apiClient.post(`/procurement/requests/${id}/receive-goods`);
      await fetchPRs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error receiving goods.');
    }
  };

  const canApproveManager = hasRole(['SUPER_ADMIN', 'HR_MANAGER']);
  const canApproveFinance = hasRole(['SUPER_ADMIN', 'FINANCE_OFFICER']);
  const canReceiveGoods = hasRole(['SUPER_ADMIN', 'PROCUREMENT_OFFICER']);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Procurement Pipeline & Approval Workflow</h2>
          <p className="text-xs text-slate-500 mt-0.5">8-stage automated requisition state machine with ₹10k auto-escalation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchPRs} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Requisition
          </Button>
        </div>
      </div>

      {/* Selected PR Timeline */}
      {selectedPR && (
        <WorkflowTimeline
          currentStage={selectedPR.status as ProcurementStage}
          amount={Number(selectedPR.estimated_total)}
        />
      )}

      {/* Requisitions List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Active Purchase Requisitions</h3>
          <span className="text-xs text-slate-400 font-mono">{requests.length} Requests Live</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4 font-semibold">PR Code</th>
                <th className="py-2.5 px-4 font-semibold">Item Required</th>
                <th className="py-2.5 px-4 font-semibold text-right">Quantity</th>
                <th className="py-2.5 px-4 font-semibold text-right">Estimated Cost</th>
                <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">RBAC Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">Loading requisitions from PostgreSQL...</td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">No purchase requisitions found. Click "New Requisition" to create one.</td>
                </tr>
              ) : (
                requests.map((pr) => (
                  <tr
                    key={pr.id}
                    onClick={() => setSelectedPR(pr)}
                    className={`cursor-pointer transition-colors ${
                      selectedPR?.id === pr.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">{pr.pr_code}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {pr.item?.name || 'Inventory SKU'}
                      <p className="text-[10px] text-slate-400 font-mono">{pr.item?.sku_code}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">{pr.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{Number(pr.estimated_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        pr.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        pr.status === 'GOODS_RECEIVED' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                        pr.status === 'PENDING_MANAGER' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        pr.status === 'PENDING_FINANCE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        pr.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {pr.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {pr.status === 'PENDING_MANAGER' && (
                        canApproveManager ? (
                          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleApproval(pr.id, 'manager', 'APPROVE')}
                              className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApproval(pr.id, 'manager', 'REJECT')}
                              className="px-2 py-1 bg-rose-600 text-white rounded text-[11px] font-semibold hover:bg-rose-700 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">Needs Dept Lead</span>
                        )
                      )}

                      {pr.status === 'PENDING_FINANCE' && (
                        canApproveFinance ? (
                          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleApproval(pr.id, 'finance', 'APPROVE')}
                              className="px-2 py-1 bg-indigo-600 text-white rounded text-[11px] font-semibold hover:bg-indigo-700 transition-colors"
                            >
                              Finance Sign-off
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">Needs Finance Sign-off</span>
                        )
                      )}

                      {pr.status === 'APPROVED' && (
                        canReceiveGoods ? (
                          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleReceiveGoods(pr.id)}
                              className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1"
                            >
                              <PackageCheck className="w-3 h-3" /> Receive Goods (GRN)
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-600 flex items-center justify-end gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Approved
                          </span>
                        )
                      )}

                      {pr.status === 'GOODS_RECEIVED' && (
                        <span className="text-[11px] font-semibold text-teal-600 flex items-center justify-end gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> In Inventory
                        </span>
                      )}

                      {pr.status === 'REJECTED' && (
                        <span className="text-[11px] font-semibold text-rose-600 flex items-center justify-end gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New PR */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Create Purchase Requisition</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleCreatePR} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Target Inventory SKU (Live Database)</label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                  required
                >
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku_code} — {item.name} (₹{Number(item.unit_price).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Required Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Business Justification</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="e.g. Replenishment for assembly line milestone #3"
                  className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 h-20"
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Workflow Routing Rule:</span> Requisitions &ge; ₹10,000 automatically escalate to Finance Officer for sign-off after Department Lead approval.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Requisition'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
