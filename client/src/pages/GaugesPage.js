import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { Gauge, Plus, X, Pencil, Trash2, Activity, History, CheckCircle2, AlertTriangle } from 'lucide-react';

const CATEGORIES = [
  { value: 'pressure', label: 'Pressure', unit: 'psi' },
  { value: 'temperature', label: 'Temperature', unit: '°F' },
  { value: 'chemical', label: 'Chemical', unit: '%' },
  { value: 'ph', label: 'pH', unit: 'pH' },
  { value: 'flow', label: 'Flow', unit: 'gpm' },
];

function gaugeStatus(g) {
  if (g.lastValue == null) return { key: 'none', label: 'No reading', color: 'bg-gray-100 text-gray-500' };
  if (g.targetMin != null && g.lastValue < g.targetMin) return { key: 'low', label: 'Below range', color: 'bg-red-100 text-red-700' };
  if (g.targetMax != null && g.lastValue > g.targetMax) return { key: 'high', label: 'Above range', color: 'bg-red-100 text-red-700' };
  return { key: 'ok', label: 'In range', color: 'bg-green-100 text-green-700' };
}

function blank() { return { name: '', category: 'pressure', unit: 'psi', targetMin: '', targetMax: '' }; }

export default function GaugesPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [gauges, setGauges] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [error, setError] = useState('');
  const [readingFor, setReadingFor] = useState(null);
  const [readingValue, setReadingValue] = useState('');
  const [historyFor, setHistoryFor] = useState(null);
  const [readings, setReadings] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // all | ok | attention | none

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchGauges = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/gauges`);
      setGauges(data);
    } catch { toast.error('Failed to load gauges'); }
  }, [currentLocation, toast]);

  useEffect(() => { fetchGauges(); }, [fetchGauges]);

  const openCreate = () => { setEditing(null); setForm(blank()); setError(''); setShowForm(true); };
  const openEdit = (g) => {
    setEditing(g);
    setForm({ name: g.name, category: g.category, unit: g.unit, targetMin: g.targetMin ?? '', targetMax: g.targetMax ?? '' });
    setError(''); setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.patch(`/locations/${currentLocation.id}/gauges/${editing.id}`, form);
      else await api.post(`/locations/${currentLocation.id}/gauges`, form);
      setShowForm(false); fetchGauges();
      toast.success(editing ? 'Gauge updated' : 'Gauge added');
    } catch (err) { setError(err.response?.data?.error || 'Failed to save gauge'); }
  };

  const logReading = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/locations/${currentLocation.id}/gauges/${readingFor.id}/readings`, { value: readingValue });
      setReadingFor(null); setReadingValue(''); fetchGauges();
      toast.success('Reading logged');
    } catch { toast.error('Failed to log reading'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this gauge?')) return;
    try { await api.delete(`/locations/${currentLocation.id}/gauges/${id}`); fetchGauges(); toast.success('Gauge deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  const openHistory = async (g) => {
    setHistoryFor(g);
    try { const { data } = await api.get(`/locations/${currentLocation.id}/gauges/${g.id}/readings`); setReadings(data); }
    catch { setReadings([]); }
  };

  if (!currentLocation) return null;

  const inRange = gauges.filter((g) => gaugeStatus(g).key === 'ok').length;
  const outOfRange = gauges.filter((g) => gaugeStatus(g).key === 'low' || gaugeStatus(g).key === 'high').length;
  const unread = gauges.filter((g) => g.lastValue == null).length;
  const checked = gauges.length - unread;
  const healthPct = checked ? Math.round((inRange / checked) * 100) : 0;

  const matchesFilter = (g) => {
    if (statusFilter === 'all') return true;
    const k = gaugeStatus(g).key;
    if (statusFilter === 'ok') return k === 'ok';
    if (statusFilter === 'attention') return k === 'low' || k === 'high';
    if (statusFilter === 'none') return k === 'none';
    return true;
  };
  const visibleGauges = gauges.filter(matchesFilter);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <Gauge className="w-6 h-6 text-brand-500" /> Gauges
          </h1>
          <p className="text-sm text-gray-500 mt-1">Tunnel and chemical gauge readings at {currentLocation.name}</p>
        </div>
        {isManager && (
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-sm">
            <Plus className="w-4 h-4" /> Add Gauge
          </button>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'In Range', value: inRange, dot: 'bg-green-400', hint: `${healthPct}% healthy` },
          { label: 'Out of Range', value: outOfRange, dot: 'bg-red-400', hint: 'Needs attention' },
          { label: 'Not Checked', value: unread, dot: 'bg-amber-400', hint: 'Needs reading' },
          { label: 'Total', value: gauges.length, dot: 'bg-brand-400', hint: 'All gauges' },
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

      {/* Status filters */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {[
          { key: 'all', label: 'All' },
          { key: 'ok', label: '✓ In Range' },
          { key: 'attention', label: '⚠ Attention' },
          { key: 'none', label: '○ Not Checked' },
        ].map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${statusFilter === f.key ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Gauge cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleGauges.map((g) => {
          const st = gaugeStatus(g);
          return (
            <div key={g.id} className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0"><Activity className="w-4.5 h-4.5 text-brand-500" /></div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{g.name}</h3>
                    <p className="text-[11px] text-gray-400 capitalize">{g.category}</p>
                  </div>
                </div>
                {isManager && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => openEdit(g)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(g.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-bold text-gray-900">{g.lastValue != null ? g.lastValue : '—'}</span>
                <span className="text-sm text-gray-400 mb-1">{g.unit}</span>
                <span className={`ml-auto mb-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${st.color}`}>
                  {st.key === 'ok' ? <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> : (st.key === 'low' || st.key === 'high') ? <AlertTriangle className="w-3 h-3 inline mr-0.5" /> : null}
                  {st.label}
                </span>
              </div>
              {(g.targetMin != null || g.targetMax != null) && (
                <p className="text-[11px] text-gray-400 mt-1">Target: {g.targetMin ?? '—'} – {g.targetMax ?? '—'} {g.unit}</p>
              )}
              {g.lastReadingAt && <p className="text-[11px] text-gray-300 mt-0.5">Last: {new Date(g.lastReadingAt).toLocaleString()}</p>}

              <div className="flex gap-2 mt-4">
                <button onClick={() => { setReadingFor(g); setReadingValue(''); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 text-xs font-semibold rounded-lg hover:bg-brand-100">
                  <Plus className="w-3.5 h-3.5" /> Log Reading
                </button>
                <button onClick={() => openHistory(g)} className="px-3 py-2 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50"><History className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {gauges.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 bg-white border border-gray-100 rounded-2xl py-14 text-center">
            <Gauge className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No gauges configured</p>
            <p className="text-xs text-gray-400 mt-1">Add a gauge to start logging pressure, temperature, and chemical readings.</p>
          </div>
        )}
      </div>

      {/* Add/Edit gauge modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit Gauge' : 'Add Gauge'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Gauge Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Tunnel — Wrap 1 Air Pressure" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => { const c = CATEGORIES.find((x) => x.value === e.target.value); setForm({ ...form, category: e.target.value, unit: c?.unit || form.unit }); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Unit</label>
                  <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Target Min</label>
                  <input type="number" step="0.1" value={form.targetMin} onChange={(e) => setForm({ ...form, targetMin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Target Max</label>
                  <input type="number" step="0.1" value={form.targetMax} onChange={(e) => setForm({ ...form, targetMax: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg">{editing ? 'Save Changes' : 'Add Gauge'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log reading modal */}
      {readingFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setReadingFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Log Reading — {readingFor.name}</h3>
              <button onClick={() => setReadingFor(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={logReading} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Value ({readingFor.unit})</label>
                <input type="number" step="0.1" value={readingValue} onChange={(e) => setReadingValue(e.target.value)} required autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                {(readingFor.targetMin != null || readingFor.targetMax != null) && (
                  <p className="text-[11px] text-gray-400 mt-1">Target range: {readingFor.targetMin ?? '—'} – {readingFor.targetMax ?? '—'} {readingFor.unit}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg">Save Reading</button>
                <button type="button" onClick={() => setReadingFor(null)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setHistoryFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Reading History — {historyFor.name}</h3>
              <button onClick={() => setHistoryFor(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-2">
              {readings.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No readings yet</p>}
              {readings.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-gray-50 pb-2">
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{r.value} {historyFor.unit}</span>
                    {r.recordedBy && <span className="text-xs text-gray-400 ml-2">{r.recordedBy.firstName} {r.recordedBy.lastName?.[0]}.</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
