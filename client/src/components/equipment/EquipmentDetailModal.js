import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  X, Wrench, ClipboardCheck, Package, Info, ExternalLink, Plus, Trash2,
  CheckCircle2, Clock, AlertTriangle, Boxes, Link2,
} from 'lucide-react';

const AREA_LABEL = { tunnel: 'Tunnel', backroom: 'Backroom', electrical_room: 'Electrical Room', vacuum_area: 'Vacuum Area', other: 'Other' };
const woStatus = {
  open: 'bg-amber-100 text-amber-700', in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-purple-100 text-purple-700', approved: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500',
};

function blankPart() {
  return { partId: '', name: '', partNumber: '', manufacturer: '', specs: '', orderUrl: '', unitCost: '', inventoryItemId: '', quantityRequired: 1, notes: '' };
}

export default function EquipmentDetailModal({ locationId, equipmentId, isManager, onClose, onChanged }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('overview');
  const [inventory, setInventory] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [showAddPart, setShowAddPart] = useState(false);
  const [partMode, setPartMode] = useState('new'); // new | existing
  const [partForm, setPartForm] = useState(blankPart());

  const fetchDetail = useCallback(async () => {
    try {
      const { data } = await api.get(`/locations/${locationId}/equipment/${equipmentId}/detail`);
      setDetail(data);
    } catch { toast.error('Failed to load equipment file'); }
  }, [locationId, equipmentId, toast]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => {
    api.get(`/locations/${locationId}/inventory`).then(({ data }) => setInventory(data)).catch(() => {});
    api.get(`/locations/${locationId}/parts`).then(({ data }) => setCatalog(data)).catch(() => {});
  }, [locationId]);

  const addPart = async (e) => {
    e.preventDefault();
    try {
      const payload = partMode === 'existing'
        ? { partId: partForm.partId, quantityRequired: partForm.quantityRequired, notes: partForm.notes }
        : { ...partForm, partId: undefined };
      if (partMode === 'existing' && !payload.partId) { toast.error('Select a part'); return; }
      if (partMode === 'new' && !partForm.name) { toast.error('Part name is required'); return; }
      await api.post(`/locations/${locationId}/equipment/${equipmentId}/parts`, payload);
      setShowAddPart(false); setPartForm(blankPart()); fetchDetail();
      api.get(`/locations/${locationId}/parts`).then(({ data }) => setCatalog(data)).catch(() => {});
      toast.success('Part added');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add part'); }
  };

  const removePart = async (linkId) => {
    if (!window.confirm('Remove this part from the equipment?')) return;
    try { await api.delete(`/locations/${locationId}/equipment/${equipmentId}/parts/${linkId}`); fetchDetail(); toast.success('Part removed'); }
    catch { toast.error('Failed to remove part'); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

  if (!detail) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-8" onClick={(e) => e.stopPropagation()}>
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Info },
    { key: 'maintenance', label: `Maintenance (${detail.maintenanceLogs?.length || 0})`, icon: ClipboardCheck },
    { key: 'work_orders', label: `Work Orders (${detail.workOrders?.length || 0})`, icon: Wrench },
    { key: 'parts', label: `Parts (${detail.parts?.length || 0})`, icon: Package },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0"><Wrench className="w-6 h-6 text-brand-500" /></div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{detail.name}</h2>
              <p className="text-xs text-gray-400">{AREA_LABEL[detail.area] || 'Other'} · {detail.category?.replace(/_/g, ' ')}{detail.manufacturer ? ` · ${detail.manufacturer}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 border-b border-gray-100 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                  tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                ['Area', AREA_LABEL[detail.area] || 'Other'],
                ['Type', detail.category?.replace(/_/g, ' ')],
                ['Status', detail.status?.replace(/_/g, ' ')],
                ['Manufacturer', detail.manufacturer || '—'],
                ['Model', detail.model || '—'],
                ['Serial Number', detail.serialNumber || '—'],
                ['Purchase Date', fmtDate(detail.purchaseDate)],
                ['Purchase Cost', detail.purchaseCost != null ? `$${detail.purchaseCost.toFixed(2)}` : '—'],
                ['Install Date', fmtDate(detail.installDate)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{k}</p>
                  <p className="text-sm text-gray-900 mt-0.5 capitalize">{v}</p>
                </div>
              ))}
              {detail.notes && (
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Notes</p>
                  <p className="text-sm text-gray-700 mt-0.5">{detail.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* MAINTENANCE */}
          {tab === 'maintenance' && (
            <div className="space-y-2.5">
              {(detail.maintenanceLogs || []).map((m) => (
                <div key={m.id} className="border border-gray-100 rounded-xl p-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 capitalize">{m.type}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.category === 'repair' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{m.category}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{m.status}</span>
                    <span className="text-xs text-gray-400 ml-auto">{fmtDate(m.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{m.description}</p>
                  <p className="text-xs text-gray-400 mt-1">By {m.performedBy?.firstName} {m.performedBy?.lastName}{m.cost ? ` · $${m.cost.toFixed(2)}` : ''}</p>
                </div>
              ))}
              {(detail.maintenanceLogs || []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No maintenance records yet</p>}
            </div>
          )}

          {/* WORK ORDERS */}
          {tab === 'work_orders' && (
            <div className="space-y-2.5">
              {(detail.workOrders || []).map((w) => (
                <div key={w.id} className="border border-gray-100 rounded-xl p-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">{w.ticketNumber}</span>
                    <span className="text-sm font-semibold text-gray-900">{w.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto ${woStatus[w.status] || woStatus.open}`}>{w.status.replace(/_/g, ' ')}</span>
                  </div>
                  {w.description && <p className="text-sm text-gray-600 mt-1">{w.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {w.assignedTo ? `${w.assignedTo.firstName} ${w.assignedTo.lastName}` : 'Unassigned'} · {fmtDate(w.createdAt)}
                  </p>
                </div>
              ))}
              {(detail.workOrders || []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No work orders for this equipment</p>}
            </div>
          )}

          {/* PARTS */}
          {tab === 'parts' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">Replacement parts for this equipment, tied to site inventory.</p>
                {isManager && (
                  <button onClick={() => { setPartForm(blankPart()); setPartMode('new'); setShowAddPart(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg">
                    <Plus className="w-3.5 h-3.5" /> Add Part
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {(detail.parts || []).map((p) => (
                  <div key={p.linkId} className="border border-gray-100 rounded-xl p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-gray-900">{p.name}</h4>
                          {p.partNumber && <span className="text-[11px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{p.partNumber}</span>}
                          <span className="text-[10px] text-gray-400">Qty {p.quantityRequired}</span>
                        </div>
                        {p.specs && <p className="text-xs text-gray-500 mt-1">{p.specs}</p>}
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          {p.manufacturer && <span className="text-gray-400">{p.manufacturer}</span>}
                          {p.unitCost != null && <span className="text-gray-400">${p.unitCost.toFixed(2)}</span>}
                          {p.inventoryItemId ? (
                            <span className={`flex items-center gap-1 ${p.inventoryLow ? 'text-red-500' : 'text-green-600'}`}>
                              <Boxes className="w-3 h-3" /> {p.inStock} {p.inventoryUnit} in stock{p.inventoryLow ? ' · low' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-300 flex items-center gap-1"><Boxes className="w-3 h-3" /> not inventoried</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {p.orderUrl && (
                          <a href={p.orderUrl} target="_blank" rel="noreferrer" title="Order this part"
                            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100">
                            <ExternalLink className="w-3.5 h-3.5" /> Order
                          </a>
                        )}
                        {isManager && (
                          <button onClick={() => removePart(p.linkId)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {(detail.parts || []).length === 0 && (
                  <div className="text-center py-10">
                    <Package className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-600">No replacement parts listed</p>
                    <p className="text-xs text-gray-400 mt-1">Add the parts this equipment needs so managers know exactly what to order.</p>
                  </div>
                )}
              </div>

              {/* Add part form */}
              {showAddPart && (
                <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center gap-1.5 mb-3">
                    <button onClick={() => setPartMode('new')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${partMode === 'new' ? 'bg-brand-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>New part</button>
                    <button onClick={() => setPartMode('existing')} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg ${partMode === 'existing' ? 'bg-brand-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}><Link2 className="w-3.5 h-3.5" /> Link existing</button>
                  </div>
                  <form onSubmit={addPart} className="space-y-3">
                    {partMode === 'existing' ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Choose a part (already used by other equipment)</label>
                        <select value={partForm.partId} onChange={(e) => setPartForm({ ...partForm, partId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                          <option value="">Select a part…</option>
                          {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}{c.partNumber ? ` (#${c.partNumber})` : ''} — used by {c.usedByCount}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Part Name</label>
                          <input value={partForm.name} onChange={(e) => setPartForm({ ...partForm, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Vacuum motor bearing" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Part Number</label>
                          <input value={partForm.partNumber} onChange={(e) => setPartForm({ ...partForm, partNumber: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Manufacturer</label>
                          <input value={partForm.manufacturer} onChange={(e) => setPartForm({ ...partForm, manufacturer: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Specs</label>
                          <input value={partForm.specs} onChange={(e) => setPartForm({ ...partForm, specs: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. 6203-2RS, 17×40×12mm" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Order Link (quick reorder)</label>
                          <input value={partForm.orderUrl} onChange={(e) => setPartForm({ ...partForm, orderUrl: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="https://supplier.com/part/…" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Unit Cost ($)</label>
                          <input type="number" step="0.01" value={partForm.unitCost} onChange={(e) => setPartForm({ ...partForm, unitCost: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Link to Inventory Item</label>
                          <select value={partForm.inventoryItemId} onChange={(e) => setPartForm({ ...partForm, inventoryItemId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                            <option value="">Not inventoried</option>
                            {inventory.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit})</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity Required</label>
                        <input type="number" min="1" value={partForm.quantityRequired} onChange={(e) => setPartForm({ ...partForm, quantityRequired: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                        <input value={partForm.notes} onChange={(e) => setPartForm({ ...partForm, notes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg">Add Part</button>
                      <button type="button" onClick={() => setShowAddPart(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
