import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import FileUpload from '../common/FileUpload';
import {
  X, FileText, FileSignature, Plus, Pencil, Trash2, Upload, ExternalLink, Loader2, ListChecks,
} from 'lucide-react';

const CATEGORIES = ['onboarding', 'policy', 'tax', 'hr', 'other'];

function blank() {
  return { id: null, name: '', type: 'policy', category: 'onboarding', sourceFileUrl: '', content: '', fields: [], requireSignature: true, assignOnOnboarding: true };
}

export default function DocumentTemplatesModal({ onClose }) {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null); // null = list view; object = editor
  const [form, setForm] = useState(blank());
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/document-templates'); setTemplates(data); }
    catch { toast.error('Failed to load documents'); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(blank()); setEditing('new'); };
  const openEdit = (t) => { setForm({ ...t, fields: t.fields || [] }); setEditing(t.id); };

  const onPdfUploaded = async (urls) => {
    const url = urls[0];
    setForm((f) => ({ ...f, sourceFileUrl: url }));
    setExtracting(true);
    try {
      const { data } = await api.post('/document-templates/extract-fields', { sourceFileUrl: url });
      setForm((f) => ({ ...f, sourceFileUrl: url, fields: data.fields || [] }));
      toast.success(data.fields?.length ? `Detected ${data.fields.length} fillable field(s)` : 'PDF uploaded (no fillable fields detected)');
    } catch { toast.error('Uploaded, but could not read fields'); }
    finally { setExtracting(false); }
  };

  const addField = () => setForm((f) => ({ ...f, fields: [...f.fields, { key: `field_${f.fields.length + 1}`, label: '', type: 'text' }] }));
  const updateField = (i, patch) => setForm((f) => ({ ...f, fields: f.fields.map((x, idx) => idx === i ? { ...x, ...patch } : x) }));
  const removeField = (i) => setForm((f) => ({ ...f, fields: f.fields.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    if (form.type === 'fillable_form' && !form.sourceFileUrl) { toast.error('Upload a PDF for the fillable form'); return; }
    setSaving(true);
    try {
      const payload = { ...form, fields: form.fields };
      if (editing === 'new') await api.post('/document-templates', payload);
      else await api.patch(`/document-templates/${editing}`, payload);
      toast.success(editing === 'new' ? 'Document created' : 'Document saved (new version)');
      setEditing(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this document template?')) return;
    try { await api.delete(`/document-templates/${id}`); load(); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-team">TEAM</p>
            <h2 className="text-lg font-bold text-gray-900">Documents &amp; Forms</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {!editing ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">Upload fillable PDFs (tax forms, etc.) or write policies employees read &amp; sign.</p>
              <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shrink-0"><Plus className="w-4 h-4" /> New</button>
            </div>
            <div className="space-y-2.5">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'fillable_form' ? 'bg-blue-50' : 'bg-brand-50'}`}>
                    {t.type === 'fillable_form' ? <FileText className="w-5 h-5 text-blue-500" /> : <FileSignature className="w-5 h-5 text-brand-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 capitalize">{t.category}</span>
                      <span className="text-[10px] text-gray-400">v{t.version}</span>
                      {t.assignOnOnboarding && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">Onboarding</span>}
                      {!t.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">Inactive</span>}
                    </div>
                    <p className="text-xs text-gray-400">{t.type === 'fillable_form' ? `Fillable form · ${(t.fields || []).length} field(s)` : 'Policy document'}</p>
                  </div>
                  <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(t.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="text-center py-12">
                  <FileSignature className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-600">No documents yet</p>
                  <p className="text-xs text-gray-400 mt-1">Create a fillable form or a signable policy to get started.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Type toggle */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setForm({ ...form, type: 'policy' })} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${form.type === 'policy' ? 'bg-brand-500 text-white' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}><FileSignature className="w-3.5 h-3.5" /> Policy / Document</button>
              <button onClick={() => setForm({ ...form, type: 'fillable_form' })} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${form.type === 'fillable_form' ? 'bg-brand-500 text-white' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}><FileText className="w-3.5 h-3.5" /> Fillable Form (PDF)</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder={form.type === 'fillable_form' ? 'e.g. IRS Form W-4 (2026)' : 'e.g. Employee Handbook'} /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none capitalize">{CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}</select></div>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={form.requireSignature} onChange={(e) => setForm({ ...form, requireSignature: e.target.checked })} className="w-4 h-4 rounded text-brand-500" /> Require signature</label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={form.assignOnOnboarding} onChange={(e) => setForm({ ...form, assignOnOnboarding: e.target.checked })} className="w-4 h-4 rounded text-brand-500" /> Onboarding</label>
              </div>
            </div>

            {/* Fillable form: upload PDF */}
            {form.type === 'fillable_form' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">PDF Form</label>
                {form.sourceFileUrl ? (
                  <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2">
                    <a href={form.sourceFileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-brand-600"><FileText className="w-4 h-4" /> View uploaded PDF <ExternalLink className="w-3.5 h-3.5" /></a>
                    <button onClick={() => setForm({ ...form, sourceFileUrl: '', fields: [] })} className="text-xs text-gray-400 hover:text-red-500">Replace</button>
                  </div>
                ) : (
                  <FileUpload accept="application/pdf,.pdf" maxFiles={1} label="Upload PDF form" onUpload={onPdfUploaded} />
                )}
                {extracting && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Reading fillable fields…</p>}
              </div>
            )}

            {/* Policy content */}
            {form.type === 'policy' && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Document Content (editable — employees read this, then sign)</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none font-mono" placeholder={'# Section heading\n## Subheading\n- Bullet point\n1. Numbered step\n**bold text**\n\nWrite your policy here — revise anytime, saving creates a new version that everyone must re-sign.'} />
                <p className="text-[11px] text-gray-400 mt-1.5">Formatting: <code className="text-gray-500">#</code> heading · <code className="text-gray-500">##</code> subheading · <code className="text-gray-500">-</code> bullet · <code className="text-gray-500">1.</code> numbered · <code className="text-gray-500">**bold**</code>. Editing the content bumps the version and re-prompts every employee to sign.</p>
              </div>
            )}

            {/* Fields the employee fills */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" /> Fields the employee fills in</label>
                <button onClick={addField} className="text-xs text-brand-600 font-semibold hover:underline">+ Add field</button>
              </div>
              <div className="space-y-2">
                {form.fields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Field label" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                    <input value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} placeholder="key" className="w-32 px-2 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-500 focus:ring-2 focus:ring-brand-400 outline-none" />
                    <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value })} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"><option value="text">Text</option><option value="date">Date</option><option value="checkbox">Checkbox</option></select>
                    <button onClick={() => removeField(i)} className="p-1.5 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {form.fields.length === 0 && <p className="text-xs text-gray-400">No fields — the employee will just review and sign.</p>}
              </div>
            </div>
          </div>
        )}

        {editing && (
          <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100">
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Back</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {editing === 'new' ? 'Create Document' : 'Save New Version'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
