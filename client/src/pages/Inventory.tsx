import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Search, 
  Filter, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  CheckCircle2,
  Package,
  Layers,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { apiClient, ensureAuthenticated } from '../services/api';

interface InventoryItem {
  id: string;
  sku_code: string;
  name: string;
  category: string;
  unit_of_measure: string;
  unit_price: number;
  stock_qty: number;
  safety_stock: number;
  created_at: string;
}

export const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT'>('IN');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.get('/inventory');
      if (res.data.success && Array.isArray(res.data.data)) {
        setItems(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load inventory from API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.sku_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalSKUs = items.length;
  const totalValuation = items.reduce((acc, curr) => acc + (Number(curr.stock_qty) * Number(curr.unit_price)), 0);
  const lowStockAlerts = items.filter(i => Number(i.stock_qty) <= Number(i.safety_stock)).length;

  const handleAdjustStock = async () => {
    if (!selectedItem || adjustmentQty <= 0) return;
    setSubmitting(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.patch(`/inventory/${selectedItem.id}/adjust`, {
        quantity: adjustmentQty,
        type: adjustmentType,
        reason: reason || `Manual stock ${adjustmentType} adjustment`
      });

      if (res.data.success) {
        setIsModalOpen(false);
        setAdjustmentQty(0);
        setReason('');
        setSelectedItem(null);
        await fetchInventory();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to adjust stock. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Inventory & SKU Master</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time stock valuation, perpetual inventory ledger, and replenishment reorder points.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchInventory}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {items.length > 0 && (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => {
                setSelectedItem(items[0]);
                setIsModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Stock Adjustment
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tracked SKUs</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">{totalSKUs}</span>
            <span className="text-[11px] text-emerald-600 font-medium">100% active</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Inventory Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              ₹{totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Weighted Avg</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Reorder Triggers</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 font-mono">{lowStockAlerts}</span>
            <span className="text-[11px] text-amber-700 font-medium">Under threshold</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Storage Bins</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">Active</span>
            <span className="text-[11px] text-slate-400 font-mono">PostgreSQL 16</span>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search SKU code or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">Category:</span>
          {['All', 'Raw Materials', 'Electronics', 'Office Supplies'].map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                selectedCategory === category 
                  ? 'bg-indigo-600 text-white font-medium' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Stripe-style Dense Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
            Master SKU Inventory Catalog (PostgreSQL Live)
          </h3>
          <span className="text-xs text-slate-400 font-mono">{filteredItems.length} records</span>
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                <tr>
                  <th className="py-3 px-4 font-semibold">SKU Code</th>
                  <th className="py-3 px-4 font-semibold">Item Name</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Unit</th>
                  <th className="py-3 px-4 font-semibold text-right">Unit Price</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock Qty</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">Loading live inventory from database...</td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">No inventory items found.</td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
                    const isLow = Number(item.stock_qty) <= Number(item.safety_stock);
                    const isCritical = Number(item.stock_qty) <= 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-indigo-600">
                          {item.sku_code}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-600">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                          {item.unit_of_measure}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right text-slate-900 font-medium">
                          ₹{Number(item.unit_price).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right font-bold text-slate-900">
                          {item.stock_qty}
                        </td>
                        <td className="py-3.5 px-4">
                          {isCritical ? (
                            <Badge variant="danger" className="text-[10px]">Depleted</Badge>
                          ) : isLow ? (
                            <Badge variant="warning" className="text-[10px]">Reorder Needed</Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px]">Optimal Stock</Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setIsModalOpen(true);
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Live Stock Mutation Ledger</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-[11px] font-mono text-indigo-600 font-semibold">{selectedItem.sku_code}</span>
                <p className="text-xs font-semibold text-slate-800">{selectedItem.name}</p>
                <p className="text-[11px] text-slate-500 mt-1">Current Stock: <strong className="font-mono text-slate-900">{selectedItem.stock_qty} {selectedItem.unit_of_measure}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('IN')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border ${
                    adjustmentType === 'IN'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                  Stock In (Receipt)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('OUT')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border ${
                    adjustmentType === 'OUT'
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                  Stock Out (Issue)
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={adjustmentQty || ''}
                  onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                  placeholder="Enter adjustment quantity"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Audit Justification / Batch Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Received shipment PO-802, damaged in transit"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>New Balance:</span>
                  <strong className="font-mono text-slate-900">
                    {adjustmentType === 'IN' 
                      ? Number(selectedItem.stock_qty) + (adjustmentQty || 0)
                      : Math.max(0, Number(selectedItem.stock_qty) - (adjustmentQty || 0))} {selectedItem.unit_of_measure}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Audit Event:</span>
                  <span className="font-mono">STOCK_{adjustmentType}_ADJUSTMENT</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleAdjustStock} 
                disabled={adjustmentQty <= 0 || submitting}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {submitting ? 'Committing...' : 'Commit Mutation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
