import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  FileText, Plus, X, Search, AlertTriangle, ShieldCheck,
  ExternalLink, Trash2, Archive,
} from 'lucide-react';

const SIGNAL_WORDS = ['', 'Danger', 'Warning'];
const PPE_OPTIONS = ['Safety glasses', 'Gloves', 'Face shield', 'Respirator', 'Apron', 'Boots'];

// Rule-based safety guidance (no external LLM) — keyed on common questions.
function safetyAnswer(q) {
  const t = q.toLowerCase();
  if (t.includes('ppe') || t.includes('protective'))
    return 'For most wash chemicals, wear chemical-splash safety goggles and nitrile gloves. Hi-pH presoaks and acidic wheel cleaners also call for a face shield and apron. Always check the specific SDS section 8 (Exposure Controls / PPE) for the product.';
  if (t.includes('mix') || t.includes('combine'))
    return 'Never mix acidic and alkaline (high-pH) products — it can release heat or hazardous gas. Keep acids and bases in separate, labeled containers and rinse equipment between products.';
  if (t.includes('spill'))
    return 'Contain the spill, ventilate the area, and don PPE before cleanup. Absorb with inert material, avoid washing concentrated product to drains, and refer to SDS section 6 (Accidental Release). Report large spills to your manager.';
  if (t.includes('eye') || t.includes('skin') || t.includes('exposure'))
    return 'Flush the affected area with water for at least 15 minutes and remove contaminated clothing. For eye contact or ingestion, call Poison Control at 1-800-222-1222. Call 911 for any serious reaction.';
  return 'Refer to the product\'s official SDS for handling, storage, and first-aid guidance. In an emergency, call Poison Control at 1-800-222-1222 or 911. I can give general guidance but always defer to the manufacturer SDS.';
}

function blank() {
  return { chemicalName: '', manufacturer: '', fileUrl: '', hazardClass: '', signalWord: '', ppe: [] };
}

export default function SDSLibraryPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [missing, setMissing] = useState([]);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank());
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchData = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const [{ data: e }, { data: m }] = await Promise.all([
        api.get(`/locations/${currentLocation.id}/sds`, { params: { includeArchived } }),
        api.get(`/locations/${currentLocation.id}/sds/missing`),
      ]);
      setEntries(e); setMissing(m);
    } catch { toast.error('Failed to load SDS library'); }
  }, [currentLocation, includeArchived, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/locations/${currentLocation.id}/sds`, form);
      setShowForm(false); setForm(blank()); fetchData();
      toast.success('SDS entry added');
    } catch (err) { setError(err.response?.data?.error || 'Failed to add SDS entry'); }
  };

  const prefillFrom = (m) => { setForm({ ...blank(), chemicalName: m.name, manufacturer: m.supplier || '' }); setError(''); setShowForm(true); };
  const archive = async (id) => {
    try { await api.patch(`/locations/${currentLocation.id}/sds/${id}`, { archived: true }); fetchData(); toast.success('Archived'); }
    catch { toast.error('Failed to archive'); }
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this SDS entry?')) return;
    try { await api.delete(`/locations/${currentLocation.id}/sds/${id}`); fetchData(); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  const ask = () => { if (question.trim()) setAnswer(safetyAnswer(question)); };
  const togglePpe = (p) => setForm((f) => ({ ...f, ppe: f.ppe.includes(p) ? f.ppe.filter((x) => x !== p) : [...f.ppe, p] }));

  if (!currentLocation) return null;

  const filtered = entries.filter((e) => !search || e.chemicalName.toLowerCase().includes(search.toLowerCase()) || (e.manufacturer || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-chem">RESOURCES</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <FileText className="w-6 h-6 text-chem" /> SDS Library
          </h1>
          <p className="text-sm text-gray-500 mt-1">Safety data sheets for every chemical</p>
        </div>
        {isManager && (
          <button onClick={() => { setForm(blank()); setError(''); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-chem hover:opacity-90 text-white text-sm font-semibold rounded-lg shadow-sm">
            <Plus className="w-4 h-4" /> Add SDS Entry
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by chemical name…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="rounded text-chem" /> Include archived
        </label>
      </div>

      {/* Missing SDS banner */}
      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Action Required: Missing SDS Documents</p>
          </div>
          <p className="text-xs text-amber-700 mb-3">The following chemicals from your inventory need Safety Data Sheets.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {missing.map((m) => (
              <button key={m.id} onClick={() => prefillFrom(m)}
                className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2 text-left hover:border-amber-300">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                  {m.supplier && <p className="text-xs text-gray-400 truncate">{m.supplier}</p>}
                </div>
                <Plus className="w-4 h-4 text-chem shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Safety Reference */}
      <div className="rounded-2xl p-5 mb-4 bg-gradient-to-br from-emerald-900 to-teal-900 text-white">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-emerald-300" /></div>
          <div>
            <p className="text-sm font-bold">Quick Safety Reference</p>
            <p className="text-xs text-white/60">General chemical handling guidance — always defer to the product SDS</p>
          </div>
        </div>
        {answer && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3 text-sm text-white/90 leading-relaxed">{answer}</div>
        )}
        <div className="flex items-center gap-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="Look up a topic (e.g. 'PPE', 'spill', 'eye exposure')"
            className="flex-1 px-3 py-2.5 bg-white/10 border border-white/15 rounded-lg text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-emerald-400/50 outline-none" />
          <button onClick={ask} className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg">
            <Search className="w-4 h-4" /> Look Up
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-2.5">
        {filtered.map((e) => (
          <div key={e.id} className={`bg-white border border-gray-100 rounded-2xl px-4 py-3.5 ${e.archived ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-chem/10 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-chem" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900">{e.chemicalName}</h3>
                  {e.signalWord && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${e.signalWord === 'Danger' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{e.signalWord}</span>
                  )}
                  {e.archived && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Archived</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {e.manufacturer || 'Unknown manufacturer'}{e.hazardClass ? ` · ${e.hazardClass}` : ''}
                </p>
                {Array.isArray(e.ppe) && e.ppe.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {e.ppe.map((p) => <span key={p} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p}</span>)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {e.fileUrl && (
                  <a href={e.fileUrl} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-chem rounded-lg hover:bg-gray-50"><ExternalLink className="w-4 h-4" /></a>
                )}
                {isManager && !e.archived && (
                  <button onClick={() => archive(e.id)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50"><Archive className="w-4 h-4" /></button>
                )}
                {isManager && (
                  <button onClick={() => remove(e.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No SDS entries found</p>
            <p className="text-xs text-gray-400 mt-1">Add your first SDS document above.</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-chem">RESOURCES</p>
                <h3 className="text-lg font-bold text-gray-900">Add SDS Entry</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Chemical Name</label>
                  <input value={form.chemicalName} onChange={(e) => setForm({ ...form, chemicalName: e.target.value })} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Manufacturer</label>
                  <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Signal Word</label>
                  <select value={form.signalWord} onChange={(e) => setForm({ ...form, signalWord: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none">
                    {SIGNAL_WORDS.map((s) => <option key={s} value={s}>{s || 'None'}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hazard Class</label>
                  <input value={form.hazardClass} onChange={(e) => setForm({ ...form, hazardClass: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" placeholder="e.g. Corrosive, Skin Irritant" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">SDS Document URL</label>
                  <input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-chem/40 outline-none" placeholder="Link to the SDS PDF" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Required PPE</label>
                  <div className="flex flex-wrap gap-2">
                    {PPE_OPTIONS.map((p) => (
                      <button key={p} type="button" onClick={() => togglePpe(p)}
                        className={`px-2.5 py-1 text-xs rounded-md border ${form.ppe.includes(p) ? 'border-chem bg-chem/10 text-chem' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>{p}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="px-4 py-2 bg-chem hover:opacity-90 text-white text-sm font-semibold rounded-lg">Add SDS Entry</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
