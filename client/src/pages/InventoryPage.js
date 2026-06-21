import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import ExportButton from '../components/ExportButton';
import PrintButton from '../components/common/PrintButton';
import {
  Package, Plus, X, AlertTriangle, Search, ArrowDown, ArrowUp,
  History, Beaker, RefreshCw,
} from 'lucide-react';

const categoryOptions = [
  { value: '', label: 'All' },
  { value: 'chemical', label: 'Chemical' },
  { value: 'supply', label: 'Supply' },
  { value: 'part', label: 'Part' },
  { value: 'cleaning', label: 'Cleaning' },
];

const unitOptions = ['gallons', 'liters', 'cases', 'each', 'lbs'];

const usageTypes = [
  { value: 'usage', label: 'Used', qty: -1 },
  { value: 'restock', label: 'Restocked', qty: 1 },
  { value: 'adjustment', label: 'Adjustment', qty: 1 },
  { value: 'waste', label: 'Waste', qty: -1 },
];

export default function InventoryPage() {
  const { currentLocation, user } = useAuth();
  const [items, setItems] = useState([]);
  const [filterCat, setFilterCat] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [usageModal, setUsageModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [form, setForm] = useState({ name: '', category: 'chemical', unit: 'gallons', currentStock: '', minStock: '', maxStock: '', costPerUnit: '' });
  const [usageForm, setUsageForm] = useState({ type: 'usage', quantity: '', notes: '' });
  const [error, setError] = useState('');
  const [showBulkRestock, setShowBulkRestock] = useState(false);
  const [bulkItems, setBulkItems] = useState({});

  const toast = useToast();
  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchItems = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const params = {};
      if (filterCat) params.category = filterCat;
      if (lowStockOnly) params.lowStock = 'true';
      const { data } = await api.get(`/locations/${currentLocation.id}/inventory`, { params });
      setItems(data);
    } catch (err) {
      toast.error('Failed to load inventory');
    }
  }, [currentLocation, filterCat, lowStockOnly, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/locations/${currentLocation.id}/inventory`, {
        ...form,
        currentStock: parseFloat(form.currentStock) || 0,
        minStock: parseFloat(form.minStock) || 0,
        maxStock: form.maxStock ? parseFloat(form.maxStock) : null,
        costPerUnit: form.costPerUnit ? parseFloat(form.costPerUnit) : null,
      });
      setShowAdd(false);
      setForm({ name: '', category: 'chemical', unit: 'gallons', currentStock: '', minStock: '', maxStock: '', costPerUnit: '' });
      fetchItems();
      toast.success('Item added successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add item');
    }
  };

  const logUsage = async (e) => {
    e.preventDefault();
    const typeInfo = usageTypes.find((t) => t.value === usageForm.type);
    const qty = parseFloat(usageForm.quantity) * typeInfo.qty;
    try {
      await api.post(`/locations/${currentLocation.id}/inventory/${usageModal}/usage`, {
        quantity: qty,
        type: usageForm.type,
        notes: usageForm.notes || null,
      });
      setUsageModal(null);
      setUsageForm({ type: 'usage', quantity: '', notes: '' });
      fetchItems();
      toast.success('Usage logged successfully');
    } catch (err) {
      toast.error('Failed to log usage');
    }
  };

  const fetchHistory = async (itemId) => {
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/inventory/${itemId}/history`);
      setHistoryLogs(data);
      setHistoryModal(itemId);
    } catch (err) {
      toast.error('Failed to load history');
    }
  };

  const handleBulkRestock = async () => {
    const restockItems = Object.entries(bulkItems)
      .filter(([, v]) => v.quantity > 0)
      .map(([itemId, { quantity, notes }]) => ({ itemId, quantity: parseFloat(quantity), notes }));
    if (restockItems.length === 0) { toast.error('Enter quantities to restock'); return; }
    try {
      await api.post(`/locations/${currentLocation.id}/inventory/bulk/restock`, { items: restockItems });
      setShowBulkRestock(false);
      setBulkItems({});
      fetchItems();
      toast.success(`${restockItems.length} items restocked`);
    } catch (err) { toast.error('Failed to bulk restock'); }
  };

  if (!currentLocation) return null;

  const lowCount = items.filter((i) => i.currentStock <= i.minStock).length;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-stock">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <Package className="w-6 h-6 text-stock" /> Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-1">Stock levels and reorders at {currentLocation.name}</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <ExportButton endpoint={`/locations/${currentLocation.id}/export/inventory`} filename="inventory.csv" label="Export" />
          {isManager && (
            <button onClick={() => { setShowBulkRestock(true); setBulkItems({}); }} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" /> Cycle Count
            </button>
          )}
          {isManager && (
            <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Items', value: items.length, dot: 'bg-stock' },
          { label: 'Low Stock', value: lowCount, dot: 'bg-red-400', hint: 'Below minimum' },
          { label: 'Inventory Value', value: '$' + items.reduce((sum, i) => sum + (i.currentStock || 0) * (i.costPerUnit || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 }), dot: 'bg-green-400' },
          { label: 'Auto Reorders', value: 0, dot: 'bg-purple-400', hint: 'Open orders' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{s.label}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{s.value}</p>
            {s.hint && <p className="text-xs text-gray-400 mt-1">{s.hint}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {categoryOptions.map((c) => (
          <button key={c.value} onClick={() => setFilterCat(c.value)} className={`px-3 py-1.5 text-sm rounded-lg border ${filterCat === c.value ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            {c.label}
          </button>
        ))}
        <button onClick={() => setLowStockOnly(!lowStockOnly)} className={`px-3 py-1.5 text-sm rounded-lg border flex items-center gap-1 ${lowStockOnly ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
          <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
        </button>
      </div>

      {/* Add form */}
      {/* Bulk Restock Modal */}
      {showBulkRestock && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkRestock(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Bulk Restock</h3>
              <button onClick={() => setShowBulkRestock(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {items.map((item) => {
                const isLow = item.currentStock <= item.minStock;
                return (
                  <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isLow ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">Current: {item.currentStock} / Min: {item.minStock} {item.unit}</p>
                    </div>
                    <input
                      type="number" min="0" step="1" placeholder="Qty"
                      value={bulkItems[item.id]?.quantity || ''}
                      onChange={(e) => setBulkItems({ ...bulkItems, [item.id]: { ...bulkItems[item.id], quantity: e.target.value } })}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <button onClick={handleBulkRestock} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Restock All</button>
              <button onClick={() => setShowBulkRestock(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Add Inventory Item</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <form onSubmit={addItem} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                {categoryOptions.filter((c) => c.value).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
              <input type="number" step="0.1" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock (Reorder Point)</label>
              <input type="number" step="0.1" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Per Unit ($)</label>
              <input type="number" step="0.01" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
            </div>
            <div className="md:col-span-3 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">Add Item</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Usage modal */}
      {usageModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setUsageModal(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Log Usage</h3>
              <button onClick={() => setUsageModal(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={logUsage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={usageForm.type} onChange={(e) => setUsageForm({ ...usageForm, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                  {usageTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input type="number" step="0.1" value={usageForm.quantity} onChange={(e) => setUsageForm({ ...usageForm, quantity: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={usageForm.notes} onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">Save</button>
                <button type="button" onClick={() => setUsageModal(null)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setHistoryModal(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Usage History</h3>
              <button onClick={() => setHistoryModal(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            {historyLogs.length > 0 ? (
              <div className="space-y-2">
                {historyLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.quantity > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                      {log.quantity > 0 ? <ArrowUp className="w-4 h-4 text-green-600" /> : <ArrowDown className="w-4 h-4 text-red-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 capitalize">{log.type} · {Math.abs(log.quantity)}</p>
                      <p className="text-xs text-gray-500">{log.user.firstName} {log.user.lastName} · {new Date(log.createdAt).toLocaleString()}</p>
                      {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No usage history</p>
            )}
          </div>
        </div>
      )}

      {/* Inventory grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const isLow = item.currentStock <= item.minStock;
          const stockPct = item.maxStock ? Math.min(100, Math.round((item.currentStock / item.maxStock) * 100)) : null;

          return (
            <div key={item.id} className={`bg-white rounded-xl border p-5 ${isLow ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-xs text-gray-500 capitalize">{item.category}{item.supplier ? ` · ${item.supplier.name}` : ''}</p>
                </div>
                {isLow && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />}
              </div>

              <div className="mt-3">
                <div className="flex items-end justify-between mb-1">
                  <span className={`text-2xl font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{item.currentStock}</span>
                  <span className="text-xs text-gray-500">{item.unit} · min: {item.minStock}</span>
                </div>
                {stockPct !== null && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${isLow ? 'bg-red-500' : stockPct > 60 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${stockPct}%` }} />
                  </div>
                )}
              </div>

              {item.costPerUnit && <p className="text-xs text-gray-400 mt-2">${item.costPerUnit.toFixed(2)} per {item.unit}</p>}

              <div className="mt-3 flex gap-2">
                <button onClick={() => setUsageModal(item.id)} className="flex-1 text-xs px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 flex items-center justify-center gap-1">
                  <Beaker className="w-3 h-3" /> Log Usage
                </button>
                <button onClick={() => fetchHistory(item.id)} className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 flex items-center gap-1">
                  <History className="w-3 h-3" /> History
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">{lowStockOnly ? 'No low stock items' : 'No inventory items yet'}</p>
        </div>
      )}
    </div>
  );
}
