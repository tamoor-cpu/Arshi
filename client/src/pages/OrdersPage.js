import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { ShoppingCart, Plus, X, Trash2, Check, Truck, Package } from 'lucide-react';

const STATUS = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  ordered: { label: 'Ordered', color: 'bg-blue-100 text-blue-700' },
  received: { label: 'Received', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

export default function OrdersPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ name: '', qty: '', unit: 'each', cost: '' }]);

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchOrders = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await api.get(`/locations/${currentLocation.id}/orders`, { params });
      setOrders(data);
    } catch { toast.error('Failed to load orders'); }
  }, [currentLocation, filter, toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const addItemRow = () => setItems([...items, { name: '', qty: '', unit: 'each', cost: '' }]);
  const updateItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const removeItemRow = (i) => setItems(items.filter((_, idx) => idx !== i));

  const createOrder = async (e) => {
    e.preventDefault();
    const valid = items.filter((it) => it.name.trim());
    if (valid.length === 0) { toast.error('Add at least one item'); return; }
    try {
      await api.post(`/locations/${currentLocation.id}/orders`, { supplier, notes, items: valid });
      setShowAdd(false); setSupplier(''); setNotes(''); setItems([{ name: '', qty: '', unit: 'each', cost: '' }]);
      fetchOrders(); toast.success('Order created');
    } catch { toast.error('Failed to create order'); }
  };

  const setStatus = async (id, status) => {
    try { await api.patch(`/locations/${currentLocation.id}/orders/${id}`, { status }); fetchOrders(); toast.success(`Order ${STATUS[status].label.toLowerCase()}`); }
    catch { toast.error('Failed to update order'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    try { await api.delete(`/locations/${currentLocation.id}/orders/${id}`); fetchOrders(); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  if (!currentLocation) return null;

  const pending = orders.filter((o) => o.status === 'pending').length;
  const ordered = orders.filter((o) => o.status === 'ordered').length;
  const urgent = orders.filter((o) => o.status === 'pending' && o.autoCreated).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-stock">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <ShoppingCart className="w-6 h-6 text-stock" /> Orders
          </h1>
          <p className="text-sm text-gray-500 mt-1">Purchase orders and reorders at {currentLocation.name}</p>
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <button onClick={() => setFilter('ordered')} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
              <Check className="w-4 h-4" /> Receive
            </button>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 bg-stock hover:opacity-90 text-white text-sm font-semibold rounded-lg shadow-sm">
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending', value: pending, dot: 'bg-amber-400', hint: 'Awaiting order' },
          { label: 'Ordered', value: ordered, dot: 'bg-blue-400', hint: 'On the way' },
          { label: 'Urgent', value: urgent, dot: 'bg-red-400', hint: urgent ? 'Auto-reorders' : 'None right now' },
          { label: 'Avg. Fulfillment', value: '—', dot: 'bg-purple-400', hint: 'No data yet' },
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

      {/* Filter */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${!filter ? 'bg-stock/10 text-stock' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>All</button>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filter === k ? 'bg-stock/10 text-stock' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>{v.label}</button>
        ))}
      </div>

      {/* Orders list */}
      <div className="space-y-3">
        {orders.map((o) => {
          const st = STATUS[o.status] || STATUS.pending;
          return (
            <div key={o.id} className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-stock/10 flex items-center justify-center shrink-0"><ShoppingCart className="w-5 h-5 text-stock" /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">{o.poNumber}</h3>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                      {o.autoCreated && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">Auto</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{o.supplier || 'No supplier'} · {(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''}{o.totalCost ? ` · $${o.totalCost.toFixed(2)}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isManager && o.status === 'pending' && (
                    <button onClick={() => setStatus(o.id, 'ordered')} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100"><Truck className="w-3.5 h-3.5" /> Mark Ordered</button>
                  )}
                  {isManager && o.status === 'ordered' && (
                    <button onClick={() => setStatus(o.id, 'received')} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-100"><Check className="w-3.5 h-3.5" /> Mark Received</button>
                  )}
                  {isManager && <button onClick={() => remove(o.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
              {(o.items || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {o.items.map((it, i) => (
                    <span key={i} className="text-[11px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded">{it.qty || ''} {it.unit || ''} {it.name}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {orders.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl py-14 text-center">
            <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No orders</p>
            <p className="text-xs text-gray-400 mt-1">Create a purchase order or let low-stock items auto-generate reorders.</p>
          </div>
        )}
      </div>

      {/* New order modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">New Purchase Order</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createOrder} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier</label>
                <input value={supplier} onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stock/40 outline-none" placeholder="e.g. BlueWave Chemical" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Items</label>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} placeholder="Item name"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stock/40 outline-none" />
                      <input value={it.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} placeholder="Qty" type="number"
                        className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stock/40 outline-none" />
                      <input value={it.cost} onChange={(e) => updateItem(i, 'cost', e.target.value)} placeholder="$/ea" type="number" step="0.01"
                        className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stock/40 outline-none" />
                      {items.length > 1 && <button type="button" onClick={() => removeItemRow(i)} className="p-1.5 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addItemRow} className="mt-2 text-xs text-stock font-semibold hover:underline">+ Add item</button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stock/40 outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-stock hover:opacity-90 text-white text-sm font-semibold rounded-lg">Create Order</button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
