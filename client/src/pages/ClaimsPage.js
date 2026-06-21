import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import FileUpload, { MediaThumbnails } from '../components/common/FileUpload';
import MediaGallery from '../components/common/MediaGallery';
import {
  MessageSquareWarning, Plus, X, Camera, Calendar,
  User, AlertTriangle, CheckCircle2, Search, XCircle, Clock,
} from 'lucide-react';

const COMPLAINT_TYPES = [
  { key: 'unsatisfied', label: 'Unsatisfied' },
  { key: 'damage', label: 'Damage' },
  { key: 'service', label: 'Service' },
  { key: 'billing', label: 'Billing' },
  { key: 'refund', label: 'Refund' },
  { key: 'safety', label: 'Safety' },
  { key: 'other', label: 'Other' },
];
const typeBadge = {
  unsatisfied: 'bg-amber-100 text-amber-700', damage: 'bg-red-100 text-red-700',
  service: 'bg-blue-100 text-blue-700', billing: 'bg-purple-100 text-purple-700',
  refund: 'bg-green-100 text-green-700', safety: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
};
const severityBadge = {
  low: 'bg-gray-100 text-gray-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700',
};
const ZONES = ['tunnel', 'vacuum', 'payment', 'exterior', 'other'];
const statusConfig = {
  reported: { label: 'Reported', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  investigating: { label: 'Investigating', color: 'bg-blue-100 text-blue-700', icon: Search },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  denied: { label: 'Denied', color: 'bg-red-100 text-red-700', icon: XCircle },
  resolved: { label: 'Resolved', color: 'bg-gray-100 text-gray-600', icon: CheckCircle2 },
};
const statusFlow = ['reported', 'investigating', 'approved', 'denied', 'resolved'];

function blankForm() {
  return {
    complaintType: 'unsatisfied', severity: 'medium', zone: '', locationBay: '',
    description: '', incidentAt: '', assignedToId: '', customerName: '', customerPhone: '',
    estimatedCost: '', photoUrls: [],
  };
}

export default function ClaimsPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [claims, setClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [resolveForm, setResolveForm] = useState({ status: '', resolution: '' });
  const [error, setError] = useState('');

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchClaims = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.complaintType = filterType;
      const { data } = await api.get(`/locations/${currentLocation.id}/claims`, { params });
      setClaims(data);
    } catch { toast.error('Failed to load complaints'); }
  }, [currentLocation, filterStatus, filterType, toast]);

  const fetchUsers = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get('/users', { params: { locationId: currentLocation.id } });
      setUsers(data);
    } catch { /* non-critical */ }
  }, [currentLocation]);

  useEffect(() => { fetchClaims(); fetchUsers(); }, [fetchClaims, fetchUsers]);

  const fileComplaint = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/locations/${currentLocation.id}/claims`, {
        ...form,
        assignedToId: form.assignedToId || null,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null,
      });
      setShowAdd(false);
      setForm(blankForm());
      fetchClaims();
      toast.success('Complaint logged');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log complaint');
    }
  };

  const updateClaim = async (id, patch) => {
    try {
      await api.patch(`/locations/${currentLocation.id}/claims/${id}`, patch);
      setSelected(null); setResolveForm({ status: '', resolution: '' });
      fetchClaims();
      toast.success('Complaint updated');
    } catch { toast.error('Failed to update complaint'); }
  };

  if (!currentLocation) return null;

  const counts = {
    open: claims.filter((c) => !['resolved', 'denied'].includes(c.status)).length,
    high: claims.filter((c) => c.severity === 'high').length,
    unassigned: claims.filter((c) => !c.assignedToId && c.status !== 'resolved').length,
    resolved: claims.filter((c) => c.status === 'resolved').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <MessageSquareWarning className="w-6 h-6 text-brand-500" /> Complaints
          </h1>
          <p className="text-sm text-gray-500 mt-1">Log and resolve guest issues at {currentLocation.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setForm(blankForm()); setError(''); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-sm">
            <Plus className="w-4 h-4" /> New Complaint
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Open', value: counts.open, dot: 'bg-amber-400' },
          { label: 'High Severity', value: counts.high, dot: 'bg-red-400' },
          { label: 'Unassigned', value: counts.unassigned, dot: 'bg-blue-400' },
          { label: 'Resolved', value: counts.resolved, dot: 'bg-green-400' },
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

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button onClick={() => setFilterType('')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${!filterType ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>All types</button>
        {COMPLAINT_TYPES.map((t) => (
          <button key={t.key} onClick={() => setFilterType(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filterType === t.key ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>{t.label}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600">
            <option value="">All statuses</option>
            {statusFlow.map((s) => <option key={s} value={s}>{statusConfig[s].label}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {claims.map((c) => {
          const sc = statusConfig[c.status] || statusConfig.reported;
          const StatusIcon = sc.icon;
          const photos = typeof c.photoUrls === 'string' ? JSON.parse(c.photoUrls || '[]') : (c.photoUrls || []);
          return (
            <div key={c.id} onClick={() => { setSelected(c); setResolveForm({ status: '', resolution: '' }); }}
              className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:border-brand-200 cursor-pointer transition-colors">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeBadge[c.complaintType] || typeBadge.other}`}>
                  <MessageSquareWarning className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${typeBadge[c.complaintType] || typeBadge.other}`}>
                      {COMPLAINT_TYPES.find((t) => t.key === c.complaintType)?.label || 'Other'}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${severityBadge[c.severity] || severityBadge.medium}`}>{c.severity}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sc.color}`}><StatusIcon className="w-3 h-3 inline mr-0.5" />{sc.label}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 line-clamp-1">{c.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    {c.zone && <span className="capitalize">{c.zone}{c.locationBay ? ` · ${c.locationBay}` : ''}</span>}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.incidentAt || c.createdAt).toLocaleDateString()}</span>
                    {c.assignedTo
                      ? <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.assignedTo.firstName} {c.assignedTo.lastName?.[0]}.</span>
                      : <span className="text-amber-500">Unassigned</span>}
                    {photos.length > 0 && <span className="flex items-center gap-1"><Camera className="w-3 h-3" />{photos.length}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {claims.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl py-14 text-center">
            <MessageSquareWarning className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No complaints logged</p>
            <p className="text-xs text-gray-400 mt-1">Guest issues you log will appear here.</p>
          </div>
        )}
      </div>

      {/* New Complaint modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
                <h3 className="text-lg font-bold text-gray-900">New Complaint</h3>
                <p className="text-xs text-gray-400">Log the issue quickly without taking over the whole screen.</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={fileComplaint} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {error && <div className="lg:col-span-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              {/* Complaint type */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-900">Complaint Type</p>
                <p className="text-xs text-gray-400 mb-3">Pick the category that best matches the guest issue.</p>
                <div className="grid grid-cols-2 gap-2">
                  {COMPLAINT_TYPES.map((t) => (
                    <button key={t.key} type="button" onClick={() => setForm({ ...form, complaintType: t.key })}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        form.complaintType === t.key ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}>{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Photos */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-900">Photos</p>
                <p className="text-xs text-gray-400 mb-3">Add a few images if they help document the issue.</p>
                <FileUpload accept="image/*,video/*" maxFiles={10} label="Add Photos"
                  onUpload={(urls) => setForm({ ...form, photoUrls: [...form.photoUrls, ...urls] })} />
                <MediaThumbnails urls={form.photoUrls} onRemove={(i) => setForm({ ...form, photoUrls: form.photoUrls.filter((_, idx) => idx !== i) })} />
              </div>

              {/* Incident details */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Incident Details</p>
                  <p className="text-xs text-gray-400">Where and when the complaint happened.</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">DESCRIPTION</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="Describe what happened…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">DATE &amp; TIME</label>
                    <input type="datetime-local" value={form.incidentAt} onChange={(e) => setForm({ ...form, incidentAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">SEVERITY</label>
                    <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none capitalize">
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">ZONE</label>
                    <select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none capitalize">
                      <option value="">No zone</option>
                      {ZONES.map((z) => <option key={z} value={z} className="capitalize">{z}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">LOCATION / BAY</label>
                    <input value={form.locationBay} onChange={(e) => setForm({ ...form, locationBay: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Bay 2" />
                  </div>
                </div>
              </div>

              {/* Assignment + customer */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Assignment</p>
                  <p className="text-xs text-gray-400">Optional owner for follow-up and resolution.</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">ASSIGN TO</label>
                  <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </div>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-gray-900">Customer</p>
                  <p className="text-xs text-gray-400 mb-2">Optional guest details for follow-up.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="Customer name" />
                    <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="Phone" />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-sm">Log Complaint</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Complaint Details</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${typeBadge[selected.complaintType]}`}>
                  {COMPLAINT_TYPES.find((t) => t.key === selected.complaintType)?.label}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${severityBadge[selected.severity]}`}>{selected.severity}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusConfig[selected.status]?.color}`}>{statusConfig[selected.status]?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{selected.description}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {selected.zone && <span className="capitalize">Zone: {selected.zone}{selected.locationBay ? ` · ${selected.locationBay}` : ''}</span>}
                <span><Calendar className="w-3.5 h-3.5 inline mr-1" />{new Date(selected.incidentAt || selected.createdAt).toLocaleString()}</span>
                {selected.customerName && <span>Guest: {selected.customerName}</span>}
                <span>By {selected.reportedBy?.firstName} {selected.reportedBy?.lastName}</span>
              </div>
              {(() => {
                const photos = typeof selected.photoUrls === 'string' ? JSON.parse(selected.photoUrls || '[]') : (selected.photoUrls || []);
                return photos.length > 0 ? <MediaGallery urls={photos} /> : null;
              })()}
              {selected.resolution && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700">Resolution</p>
                  <p className="text-sm text-gray-600">{selected.resolution}</p>
                </div>
              )}
            </div>

            {isManager && selected.status !== 'resolved' && (
              <div className="border-t border-gray-100 mt-4 pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Update</h4>
                <div className="grid grid-cols-2 gap-2">
                  <select value={resolveForm.status} onChange={(e) => setResolveForm({ ...resolveForm, status: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    <option value="">Change status…</option>
                    {statusFlow.map((s) => <option key={s} value={s}>{statusConfig[s].label}</option>)}
                  </select>
                  <select value={selected.assignedToId || ''} onChange={(e) => updateClaim(selected.id, { assignedToId: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    <option value="">Assign to…</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </div>
                <textarea placeholder="Resolution notes…" value={resolveForm.resolution} onChange={(e) => setResolveForm({ ...resolveForm, resolution: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" rows={2} />
                <button onClick={() => updateClaim(selected.id, { status: resolveForm.status || undefined, resolution: resolveForm.resolution || undefined })}
                  disabled={!resolveForm.status && !resolveForm.resolution}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Update Complaint
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
