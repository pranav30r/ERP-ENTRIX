import React, { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle,
  RefreshCw,
  PackageCheck,
  ShieldAlert,
  FileText,
  Building2,
  CreditCard,
  AlertTriangle,
  Check,
  X,
  FileCheck2,
  DollarSign
} from 'lucide-react';
import { WorkflowTimeline, ProcurementStage } from '../components/WorkflowTimeline';
import { apiClient, ensureAuthenticated } from '../services/api';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

type TabType = 'requisitions' | 'invoices' | 'suppliers';

export const Procurement: React.FC = () => {
  const { hasRole, role } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('requisitions');

  // Core Data States
  const [requests, setRequests] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Requisition Selected & Modal
  const [selectedPR, setSelectedPR] = useState<any | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [justification, setJustification] = useState('');
  const [submittingPR, setSubmittingPR] = useState(false);

  // Invoice Match Modal State
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchPoId, setMatchPoId] = useState('');
  const [matchGrnId, setMatchGrnId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [billedQuantity, setBilledQuantity] = useState<number>(0);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(0);
  const [submittingMatch, setSubmittingMatch] = useState(false);

  // Supplier Modal State
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierCode, setSupplierCode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierTerms, setSupplierTerms] = useState('NET30');
  const [submittingSupplier, setSubmittingSupplier] = useState(false);

  // Payment processing ID
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 5000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      await ensureAuthenticated();
      const [prsRes, invRes, invoicesRes, suppliersRes, ordersRes] = await Promise.allSettled([
        apiClient.get('/procurement/requests'),
        apiClient.get('/inventory'),
        apiClient.get('/procurement/invoices'),
        apiClient.get('/procurement/suppliers'),
        apiClient.get('/procurement/orders')
      ]);

      if (prsRes.status === 'fulfilled' && prsRes.value.data.success) {
        const prList = prsRes.value.data.data;
        setRequests(prList);
        if (prList.length > 0 && !selectedPR) {
          setSelectedPR(prList[0]);
        }
      }

      if (invRes.status === 'fulfilled' && invRes.value.data.success) {
        const items = invRes.value.data.data;
        setInventoryItems(items);
        if (items.length > 0 && !itemId) {
          setItemId(items[0].id);
        }
      }

      if (invoicesRes.status === 'fulfilled' && invoicesRes.value.data.success) {
        setInvoices(invoicesRes.value.data.data);
      }

      if (suppliersRes.status === 'fulfilled' && suppliersRes.value.data.success) {
        setSuppliers(suppliersRes.value.data.data);
      }

      if (ordersRes.status === 'fulfilled' && ordersRes.value.data.success) {
        const ordList = ordersRes.value.data.data;
        setOrders(ordList);
        if (ordList.length > 0 && !matchPoId) {
          setMatchPoId(ordList[0].id);
          if (ordList[0].grns && ordList[0].grns.length > 0) {
            setMatchGrnId(ordList[0].grns[0].id);
            setBilledQuantity(ordList[0].grns[0].received_quantity);
          }
          setInvoiceAmount(Number(ordList[0].total_amount));
        }
      }
    } catch (err) {
      console.error('Procurement data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Update GRN selection when PO changes in match modal
  const handlePoChange = (poId: string) => {
    setMatchPoId(poId);
    const selected = orders.find((o) => o.id === poId);
    if (selected) {
      setInvoiceAmount(Number(selected.total_amount));
      if (selected.grns && selected.grns.length > 0) {
        setMatchGrnId(selected.grns[0].id);
        setBilledQuantity(Number(selected.grns[0].received_quantity));
      } else {
        setMatchGrnId('');
        setBilledQuantity(Number(selected.ordered_quantity));
      }
    }
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPR(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/procurement/requests', {
        item_id: itemId,
        quantity: Number(quantity),
        justification
      });

      if (res.data.success) {
        setShowPRModal(false);
        setJustification('');
        showToast(`Purchase requisition ${res.data.data?.pr_code || ''} created successfully.`);
        await loadAllData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error creating purchase request.', 'error');
    } finally {
      setSubmittingPR(false);
    }
  };

  const handleApproval = async (id: string, type: 'manager' | 'finance', action: 'APPROVE' | 'REJECT') => {
    try {
      await ensureAuthenticated();
      const res = await apiClient.post(`/procurement/requests/${id}/${type}-approval`, {
        action,
        comments: `${action} executed by ${role}`
      });
      showToast(res.data?.message || `Requisition updated (${action}).`);
      await loadAllData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Approval error.', 'error');
    }
  };

  const handleReceiveGoods = async (id: string) => {
    try {
      await ensureAuthenticated();
      const res = await apiClient.post(`/procurement/requests/${id}/receive-goods`);
      showToast(res.data?.message || 'Goods received and added to inventory ledger.');
      await loadAllData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error receiving goods.', 'error');
    }
  };

  const handleMatchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchPoId || !matchGrnId) {
      showToast('A Purchase Order and associated GRN are required for 3-way matching.', 'error');
      return;
    }
    setSubmittingMatch(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/procurement/invoices/match', {
        invoice_number: invoiceNumber,
        po_id: matchPoId,
        grn_id: matchGrnId,
        billed_quantity: Number(billedQuantity),
        invoice_amount: Number(invoiceAmount)
      });

      if (res.data.success) {
        setShowMatchModal(false);
        setInvoiceNumber('');
        showToast(res.data.message || 'Invoice 3-way match processed.');
        await loadAllData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error submitting invoice match.', 'error');
    } finally {
      setSubmittingMatch(false);
    }
  };

  const handleSettleInvoice = async (invoiceId: string, invoiceNum: string) => {
    setSettlingId(invoiceId);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post(`/procurement/invoices/${invoiceId}/pay`);
      showToast(res.data?.message || `Invoice ${invoiceNum} settled successfully.`);
      await loadAllData();
    } catch (err: any) {
      showToast(err.response?.data?.error || `Settlement failed for ${invoiceNum}.`, 'error');
    } finally {
      setSettlingId(null);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSupplier(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/procurement/suppliers', {
        code: supplierCode,
        name: supplierName,
        email: supplierEmail,
        phone: supplierPhone,
        payment_terms: supplierTerms,
        rating: 5.0
      });

      if (res.data.success) {
        setShowSupplierModal(false);
        setSupplierCode('');
        setSupplierName('');
        setSupplierEmail('');
        setSupplierPhone('');
        showToast(`Supplier ${supplierName} registered successfully.`);
        await loadAllData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error registering supplier.', 'error');
    } finally {
      setSubmittingSupplier(false);
    }
  };

  const canApproveManager = hasRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'DEPT_LEAD']);
  const canApproveFinance = hasRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER']);
  const canReceiveGoods = hasRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'PROCUREMENT_OFFICER']);
  const canMatchInvoices = hasRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER', 'PROCUREMENT_OFFICER']);
  const canSettlePayments = hasRole(['COMPANY_ADMIN', 'SUPER_ADMIN', 'FINANCE_OFFICER']);

  // Calculated Invoice Stats
  const matchedPendingInvoices = invoices.filter((i) => i.status === 'MATCHED');
  const paidInvoices = invoices.filter((i) => i.status === 'PAID');
  const discrepancyInvoices = invoices.filter((i) => i.status === 'DISCREPANCY');
  const totalPayableMatched = matchedPendingInvoices.reduce((acc, i) => acc + Number(i.invoice_amount || 0), 0);
  const totalPaid = paidInvoices.reduce((acc, i) => acc + Number(i.invoice_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Procurement & Supplier Invoicing</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            8-stage requisition workflow, automated PO issuance, and GAAP-compliant 3-way invoice matching
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAllData} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {activeTab === 'requisitions' && (
            <Button variant="primary" size="sm" onClick={() => setShowPRModal(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Requisition
            </Button>
          )}

          {activeTab === 'invoices' && canMatchInvoices && (
            <Button variant="primary" size="sm" onClick={() => setShowMatchModal(true)}>
              <FileCheck2 className="w-3.5 h-3.5 mr-1.5" /> Match New Invoice
            </Button>
          )}

          {activeTab === 'suppliers' && (
            <Button variant="primary" size="sm" onClick={() => setShowSupplierModal(true)}>
              <Building2 className="w-3.5 h-3.5 mr-1.5" /> Register Supplier
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          onClick={() => setActiveTab('requisitions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'requisitions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Purchase Requisitions
          <span className="ml-1 px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full text-[10px] font-mono">
            {requests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          3-Way Invoicing & Settlements
          <span className="ml-1 px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full text-[10px] font-mono">
            {invoices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'suppliers'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Suppliers Directory
          <span className="ml-1 px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full text-[10px] font-mono">
            {suppliers.length}
          </span>
        </button>
      </div>

      {/* TAB 1: REQUISITIONS */}
      {activeTab === 'requisitions' && (
        <div className="space-y-6">
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
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Active Purchase Requisitions</h3>
                <p className="text-[11px] text-slate-400">Click a requisition row to inspect workflow stage and linked PO/GRN</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">{requests.length} Requests Live</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">PR Code</th>
                    <th className="py-2.5 px-4 font-semibold">Item Required</th>
                    <th className="py-2.5 px-4 font-semibold">Department</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Quantity</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Estimated Cost</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Workflow Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading requisitions from PostgreSQL...
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No purchase requisitions found. Click "New Requisition" to create one.
                      </td>
                    </tr>
                  ) : (
                    requests.map((pr) => (
                      <tr
                        key={pr.id}
                        onClick={() => setSelectedPR(pr)}
                        className={`cursor-pointer transition-colors ${
                          selectedPR?.id === pr.id ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600">{pr.pr_code}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {pr.item?.name || 'Inventory SKU'}
                          <p className="text-[10px] text-slate-400 font-mono">{pr.item?.sku_code}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          {pr.department?.name || 'General Org'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">{pr.quantity}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{Number(pr.estimated_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                              pr.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : pr.status === 'GOODS_RECEIVED'
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : pr.status === 'INVOICE_MATCHED'
                                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                : pr.status === 'PENDING_MANAGER'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : pr.status === 'PENDING_FINANCE'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : pr.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {pr.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {pr.status === 'PENDING_MANAGER' &&
                            (canApproveManager ? (
                              <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleApproval(pr.id, 'manager', 'APPROVE')}
                                  className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700 transition-colors"
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
                            ))}

                          {pr.status === 'PENDING_FINANCE' &&
                            (canApproveFinance ? (
                              <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleApproval(pr.id, 'finance', 'APPROVE')}
                                  className="px-2.5 py-1 bg-indigo-600 text-white rounded text-[11px] font-semibold hover:bg-indigo-700 transition-colors"
                                >
                                  Finance Sign-off
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-400">Needs Finance Sign-off</span>
                            ))}

                          {pr.status === 'APPROVED' &&
                            (canReceiveGoods ? (
                              <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleReceiveGoods(pr.id)}
                                  className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                >
                                  <PackageCheck className="w-3 h-3" /> Receive Goods (GRN)
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-semibold text-emerald-600 flex items-center justify-end gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Approved
                              </span>
                            ))}

                          {pr.status === 'GOODS_RECEIVED' && (
                            <div className="flex items-center justify-end gap-1.5 text-teal-600 font-semibold text-[11px]">
                              <CheckCircle className="w-3.5 h-3.5" /> Goods In Warehouse
                            </div>
                          )}

                          {pr.status === 'INVOICE_MATCHED' && (
                            <span className="text-[11px] font-semibold text-cyan-600 flex items-center justify-end gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Invoiced & Balanced
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
        </div>
      )}

      {/* TAB 2: 3-WAY INVOICING & SETTLEMENTS */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {/* Telemetry Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Invoices
              </span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{invoices.length}</p>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Audit logged & tenant isolated</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-cyan-700 uppercase tracking-wider block">
                Matched & Payable
              </span>
              <p className="text-2xl font-bold font-mono text-cyan-900 mt-1">
                ₹{totalPayableMatched.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-cyan-600 mt-0.5 block">
                {matchedPendingInvoices.length} invoices ready for payment
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                Settled & Paid
              </span>
              <p className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">
                {paidInvoices.length} ledger-balanced disbursements
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block">
                Discrepancies
              </span>
              <p className="text-2xl font-bold font-mono text-rose-900 mt-1">{discrepancyInvoices.length}</p>
              <span className="text-[11px] text-rose-600 mt-0.5 block">Blocked from settlement</span>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Supplier Invoices & 3-Way Match Audit</h3>
                <p className="text-[11px] text-slate-400">
                  Matches Invoice amounts and billed quantities against Purchase Orders and Goods Received Notes
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">{invoices.length} Records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Invoice #</th>
                    <th className="py-2.5 px-4 font-semibold">PO Reference</th>
                    <th className="py-2.5 px-4 font-semibold">GRN Code</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Billed Qty</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Invoice Amount</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Payment Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading supplier invoices from PostgreSQL...
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No supplier invoices recorded yet. Click "Match New Invoice" to verify a vendor bill.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                        <td className="py-3 px-4 font-mono text-indigo-600">
                          {inv.purchase_order?.po_number || inv.po_id?.slice(0, 8) || 'PO-N/A'}
                          <p className="text-[10px] text-slate-400 font-sans">
                            {inv.purchase_order?.vendor_name || 'Vendor'}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {inv.grn?.grn_code || inv.grn_id?.slice(0, 8) || 'GRN-N/A'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">{inv.billed_quantity}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{Number(inv.invoice_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                              inv.status === 'MATCHED'
                                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                : inv.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {inv.status}
                          </span>
                          {inv.discrepancy_notes && (
                            <p className="text-[10px] text-rose-600 mt-1 max-w-xs truncate" title={inv.discrepancy_notes}>
                              {inv.discrepancy_notes}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {inv.status === 'MATCHED' &&
                            (canSettlePayments ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleSettleInvoice(inv.id, inv.invoice_number)}
                                disabled={settlingId === inv.id}
                              >
                                {settlingId === inv.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <DollarSign className="w-3 h-3 mr-1" />
                                )}
                                Settle Payment
                              </Button>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-400">Finance Approval Req</span>
                            ))}

                          {inv.status === 'PAID' && (
                            <span className="text-[11px] font-semibold text-emerald-600 flex items-center justify-end gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Settled (Ledger Cleared)
                            </span>
                          )}

                          {inv.status === 'DISCREPANCY' && (
                            <span className="text-[11px] font-semibold text-rose-600 flex items-center justify-end gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy Block
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
        </div>
      )}

      {/* TAB 3: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Approved Vendor & Supplier Directory</h3>
              <p className="text-[11px] text-slate-400">Authorized partners for purchase orders and inventory deliveries</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{suppliers.length} Registered</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Vendor Code</th>
                  <th className="py-2.5 px-4 font-semibold">Company Name</th>
                  <th className="py-2.5 px-4 font-semibold">Email</th>
                  <th className="py-2.5 px-4 font-semibold">Phone</th>
                  <th className="py-2.5 px-4 font-semibold text-center">Payment Terms</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading suppliers from PostgreSQL...
                    </td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No suppliers registered yet. Click "Register Supplier" to add one.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{sup.code}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{sup.name}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{sup.email || '—'}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{sup.phone || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-semibold">
                          {sup.payment_terms || 'NET30'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        ★ {Number(sup.rating || 5.0).toFixed(1)} / 5.0
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: NEW REQUISITION */}
      {showPRModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Create Purchase Requisition</h3>
              <button onClick={() => setShowPRModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
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
                <span className="font-semibold text-slate-700">Workflow Routing Rule:</span> Requisitions &ge; ₹10,000
                automatically escalate to Finance Officer for sign-off after Department Lead approval.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowPRModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submittingPR}>
                  {submittingPR ? 'Submitting...' : 'Submit Requisition'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: 3-WAY INVOICE MATCHING */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Record & Match Supplier Invoice</h3>
              <button onClick={() => setShowMatchModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            <form onSubmit={handleMatchInvoice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Select Purchase Order</label>
                <select
                  value={matchPoId}
                  onChange={(e) => handlePoChange(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                  required
                >
                  <option value="" disabled>
                    -- Select PO --
                  </option>
                  {orders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} — {po.vendor_name} (₹{Number(po.total_amount).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Goods Received Note (GRN)</label>
                <select
                  value={matchGrnId}
                  onChange={(e) => setMatchGrnId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                  required
                >
                  <option value="" disabled>
                    -- Select GRN --
                  </option>
                  {orders
                    .find((o) => o.id === matchPoId)
                    ?.grns?.map((grn: any) => (
                      <option key={grn.id} value={grn.id}>
                        {grn.grn_code} — Received Qty: {grn.received_quantity}
                      </option>
                    ))}
                </select>
                {(!orders.find((o) => o.id === matchPoId)?.grns ||
                  orders.find((o) => o.id === matchPoId)?.grns?.length === 0) && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Notice: This PO has no GRN yet. Receive goods first from Requisitions tab to enable 3-way match.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Supplier Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-9041"
                    className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Billed Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={billedQuantity}
                    onChange={(e) => setBilledQuantity(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Invoiced Total Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 font-mono"
                  required
                />
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 text-[11px] text-slate-600">
                <span className="font-semibold text-indigo-900">3-Way Match Rule:</span> Quantity must match GRN received
                units, and price variance must be &le; 1.0%. Successful match automatically credits Accounts Payable
                and debits GR/IR Suspense.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowMatchModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submittingMatch || !matchGrnId}>
                  {submittingMatch ? 'Matching...' : 'Execute 3-Way Match'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTER SUPPLIER */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Register New Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Supplier Code</label>
                  <input
                    type="text"
                    value={supplierCode}
                    onChange={(e) => setSupplierCode(e.target.value)}
                    placeholder="e.g. SUP-TECH-01"
                    className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Payment Terms</label>
                  <select
                    value={supplierTerms}
                    onChange={(e) => setSupplierTerms(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 font-mono"
                  >
                    <option value="NET30">NET30</option>
                    <option value="NET60">NET60</option>
                    <option value="IMMEDIATE">IMMEDIATE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Company Name</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Apex Industrial Supplies Ltd"
                  className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    placeholder="sales@vendor.com"
                    className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="+91 98200 12345"
                    className="w-full p-2 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowSupplierModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submittingSupplier}>
                  {submittingSupplier ? 'Registering...' : 'Register Supplier'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
