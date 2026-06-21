import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { Droplets, Plus, X, Pencil, Trash2, RefreshCw, AlertTriangle, FileText, Beaker } from 'lucide-react';

const TYPES = [
  { value: 'presoak', label: 'Pre-Soak' },
  { value: 'foam', label: 'Foam' },
  { value: 'detergent', label: 'Detergent' },
  { value: 'drying_agent', label: 'Drying Agent' },
  { value: 'tire_shine', label: 'Tire Shine' },
  { value: 'sealant', label: 'Sealant' },
  { value: 'other', label: 'Other' },
];
const typeLabel = (t) => TYPES.find((x) => x.value === t)?.label || 'Other';

function blank() {
  return { name: '', type: 'presoak', tankCapacity: '', currentLevel: '', dilutionRatio: '', supplier: '', costPerGallon: '', reorderPoint: '', notes: '' };
}

export default function ChemicalsPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [chemicals, setChemicals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [error, setError] = useState('');
  const [usageFor, setUsageFor] = useState(null);
  const [usageAmount, setUsageAmount] = useState('');
  const [usageNotes, setUsageNotes] = useState('');

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchChemicals = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/chemicals`);
      setChemicals(data);
    } catch { toast.error('Failed to load chemicals'); }
  }, [currentLocation, toast]);

  useEffect(() => { fetchChemicals(); }, [fetchChemicals]);

  const openCreate = () => { setEditing(null); setForm(blank()); setError(''); setShowForm(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name, type: c.type, tankCapacity: c.tankCapacity ?? '', currentLevel: c.currentLevel ?? '',
      dilutionRatio: c.dilutionRatio || '', supplier: c.supplier || '', costPerGallon: c.costPerGallon ?? '',
      reorderPoint: c.reorderPoint ?? '', notes: c.notes || '',
    });
    setError(''); setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.patch(`/locations/${currentLocation.id}/chemicals/${editing.id}`, form);
      else await api.post(`/locations/${currentLocation.id}/chemicals`, form);
      setShowForm(false); fetchChemicals();
      toast.success(editing ? 'Chemical updated' : 'Chemical added');
    } catch (err) { setError(err.response?.data?.error || 'Failed to save chemical'); }
  };

  const refill = async (c) => {
    try {
      await api.patch(`/locations/${currentLocation.id}/chemicals/${c.id}`, { currentLevel: c.tankCapacity || c.currentLevel, refill: true });
      fetchChemicals(); toast.success(`${c.name} refilled`);
    } catch { toast.error('Failed to refill'); }
  };

  const logUsage = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/locations/${currentLocation.id}/chemicals/${usageFor.id}/usage`, {
        amount: parseFloat(usageAmount),
        notes: usageNotes || null,
      });
      setUsageFor(null); setUsageAmount(''); setUsageNotes('');
      fetchChemicals(); toast.success(`Logged ${usageAmount} gal used from ${usageFor.name}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to log usage'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this chemical?')) return;
    try { await api.delete(`/locations/${currentLocation.id}/chemicals/${id}`); fetchChemicals(); toast.success('Chemical deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  if (!currentLocation) return null;

  const lowCount = chemicals.filter((c) => c.reorderPoint != null && c.currentLevel <= c.reorderPoint).length;
  const needSds = chemicals.filter((c) => !c.sdsEntryId).length;
  const avgLevel = chemicals.length
    ? Math.round(chemicals.filter((c) => c.tankCapacity).reduce((s, c) => s + (c.currentLevel / c.tankCapacity) * 100, 0) / (chemicals.filter((c) => c.tankCapacity).length || 1))
    : 0;

  const pct = (c) => (c.tankCapacity ? Math.min(100, Math.round((c.currentLevel / c.tankCapacity) * 100)) : null);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-chem">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <Droplets className="w-6 h-6 text-chem" /> Chemicals
          </h1>
          <p className="text-sm text-gray-500 mt-1">Tank levels and chemical usage at {currentLocation.name}</p>
        </div>
        {isManager && (
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-chem hover:opacity-90 text-white text-sm font-semibold rounded-lg shadow-sm">
            <Plus className="w-4 h-4" /> Add Chemical
          </button>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Chemicals', value: chemicals.length, dot: 'bg-chem' },
          { label: 'Low / Reorder', value: lowCount, dot: 'bg-red-400', hint: 'At or below reorder point' },
          { label: 'Avg Tank Level', value: `${avgLevel}%`, dot: 'bg-blue-400' },
          { label: 'Need SDS', value: needSds, dot: 'bg-amber-400', hint: 'Missing safety sheet' },
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

      {/* Chemical cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {chemicals.map((c) => {
          const level = pct(c);
          const low = c.reorderPoint != null && c.currentLevel <= c.reorderPoint;
          return (
            <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-chem/10 flex items-center justify-center shrink-0">
                    <Droplets className="w-5 h-5 text-chem" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{c.name}</h3>
                    <p className="text-xs text-gray-400">{typeLabel(c.type)}{c.dilutionRatio ? ` · ${c.dilutionRatio}` : ''}{c.supplier ? ` · ${c.supplier}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!c.sdsEntryId && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded"><FileText className="w-3 h-3" /> No SDS</span>
                  )}
                  {isManager && (
                    <>
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(c.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>

              {/* Tank level */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">{c.tankCapacity ? `${c.currentLevel} / ${c.tankCapacity} gal` : `${c.currentLevel} gal`}</span>
                  <span className={`font-semibold ${low ? 'text-red-600' : level != null && level < 30 ? 'text-amber-600' : 'text-gray-700'}`}>
                    {level != null ? `${level}%` : '—'}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-2.5 rounded-full ${low ? 'bg-red-500' : level != null && level < 30 ? 'bg-amber-500' : 'bg-chem'}`}
                    style={{ width: `${level ?? 0}%` }} />
                </div>
                {low && <p className="flex items-center gap-1 text-[11px] text-red-500 mt-1.5"><AlertTriangle className="w-3 h-3" /> Below reorder point ({c.reorderPoint} gal)</p>}
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => { setUsageFor(c); setUsageAmount(''); setUsageNotes(''); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-chem/10 text-chem text-xs font-semibold rounded-lg hover:bg-chem/20">
                  <Beaker className="w-3.5 h-3.5" /> Log Usage
                </button>
                {isManager && (
                  <button onClick={() => refill(c)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-chem/10 text-chem text-xs font-semibold rounded-lg hover:bg-chem/20">
                    <RefreshCw className="w-3.5 h-3.5" /> Mark Refilled
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {chemicals.length === 0 && (
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl py-14 text-center">
            <Droplets className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No chemicals tracked</p>
            <p className="text-xs text-gray-400 mt-1">Add your wash chemicals to track tank levels, dilution, and usage.</p>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-chem">OPERATIONS</p>
                <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit Chemical' : 'Add Chemical'}</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" placeholder="e.g. Hi-pH Pre-Soak" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none">
                    {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Dilution Ratio</label>
                  <input value={form.dilutionRatio} onChange={(e) => setForm({ ...form, dilutionRatio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" placeholder="1:128" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tank Capacity (gal)</label>
                  <input type="number" step="0.1" value={form.tankCapacity} onChange={(e) => setForm({ ...form, tankCapacity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Current Level (gal)</label>
                  <input type="number" step="0.1" value={form.currentLevel} onChange={(e) => setForm({ ...form, currentLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Reorder Point (gal)</label>
                  <input type="number" step="0.1" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cost / gal ($)</label>
                  <input type="number" step="0.01" value={form.costPerGallon} onChange={(e) => setForm({ ...form, costPerGallon: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier</label>
                  <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="px-4 py-2 bg-chem hover:opacity-90 text-white text-sm font-semibold rounded-lg">{editing ? 'Save Changes' : 'Add Chemical'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Usage modal */}
      {usageFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setUsageFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Log Usage — {usageFor.name}</h3>
              <button onClick={() => setUsageFor(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={logUsage} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Amount Used (gal)</label>
                <input type="number" step="0.1" min="0" value={usageAmount} onChange={(e) => setUsageAmount(e.target.value)} required autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
                <p className="text-[11px] text-gray-400 mt-1">Current level: {usageFor.currentLevel} gal. This will decrement the tank.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <input value={usageNotes} onChange={(e) => setUsageNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-chem hover:opacity-90 text-white text-sm font-semibold rounded-lg">Log Usage</button>
                <button type="button" onClick={() => setUsageFor(null)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
