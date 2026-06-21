import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { FileText, Plus, X, Pencil, Trash2, Eye, BookOpen } from 'lucide-react';

const CATEGORIES = [
  { value: 'opening', label: 'Opening' },
  { value: 'midshift', label: 'Midshift' },
  { value: 'closing', label: 'Closing' },
  { value: 'safety', label: 'Safety' },
  { value: 'operations', label: 'Operations' },
];
const catBadge = {
  opening: 'bg-blue-100 text-blue-700', midshift: 'bg-amber-100 text-amber-700',
  closing: 'bg-purple-100 text-purple-700', safety: 'bg-red-100 text-red-700', operations: 'bg-gray-100 text-gray-600',
};

function blank() { return { title: '', category: 'operations', content: '', published: true }; }

export default function SOPsPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [sops, setSops] = useState([]);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(blank());
  const [error, setError] = useState('');

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchSops = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/sops`);
      setSops(data);
    } catch { toast.error('Failed to load SOPs'); }
  }, [currentLocation, toast]);

  useEffect(() => { fetchSops(); }, [fetchSops]);

  const openCreate = () => { setEditing(null); setForm(blank()); setError(''); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setForm({ title: s.title, category: s.category, content: s.content, published: s.published }); setError(''); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.patch(`/locations/${currentLocation.id}/sops/${editing.id}`, form);
      else await api.post(`/locations/${currentLocation.id}/sops`, form);
      setShowForm(false); fetchSops();
      toast.success(editing ? 'SOP updated' : 'SOP published');
    } catch (err) { setError(err.response?.data?.error || 'Failed to save SOP'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this SOP?')) return;
    try { await api.delete(`/locations/${currentLocation.id}/sops/${id}`); fetchSops(); toast.success('SOP deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  if (!currentLocation) return null;

  const filtered = sops.filter((s) => !filter || s.category === filter);
  const categoryCount = new Set(sops.map((s) => s.category)).size;
  const publishedCount = sops.filter((s) => s.published).length;
  const avgSteps = sops.length
    ? Math.round(sops.reduce((sum, s) => sum + (s.content ? s.content.split(/\n+/).filter((l) => l.trim()).length : 0), 0) / sops.length)
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">RESOURCES</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <FileText className="w-6 h-6 text-brand-500" /> SOPs &amp; Procedures
          </h1>
          <p className="text-sm text-gray-500 mt-1">Standard operating procedures by shift and equipment type</p>
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
              <BookOpen className="w-4 h-4" /> Import from Manual
            </button>
            <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-sm">
              <Plus className="w-4 h-4" /> Add SOP
            </button>
          </div>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total SOPs', value: sops.length, dot: 'bg-brand-400' },
          { label: 'Categories', value: categoryCount, dot: 'bg-blue-400' },
          { label: 'Published', value: publishedCount, dot: 'bg-green-400' },
          { label: 'Avg Steps', value: avgSteps, dot: 'bg-purple-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{s.label}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${!filter ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setFilter(c.value)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filter === c.value ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>{c.label}</button>
        ))}
      </div>

      {/* SOP list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((s) => (
          <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0"><BookOpen className="w-4.5 h-4.5 text-brand-500" /></div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{s.title}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${catBadge[s.category]}`}>{s.category}</span>
                    <span className="text-[10px] text-gray-400">v{s.version}</span>
                    {!s.published && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Draft</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => setViewing(s)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50"><Eye className="w-4 h-4" /></button>
                {isManager && <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50"><Pencil className="w-4 h-4" /></button>}
                {isManager && <button onClick={() => remove(s.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
            {s.content && <p className="text-xs text-gray-500 mt-3 line-clamp-3 whitespace-pre-wrap">{s.content}</p>}
            <p className="text-[11px] text-gray-300 mt-3">Updated {new Date(s.updatedAt).toLocaleDateString()}{s.createdBy ? ` · ${s.createdBy.firstName} ${s.createdBy.lastName}` : ''}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl py-14 text-center">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No SOPs published</p>
            <p className="text-xs text-gray-400 mt-1">Document opening, midshift, and closing procedures for your team.</p>
          </div>
        )}
      </div>

      {/* Create/edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit SOP' : 'New SOP'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Tunnel Opening Procedure" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Procedure</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="Step-by-step procedure…" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="w-4 h-4 rounded text-brand-500" />
                Published (visible to staff)
              </label>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg">{editing ? 'Save Changes' : 'Publish SOP'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">{viewing.title}</h3>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${catBadge[viewing.category]}`}>{viewing.category}</span>
              </div>
              <button onClick={() => setViewing(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{viewing.content || 'No content.'}</p>
              <p className="text-[11px] text-gray-300 mt-4">Version {viewing.version} · Updated {new Date(viewing.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
