import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Clock } from 'lucide-react';
import { WorkflowTimeline, ProcurementStage } from '../components/WorkflowTimeline';

export const Procurement: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPR, setSelectedPR] = useState<any | null>(null);

  // Form state
  const [itemId, setItemId] = useState('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01');
  const [quantity, setQuantity] = useState(15);
  const [justification, setJustification] = useState('');

  const fetchPRs = async () => {
    try {
      const auth = await axios.post('http://localhost:5000/api/v1/auth/login', {
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });
      const res = await axios.get('http://localhost:5000/api/v1/procurement/requests', {
        headers: { Authorization: `Bearer ${auth.data.access_token}` }
      });
      setRequests(res.data.data);
      if (res.data.data.length > 0) {
        setSelectedPR(res.data.data[0]);
      }
    } catch {
      // Mock fallback
      const mock = [
        {
          id: 'mock-1',
          pr_code: 'PR-2026-00412',
          item: { name: 'Structural Steel Bars (12mm)', sku_code: 'RAW-STL-001' },
          quantity: 200,
          estimated_total: 13100.00,
          status: 'PENDING_MANAGER',
          justification: 'Quarterly manufacturing inventory replenishment',
          created_at: new Date().toISOString()
        },
        {
          id: 'mock-2',
          pr_code: 'PR-2026-00108',
          item: { name: 'A4 Executive Copy Paper (500s)', sku_code: 'OFF-PPR-003' },
          quantity: 15,
          estimated_total: 4200.00,
          status: 'APPROVED',
          justification: 'Office administration consumables',
          created_at: new Date().toISOString()
        }
      ];
      setRequests(mock);
      setSelectedPR(mock[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
  }, []);

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const auth = await axios.post('http://localhost:5000/api/v1/auth/login', {
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });
      await axios.post('http://localhost:5000/api/v1/procurement/requests', {
        item_id: itemId,
        quantity: Number(quantity),
        justification
      }, {
        headers: { Authorization: `Bearer ${auth.data.access_token}` }
      });
      setShowModal(false);
      setJustification('');
      fetchPRs();
    } catch (err) {
      alert('Error creating purchase request. Check backend service.');
    }
  };

  const handleApproval = async (id: string, type: 'manager' | 'finance', action: 'APPROVE' | 'REJECT') => {
    try {
      const auth = await axios.post('http://localhost:5000/api/v1/auth/login', {
        email: 'admin@entrix.local',
        password: 'Admin@123'
      });
      await axios.post(`http://localhost:5000/api/v1/procurement/requests/${id}/${type}-approval`, {
        action,
        comments: `${action} executed by Administrator`
      }, {
        headers: { Authorization: `Bearer ${auth.data.access_token}` }
      });
      fetchPRs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Approval error.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Procurement Pipeline & Approval Workflow</h2>
          <p className="text-xs text-slate-500 mt-0.5">8-stage automated requisition state machine with ₹10k auto-escalation</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 rounded-md text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> New Requisition
        </button>
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
          <span className="text-xs text-slate-400 font-mono">{requests.length} Requests Active</span>
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
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Loading requisitions...</td>
                </tr>
              ) : requests.map((pr) => (
                <tr
                  key={pr.id}
                  onClick={() => setSelectedPR(pr)}
                  className={`cursor-pointer hover:bg-slate-50 transition-colors ${selectedPR?.id === pr.id ? 'bg-indigo-50/40' : ''}`}
                >
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">{pr.pr_code}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-800">{pr.item?.name || 'Material Item'}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{pr.justification}</p>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium">{pr.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{Number(pr.estimated_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold
                      ${pr.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        pr.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'}
                    `}>
                      <Clock className="w-2.5 h-2.5" /> {pr.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    {pr.status === 'PENDING_MANAGER' && (
                      <button
                        onClick={() => handleApproval(pr.id, 'manager', 'APPROVE')}
                        className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700 transition"
                      >
                        Mgr Approve
                      </button>
                    )}
                    {pr.status === 'PENDING_FINANCE' && (
                      <button
                        onClick={() => handleApproval(pr.id, 'finance', 'APPROVE')}
                        className="px-2 py-1 bg-indigo-600 text-white rounded text-[11px] font-semibold hover:bg-indigo-700 transition"
                      >
                        Fin Approve
                      </button>
                    )}
                    {(pr.status === 'PENDING_MANAGER' || pr.status === 'PENDING_FINANCE') && (
                      <button
                        onClick={() => handleApproval(pr.id, 'manager', 'REJECT')}
                        className="px-2 py-1 bg-slate-100 text-rose-600 rounded text-[11px] font-medium hover:bg-rose-50 transition"
                      >
                        Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
                <label className="block text-slate-600 font-medium mb-1">Target Inventory SKU</label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white"
                >
                  <option value="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01">RAW-STL-001 (Structural Steel - ₹65.50)</option>
                  <option value="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02">ELEC-SMR-002 (STM32 Boards - ₹850.00)</option>
                  <option value="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03">OFF-PPR-003 (A4 Paper - ₹280.00)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Quantity Requested</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Business Justification</label>
                <textarea
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain why this purchase is necessary..."
                  className="w-full p-2 border border-slate-200 rounded-md"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
