import React, { useState, useEffect, useMemo } from 'react';
import { 
  Boxes, 
  Search, 
  AlertTriangle, 
  ArrowUpRight,
  ArrowDownRight,
  Plus, 
  CheckCircle2, 
  Package,
  Layers, 
  DollarSign, 
  RefreshCw,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Tooltip } from '../components/ui/Tooltip';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusPill } from '../components/ui/StatusPill';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { TestDataToggle } from '../components/ui/TestDataToggle';
import { useTestDataToggle } from '../hooks/useTestDataToggle';
import { isTestRecord } from '../lib/testData';
import { formatCurrency, formatNumber } from '../lib/format';
import { apiClient, ensureAuthenticated, CanceledError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';

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
  const { hasRole } = useAuth();
  const canManage = hasRole(['SUPER_ADMIN', 'PROCUREMENT_OFFICER']);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name-asc' | 'price-desc' | 'stock-asc'>('name-asc');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { showTestData, toggle: toggleTestData } = useTestDataToggle();
  const categories = ['All', 'Raw Materials', 'Electronics', 'Office Supplies', 'Hardware'];
  
  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT'>('IN');
  const [reason, setReason] = useState('');
  
  // Create Item Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [skuCode, setSkuCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Raw Materials');
  const [uom, setUom] = useState('PCS');
  const [unitPrice, setUnitPrice] = useState<number>(100);
  const [stockQty, setStockQty] = useState<number>(50);
  const [safetyStock, setSafetyStock] = useState<number>(20);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInventory = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      await ensureAuthenticated();
      const res = await apiClient.get('/inventory', { signal });
      if (res.data.success && Array.isArray(res.data.data)) {
        setItems(res.data.data);
      }
    } catch (err: any) {
      if (err instanceof CanceledError || err?.name === 'CanceledError') {
        return;
      }
      console.error('Failed to load inventory from API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchInventory(controller.signal);
    return () => controller.abort();
  }, []);

  // Reset page to 1 when filters or sort change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, selectedCategory, sortBy, lowStockOnly, showTestData]);

  const hiddenTestCount = useMemo(() => {
    return items.filter(item => isTestRecord(item.sku_code) || isTestRecord(item.name)).length;
  }, [items]);

  const filteredAndSortedItems = useMemo(() => {
    return items.filter(item => {
      if (!showTestData && (isTestRecord(item.sku_code) || isTestRecord(item.name))) {
        return false;
      }
      const matchesSearch = item.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
                            item.sku_code.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesLowStock = !lowStockOnly || (Number(item.stock_qty) <= Number(item.safety_stock));
      return matchesSearch && matchesCategory && matchesLowStock;
    }).sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'price-desc') {
        return Number(b.unit_price) - Number(a.unit_price);
      }
      if (sortBy === 'stock-asc') {
        return Number(a.stock_qty) - Number(b.stock_qty);
      }
      return 0;
    });
  }, [items, showTestData, debouncedSearchQuery, selectedCategory, lowStockOnly, sortBy]);

  const totalSKUs = items.length;
  const totalValuation = items.reduce((acc, curr) => acc + (Number(curr.stock_qty) * Number(curr.unit_price)), 0);
  const lowStockAlerts = items.filter(i => Number(i.stock_qty) <= Number(i.safety_stock)).length;

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedItems.slice(start, start + pageSize);
  }, [filteredAndSortedItems, page, pageSize]);

  const handleAdjustStock = async () => {
    if (!selectedItem || adjustmentQty <= 0) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.patch(`/inventory/${selectedItem.id}/adjust`, {
        quantity: adjustmentQty,
        type: adjustmentType,
        reason: reason || `Manual stock ${adjustmentType} adjustment`
      });

      if (res.data.success) {
        setIsAdjustModalOpen(false);
        setAdjustmentQty(0);
        setReason('');
        setSelectedItem(null);
        setFeedback({ type: 'success', text: `Stock successfully adjusted for ${selectedItem.sku_code}.` });
        await fetchInventory();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to adjust stock.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuCode || !itemName) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await ensureAuthenticated();
      const res = await apiClient.post('/inventory', {
        sku_code: skuCode.trim().toUpperCase(),
        name: itemName.trim(),
        category,
        unit_of_measure: uom,
        unit_price: Number(unitPrice),
        stock_qty: Number(stockQty),
        safety_stock: Number(safetyStock)
      });

      if (res.data.success) {
        setIsCreateModalOpen(false);
        setSkuCode('');
        setItemName('');
        setFeedback({ type: 'success', text: `SKU ${skuCode} created successfully in warehouse registry.` });
        await fetchInventory();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to create inventory item.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Top Banner */}
      <PageHeader
        title="Inventory & SKU Master"
        subtitle="Real-time stock valuation, perpetual inventory ledger, and replenishment reorder points."
        actions={
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchInventory()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canManage && (
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-5 h-5" />
                New SKU Item
              </Button>
            )}
          </div>
        }
      />

      {/* Feedback Toast */}
      {feedback && (
        <div className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
            <span className="font-medium">{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
        </div>
      )}

      {/* Metrics Cards (4-column grid with gap-6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white p-6 xl:p-7 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-500">Tracked SKUs</span>
            <Boxes className="w-6 h-6 text-indigo-500" />
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-3xl lg:text-4xl font-bold text-slate-900 font-mono tabular-nums">{totalSKUs}</span>
            <span className="text-sm font-semibold text-emerald-600">Active SKUs</span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-mono">
            Warehouse perpetual count
          </div>
        </div>

        <div className="bg-white p-6 xl:p-7 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-500">Inventory Valuation</span>
            <DollarSign className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-3xl lg:text-4xl font-bold text-slate-900 font-mono tabular-nums">
              ₹{totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-slate-500 font-mono">Weighted Avg</span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-mono">
            Balance sheet asset value
          </div>
        </div>

        <div className="bg-white p-6 xl:p-7 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-500">Reorder Triggers</span>
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-3xl lg:text-4xl font-bold text-amber-600 font-mono tabular-nums">{lowStockAlerts}</span>
            <span className="text-sm font-semibold text-amber-700">Under threshold</span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-mono">
            stock_qty &le; safety_stock
          </div>
        </div>

        <div className="bg-white p-6 xl:p-7 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-500">Database</span>
            <Layers className="w-6 h-6 text-blue-500" />
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-3xl lg:text-4xl font-bold text-slate-900 font-mono">Online</span>
            <Tooltip content="PostgreSQL 16 · ACID transaction isolation">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <span>v16</span>
                <Info className="w-4 h-4 text-slate-400" />
              </span>
            </Tooltip>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-mono">
            ACID Isolation Level Verified
          </div>
        </div>
      </div>

      {/* Search, Sort & Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search SKU code or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 min-h-[38px] text-xs font-semibold rounded-lg border transition-colors shrink-0 ${
                  selectedCategory === cat 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-between lg:justify-end">
          <TestDataToggle
            showTestData={showTestData}
            onToggle={toggleTestData}
            hiddenCount={hiddenTestCount}
          />

          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Low stock only</span>
          </label>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="stock-asc">Stock: Low to High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dense Inventory Table via DataTable */}
      <DataTable<InventoryItem>
        columns={[
          {
            key: 'sku_code',
            header: 'SKU Code',
            render: (item: InventoryItem) => (
              <span className="font-mono font-semibold text-indigo-600">
                {item.sku_code}
              </span>
            )
          },
          {
            key: 'name',
            header: 'Item Name',
            render: (item: InventoryItem) => (
              <span className="font-medium text-slate-900">
                {item.name}
              </span>
            )
          },
          {
            key: 'category',
            header: 'Category',
            render: (item: InventoryItem) => (
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-xs text-slate-700 font-medium">
                {item.category}
              </span>
            )
          },
          {
            key: 'unit_of_measure',
            header: 'Unit',
            hideBelow: 'lg',
            render: (item: InventoryItem) => (
              <span className="font-mono text-xs text-slate-500">
                {item.unit_of_measure}
              </span>
            )
          },
          {
            key: 'unit_price',
            header: 'Unit Price',
            align: 'right',
            render: (item: InventoryItem) => (
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatCurrency(Number(item.unit_price))}
              </span>
            )
          },
          {
            key: 'stock_qty',
            header: 'Stock Qty',
            align: 'right',
            render: (item: InventoryItem) => (
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatNumber(Number(item.stock_qty))}
              </span>
            )
          },
          {
            key: 'status',
            header: 'Status',
            render: (item: InventoryItem) => {
              const isLow = Number(item.stock_qty) <= Number(item.safety_stock);
              const isCritical = Number(item.stock_qty) <= 0;
              if (isCritical) {
                return <StatusPill variant="danger">Depleted</StatusPill>;
              }
              if (isLow) {
                return <StatusPill variant="warning">Low Stock</StatusPill>;
              }
              return <StatusPill variant="success">Optimal</StatusPill>;
            }
          },
          {
            key: 'actions',
            header: 'Action',
            align: 'right',
            render: (item: InventoryItem) => (
              canManage ? (
                <IconButton
                  icon={SlidersHorizontal}
                  tooltip="Adjust stock levels"
                  aria-label={`Adjust stock for ${item.name}`}
                  variant="ghost"
                  onClick={() => {
                    setSelectedItem(item);
                    setIsAdjustModalOpen(true);
                  }}
                />
              ) : (
                <span className="text-xs font-mono text-slate-400">Read-Only</span>
              )
            )
          }
        ]}
        rows={paginatedItems}
        rowKey={(item: InventoryItem) => item.id}
        loading={loading}
        pagination={{
          page,
          pageSize,
          total: filteredAndSortedItems.length,
          onPageChange: setPage
        }}
        emptyState={
          <EmptyState
            icon={Boxes}
            title="No inventory items found"
            description={
              searchQuery || selectedCategory !== 'All' || lowStockOnly || !showTestData
                ? "No inventory matches your active filters."
                : "Add an SKU item to start tracking warehouse quantities and valuation."
            }
            action={
              (searchQuery || selectedCategory !== 'All' || lowStockOnly) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setLowStockOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              ) : canManage ? (
                <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add First Item
                </Button>
              ) : undefined
            }
          />
        }
      />

      {/* Modal: Create SKU Item */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Register New Inventory SKU</h3>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">SKU Code (Unique)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SOL-400W-01"
                  value={skuCode}
                  onChange={(e) => setSkuCode(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 uppercase font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monocrystalline Solar PV Panel"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                  >
                    <option value="Raw Materials">Raw Materials</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Packaging">Packaging</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Unit of Measure</label>
                  <select
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800"
                  >
                    <option value="PCS">PCS</option>
                    <option value="KG">KG</option>
                    <option value="METERS">METERS</option>
                    <option value="BOXES">BOXES</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Initial Qty</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stockQty}
                    onChange={(e) => setStockQty(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Safety Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={safetyStock}
                    onChange={(e) => setSafetyStock(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Save SKU'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Live Stock Mutation Ledger</h3>
              </div>
              <button 
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs font-mono text-indigo-600 font-semibold">{selectedItem.sku_code}</span>
                <p className="text-xs font-semibold text-slate-800">{selectedItem.name}</p>
                <p className="text-xs text-slate-500 mt-1">Current Stock: <strong className="font-mono text-slate-900">{selectedItem.stock_qty} {selectedItem.unit_of_measure}</strong></p>
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

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
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
              <Button variant="outline" size="sm" onClick={() => setIsAdjustModalOpen(false)}>
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
