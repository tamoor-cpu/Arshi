import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import SignDocumentModal from '../documents/SignDocumentModal';
import {
  X, UserCircle, FileText, GraduationCap, AlertTriangle, CalendarDays, Clock,
  CheckCircle2, ListChecks, Plus, Trash2, Pencil, Archive, ArchiveRestore, Save, ExternalLink,
  FileSignature, PenLine,
} from 'lucide-react';

const ROLES = ['EMPLOYEE', 'SITE_MANAGER', 'REGIONAL_ADMIN', 'SUPER_ADMIN'];
const WU_TYPES = [
  { value: 'verbal', label: 'Verbal Warning', color: 'bg-amber-100 text-amber-700' },
  { value: 'written', label: 'Written Warning', color: 'bg-orange-100 text-orange-700' },
  { value: 'final', label: 'Final Warning', color: 'bg-red-100 text-red-700' },
  { value: 'commendation', label: 'Commendation', color: 'bg-green-100 text-green-700' },
];
const trainStatus = {
  completed: 'bg-green-100 text-green-700', in_progress: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700', not_started: 'bg-gray-100 text-gray-500',
};

export default function EmployeeFileModal({ employeeId, isManager, onClose, onChanged }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [docForm, setDocForm] = useState({ category: 'onboarding', name: '', fileUrl: '', status: 'pending' });
  const [showDoc, setShowDoc] = useState(false);
  const [wuForm, setWuForm] = useState({ type: 'written', title: '', description: '' });
  const [showWu, setShowWu] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [signing, setSigning] = useState(null); // template being signed

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/users/${employeeId}/file`);
      setFile(data);
      setForm({ firstName: data.firstName, lastName: data.lastName, phone: data.phone || '', position: data.position || '', role: data.role, hourlyRate: data.hourlyRate ?? '', hireDate: data.hireDate ? data.hireDate.slice(0, 10) : '' });
    } catch { toast.error('Failed to load employee file'); }
  }, [employeeId, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/document-templates', { params: { activeOnly: 'true' } }).then(({ data }) => setTemplates(data)).catch(() => {}); }, []);

  const saveEdits = async () => {
    try { await api.patch(`/users/${employeeId}`, form); setEditing(false); load(); onChanged && onChanged(); toast.success('Employee updated'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to update'); }
  };
  const toggleArchive = async () => {
    const archiving = !file.archived;
    if (archiving && !window.confirm(`Archive ${file.firstName} ${file.lastName}? They will no longer appear in the active roster.`)) return;
    try { await api.post(`/users/${employeeId}/${archiving ? 'archive' : 'unarchive'}`); load(); onChanged && onChanged(); toast.success(archiving ? 'Employee archived' : 'Employee reactivated'); }
    catch { toast.error('Failed to update status'); }
  };
  const addDoc = async (e) => {
    e.preventDefault();
    try { await api.post(`/users/${employeeId}/documents`, docForm); setShowDoc(false); setDocForm({ category: 'onboarding', name: '', fileUrl: '', status: 'pending' }); load(); toast.success('Document added'); }
    catch { toast.error('Failed to add document'); }
  };
  const delDoc = async (id) => { try { await api.delete(`/users/${employeeId}/documents/${id}`); load(); } catch { toast.error('Failed'); } };
  const addWu = async (e) => {
    e.preventDefault();
    try { await api.post(`/users/${employeeId}/writeups`, wuForm); setShowWu(false); setWuForm({ type: 'written', title: '', description: '' }); load(); toast.success('Record added'); }
    catch { toast.error('Failed to add record'); }
  };
  const delWu = async (id) => { try { await api.delete(`/users/${employeeId}/writeups/${id}`); load(); } catch { toast.error('Failed'); } };

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';
  const fmtT = (d) => d ? new Date(d).toLocaleString() : '—';

  if (!file) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-8" onClick={(e) => e.stopPropagation()}><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      </div>
    );
  }

  const onboardingDone = file.onboardingTasks?.filter((t) => t.status === 'completed').length || 0;
  const tabs = [
    { key: 'overview', label: 'Overview', icon: UserCircle },
    { key: 'onboarding', label: `Onboarding (${onboardingDone}/${file.onboardingTasks?.length || 0})`, icon: ListChecks },
    { key: 'documents', label: `Documents (${file.employeeDocuments?.length || 0})`, icon: FileText },
    { key: 'training', label: 'Training', icon: GraduationCap },
    { key: 'writeups', label: `Write-ups (${file.writeUpsReceived?.length || 0})`, icon: AlertTriangle },
    { key: 'schedule', label: 'Schedule', icon: CalendarDays },
    { key: 'clock', label: 'Clock History', icon: Clock },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold shrink-0">
              {file.firstName?.[0]}{file.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 truncate">{file.firstName} {file.lastName}</h2>
                {file.archived && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Archived</span>}
                {!file.onboardingCompletedAt && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Onboarding</span>}
              </div>
              <p className="text-xs text-gray-400">{file.position || file.role?.replace('_', ' ')} · {file.email}</p>
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
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div>
              {!editing ? (
                <>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {[
                      ['Position', file.position || '—'],
                      ['Role', file.role?.replace('_', ' ')],
                      ['Email', file.email],
                      ['Phone', file.phone || '—'],
                      ['Hire Date', fmt(file.hireDate)],
                      ['Hourly Rate', file.hourlyRate != null ? `$${file.hourlyRate.toFixed(2)}` : '—'],
                      ['Onboarding', file.onboardingCompletedAt ? `Complete · ${fmt(file.onboardingCompletedAt)}` : 'In progress'],
                      ['Locations', (file.userLocations || []).map((l) => l.location.name).join(', ') || '—'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{k}</p>
                        <p className="text-sm text-gray-900 mt-0.5 capitalize">{v}</p>
                      </div>
                    ))}
                  </div>
                  {isManager && (
                    <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-100">
                      <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg"><Pencil className="w-4 h-4" /> Edit Info</button>
                      <button onClick={toggleArchive} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border ${file.archived ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>
                        {file.archived ? <><ArchiveRestore className="w-4 h-4" /> Reactivate</> : <><Archive className="w-4 h-4" /> Archive Employee</>}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Position</label><input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Wash Attendant" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">{ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Hourly Rate ($)</label><input type="number" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Hire Date</label><input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                  </div>
                  <div className="flex gap-2"><button onClick={saveEdits} className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg"><Save className="w-4 h-4" /> Save</button><button onClick={() => setEditing(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button></div>
                </div>
              )}
            </div>
          )}

          {/* ONBOARDING */}
          {tab === 'onboarding' && (
            <div className="space-y-2">
              {(file.onboardingTasks || []).map((t) => (
                <div key={t.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
                  <CheckCircle2 className={`w-5 h-5 shrink-0 ${t.status === 'completed' ? 'text-green-500' : 'text-gray-200'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-400 capitalize">{t.category}{t.completedAt ? ` · completed ${fmt(t.completedAt)}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{t.status === 'completed' ? 'Done' : 'Pending'}</span>
                </div>
              ))}
              {(file.onboardingTasks || []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No onboarding checklist for this employee.</p>}
            </div>
          )}

          {/* DOCUMENTS */}
          {tab === 'documents' && (() => {
            const signedVer = {};
            (file.signedDocuments || []).forEach((s) => { if (s.templateId) signedVer[s.templateId] = Math.max(signedVer[s.templateId] || 0, s.templateVersion); });
            const pending = templates.filter((t) => (signedVer[t.id] || 0) < t.version);
            return (
            <div>
              {/* Documents to sign */}
              {pending.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-2"><FileSignature className="w-4 h-4" /> Documents to sign ({pending.length})</p>
                  <div className="space-y-2">
                    {pending.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                        <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                        <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{t.name}</span>
                        <span className="text-[10px] text-gray-400 capitalize">{t.type === 'fillable_form' ? 'form' : 'policy'}</span>
                        {isManager && <button onClick={() => setSigning(t)} className="flex items-center gap-1 px-2.5 py-1 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg"><PenLine className="w-3.5 h-3.5" /> Sign</button>}
                      </div>
                    ))}
                  </div>
                  {isManager && <p className="text-[11px] text-amber-600 mt-2">Have {file.firstName} sign here in person, or they'll be prompted during onboarding / from their account.</p>}
                </div>
              )}
              {isManager && <div className="flex justify-end mb-3"><button onClick={() => setShowDoc(!showDoc)} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg"><Plus className="w-3.5 h-3.5" /> Add Document</button></div>}
              {showDoc && (
                <form onSubmit={addDoc} className="bg-gray-50 rounded-xl p-4 mb-3 grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Name</label><input value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Signed Handbook" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Category</label><select value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"><option value="onboarding">Onboarding</option><option value="policy">Policy</option><option value="certification">Certification</option><option value="other">Other</option></select></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Status</label><select value={docForm.status} onChange={(e) => setDocForm({ ...docForm, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"><option value="pending">Pending</option><option value="signed">Signed</option><option value="completed">Completed</option></select></div>
                  <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">File URL (optional)</label><input value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                  <div className="col-span-2 flex gap-2"><button type="submit" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg">Add</button><button type="button" onClick={() => setShowDoc(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button></div>
                </form>
              )}
              <div className="space-y-2">
                {(file.employeeDocuments || []).map((d) => (
                  <div key={d.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
                    <FileText className="w-5 h-5 text-brand-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{d.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{d.category}{d.signedAt ? ` · signed ${fmt(d.signedAt)}` : ''}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${d.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{d.status}</span>
                    {d.fileUrl && <a href={d.fileUrl} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-brand-600"><ExternalLink className="w-4 h-4" /></a>}
                    {isManager && <button onClick={() => delDoc(d.id)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
                {(file.employeeDocuments || []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No documents on file. Onboarding paperwork & signed policies will appear here.</p>}
              </div>
            </div>
            );
          })()}

          {/* TRAINING */}
          {tab === 'training' && (
            <div className="space-y-2">
              {(file.trainings || []).map((t) => (
                <div key={t.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
                  <GraduationCap className="w-5 h-5 text-brand-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                      {t.isRequired && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">Required</span>}
                    </div>
                    <p className="text-xs text-gray-400 capitalize">{t.category?.replace('_', ' ')}{t.score != null ? ` · quiz ${t.score}%` : ''}{t.completedAt ? ` · ${fmt(t.completedAt)}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${trainStatus[t.status] || trainStatus.not_started}`}>{t.status.replace('_', ' ')}</span>
                </div>
              ))}
              {(file.trainings || []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No training modules.</p>}
            </div>
          )}

          {/* WRITE-UPS */}
          {tab === 'writeups' && (
            <div>
              {isManager && <div className="flex justify-end mb-3"><button onClick={() => setShowWu(!showWu)} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg"><Plus className="w-3.5 h-3.5" /> Add Record</button></div>}
              {showWu && (
                <form onSubmit={addWu} className="bg-gray-50 rounded-xl p-4 mb-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Type</label><select value={wuForm.type} onChange={(e) => setWuForm({ ...wuForm, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">{WU_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Title</label><input value={wuForm.title} onChange={(e) => setWuForm({ ...wuForm, title: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                  </div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Description</label><textarea value={wuForm.description} onChange={(e) => setWuForm({ ...wuForm, description: e.target.value })} required rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                  <div className="flex gap-2"><button type="submit" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg">Add Record</button><button type="button" onClick={() => setShowWu(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button></div>
                </form>
              )}
              <div className="space-y-2">
                {(file.writeUpsReceived || []).map((w) => {
                  const t = WU_TYPES.find((x) => x.value === w.type) || WU_TYPES[1];
                  return (
                    <div key={w.id} className="border border-gray-100 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${t.color}`}>{t.label}</span>
                        <span className="text-sm font-semibold text-gray-900">{w.title}</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmt(w.createdAt)}</span>
                        {isManager && <button onClick={() => delWu(w.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{w.description}</p>
                      {w.issuedBy && <p className="text-xs text-gray-400 mt-1">Issued by {w.issuedBy.firstName} {w.issuedBy.lastName}</p>}
                    </div>
                  );
                })}
                {(file.writeUpsReceived || []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No write-ups or commendations on record.</p>}
              </div>
            </div>
          )}

          {/* SCHEDULE */}
          {tab === 'schedule' && (
            <div className="space-y-2">
              {(file.shiftAssignments || []).map((a) => (
                <div key={a.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
                  <CalendarDays className="w-5 h-5 text-team shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{a.shift?.name || 'Shift'}</p>
                    <p className="text-xs text-gray-400">{a.shift?.startTime}–{a.shift?.endTime}</p>
                  </div>
                  <span className="text-xs text-gray-500">{fmt(a.date)}</span>
                </div>
              ))}
              {(file.shiftAssignments || []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No upcoming or recent shifts.</p>}
            </div>
          )}

          {/* CLOCK HISTORY */}
          {tab === 'clock' && (
            <div className="space-y-1.5">
              {(file.clockEvents || []).map((c) => (
                <div key={c.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-2.5">
                  <span className={`w-2 h-2 rounded-full ${c.eventType === 'clock_in' ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium text-gray-700 capitalize">{c.eventType?.replace('_', ' ')}</span>
                  {c.isWithinGeofence === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">off-site</span>}
                  <span className="text-xs text-gray-400 ml-auto">{fmtT(c.timestamp)}</span>
                </div>
              ))}
              {(file.clockEvents || []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No clock-in/out history yet.</p>}
            </div>
          )}
        </div>
      </div>

      {/* In-person signing for this employee */}
      {signing && (
        <SignDocumentModal
          template={signing}
          userId={employeeId}
          onClose={() => setSigning(null)}
          onSigned={() => { setSigning(null); load(); onChanged && onChanged(); }}
        />
      )}
    </div>
  );
}
