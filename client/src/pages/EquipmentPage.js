import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import ExportButton from '../components/ExportButton';
import FileUpload, { MediaThumbnails } from '../components/common/FileUpload';
import MediaGallery from '../components/common/MediaGallery';
import PrintButton from '../components/common/PrintButton';
import EquipmentDetailModal from '../components/equipment/EquipmentDetailModal';
import {
  Wrench, Plus, X, AlertTriangle, CheckCircle2, XCircle,
  Clock, ChevronDown, ChevronUp, ChevronRight, Settings2, Calendar, Hammer, ClipboardCheck,
  FileVideo, Image as ImageIcon, Sparkles, Loader2,
} from 'lucide-react';

const MIME_BY_EXT = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const mimeFromUrl = (u) => MIME_BY_EXT[(u.split('.').pop() || '').toLowerCase()] || '';
const ConfChip = ({ level }) => {
  if (!level) return null;
  const cls = level === 'high' ? 'bg-green-100 text-green-700' : level === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700';
  return <span className={`ml-1.5 align-middle text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${cls}`}>{level === 'high' ? 'AI ✓' : `AI · ${level}`}</span>;
};

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'dryer', label: 'Dryer' },
  { value: 'pump', label: 'Pump' },
  { value: 'vacuum', label: 'Vacuum' },
  { value: 'chemical_system', label: 'Chemical System' },
  { value: 'conveyor', label: 'Conveyor' },
  { value: 'other', label: 'Other' },
];

// Physical areas equipment lives in (used to group the Equipment tab)
const AREAS = [
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'backroom', label: 'Backroom' },
  { value: 'electrical_room', label: 'Electrical Room' },
  { value: 'vacuum_area', label: 'Vacuum Area' },
  { value: 'other', label: 'Other' },
];
const areaLabel = (a) => AREAS.find((x) => x.value === a)?.label || 'Other';

const statusConfig = {
  operational: { label: 'Operational', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  needs_maintenance: { label: 'Needs Maintenance', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  out_of_service: { label: 'Out of Service', color: 'bg-red-100 text-red-700', icon: XCircle },
  retired: { label: 'Retired', color: 'bg-gray-100 text-gray-600', icon: XCircle },
};

const maintStatusConfig = {
  scheduled: { label: 'Scheduled', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
};

export default function EquipmentPage() {
  const { currentLocation, user } = useAuth();
  const [activeTab, setActiveTab] = useState('equipment');
  const [equipment, setEquipment] = useState([]);
  const [filterCat, setFilterCat] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [showMaintForm, setShowMaintForm] = useState(null);
  const [form, setForm] = useState({ name: '', category: 'tunnel', area: 'tunnel', serialNumber: '', manufacturer: '', model: '', purchaseDate: '', purchaseCost: '', notes: '' });
  const [aiConfigured, setAiConfigured] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState(null); // { confidence, maintenanceTasks, parts } from the last AI extract
  const [reviewed, setReviewed] = useState(false);
  const [detailId, setDetailId] = useState(null); // open equipment file
  const [collapsedAreas, setCollapsedAreas] = useState(new Set());
  const [maintForm, setMaintForm] = useState({ type: 'preventive', description: '', cost: '', notes: '', mediaUrls: [] });
  const [error, setError] = useState('');

  // Maintenance/Repairs tab state
  const [locationLogs, setLocationLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({ equipmentId: '', type: 'preventive', description: '', cost: '', notes: '', mediaUrls: [] });
  const [selectedLog, setSelectedLog] = useState(null);

  const toast = useToast();
  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchEquipment = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const params = {};
      if (filterCat) params.category = filterCat;
      const { data } = await api.get(`/locations/${currentLocation.id}/equipment`, { params });
      // Fetch health scores and merge
      try {
        const { data: health } = await api.get(`/locations/${currentLocation.id}/ai/maintenance-predictions`);
        const healthMap = {};
        for (const h of health) healthMap[h.equipmentId] = h.healthScore;
        data.forEach((eq) => { eq._healthScore = healthMap[eq.id] ?? null; });
      } catch { /* health scores optional */ }
      setEquipment(data);
    } catch (err) {
      toast.error('Failed to load equipment');
    }
  }, [currentLocation, filterCat, toast]);

  const fetchLocationLogs = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const endpoint = activeTab === 'maintenance'
        ? `/locations/${currentLocation.id}/maintenance`
        : `/locations/${currentLocation.id}/repairs`;
      const params = {};
      if (logFilter) params.status = logFilter;
      const { data } = await api.get(endpoint, { params });
      setLocationLogs(data);
    } catch (err) {
      toast.error('Failed to load logs');
    }
  }, [currentLocation, activeTab, logFilter, toast]);

  useEffect(() => { fetchEquipment(); }, [fetchEquipment]);
  useEffect(() => {
    if (activeTab === 'maintenance' || activeTab === 'repairs') {
      fetchLocationLogs();
    }
  }, [activeTab, fetchLocationLogs]);

  const fetchLogs = async (equipId) => {
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/equipment/${equipId}/maintenance`);
      setMaintenanceLogs(data);
    } catch (err) {
      toast.error('Failed to load maintenance logs');
    }
  };

  const toggleExpand = (id) => {
    if (expandedId === id) { setExpandedId(null); }
    else { setExpandedId(id); fetchLogs(id); }
  };

  // Is the AI extraction feature available (ANTHROPIC_API_KEY set server-side)?
  useEffect(() => {
    api.get('/ai/status').then((r) => setAiConfigured(!!r.data.configured)).catch(() => setAiConfigured(false));
  }, []);

  const resetForm = () => {
    setForm({ name: '', category: 'tunnel', area: 'tunnel', serialNumber: '', manufacturer: '', model: '', purchaseDate: '', purchaseCost: '', notes: '' });
    setDraft(null); setReviewed(false);
  };

  // Upload → Claude reads the manual/photo → pre-fill the form for review.
  const handleExtract = async (urls) => {
    const url = urls && urls[0];
    if (!url) return;
    const mimeType = mimeFromUrl(url);
    if (!mimeType) { toast.error('Upload a PDF or an image (PNG/JPG).'); return; }
    setExtracting(true); setError('');
    try {
      const { data } = await api.post('/ai/extract', { fileUrl: url, mimeType, recordType: 'equipment' });
      const d = data.draft || {};
      const validCat = ['tunnel', 'dryer', 'pump', 'vacuum', 'chemical_system', 'conveyor', 'other'];
      setForm((f) => ({
        ...f,
        name: d.name || f.name,
        category: validCat.includes(d.category) ? d.category : f.category,
        manufacturer: d.manufacturer || f.manufacturer,
        model: d.model || f.model,
        serialNumber: d.serialNumber || f.serialNumber,
        notes: d.specifications ? (f.notes ? `${f.notes}\n${d.specifications}` : d.specifications) : f.notes,
        extractionSourceUrl: url,
        extractionModel: data.model,
        extractionJson: JSON.stringify(d),
      }));
      setDraft({ confidence: d.confidence || {}, maintenanceTasks: d.maintenanceTasks || [], parts: d.parts || [] });
      setReviewed(false);
      toast.success('AI filled the form — review the highlighted fields before saving.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Extraction failed. Enter the details manually.');
    } finally {
      setExtracting(false);
    }
  };

  // Risky AI-extracted data (part numbers / maintenance intervals) must be verified before save.
  const needsVerify = !!draft && ((draft.parts || []).some((p) => p.partNumber) || (draft.maintenanceTasks || []).some((m) => m.intervalDays != null));

  const addEquipment = async (e) => {
    e.preventDefault();
    setError('');
    if (needsVerify && !reviewed) { setError('Please confirm you reviewed the AI-extracted part numbers and maintenance intervals.'); return; }
    try {
      await api.post(`/locations/${currentLocation.id}/equipment`, form);
      setShowAdd(false);
      resetForm();
      fetchEquipment();
      toast.success('Equipment added successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add equipment');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/locations/${currentLocation.id}/equipment/${id}`, { status });
      fetchEquipment();
      toast.success('Equipment status updated');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const logMaintenance = async (e, equipId) => {
    e.preventDefault();
    try {
      await api.post(`/locations/${currentLocation.id}/equipment/${equipId}/maintenance`, {
        ...maintForm,
        cost: maintForm.cost ? parseFloat(maintForm.cost) : null,
      });
      setShowMaintForm(null);
      setMaintForm({ type: 'preventive', description: '', cost: '', notes: '', mediaUrls: [] });
      fetchLogs(equipId);
      fetchEquipment();
      toast.success('Maintenance logged');
    } catch (err) {
      toast.error('Failed to log maintenance');
    }
  };

  const submitLocationLog = async (e) => {
    e.preventDefault();
    if (!logForm.equipmentId) { toast.error('Select an equipment'); return; }
    try {
      const type = activeTab === 'repairs' ? (logForm.type === 'emergency' ? 'emergency' : 'repair') : (logForm.type === 'inspection' ? 'inspection' : 'preventive');
      await api.post(`/locations/${currentLocation.id}/equipment/${logForm.equipmentId}/maintenance`, {
        type,
        description: logForm.description,
        cost: logForm.cost ? parseFloat(logForm.cost) : null,
        notes: logForm.notes || null,
        mediaUrls: logForm.mediaUrls,
      });
      setShowLogForm(false);
      setLogForm({ equipmentId: '', type: 'preventive', description: '', cost: '', notes: '', mediaUrls: [] });
      fetchLocationLogs();
      toast.success(activeTab === 'repairs' ? 'Repair logged' : 'Maintenance scheduled');
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  const completeMaint = async (logId, equipId) => {
    try {
      await api.patch(`/locations/${currentLocation.id}/maintenance/${logId}`, { status: 'completed' });
      if (equipId) { fetchLogs(equipId); }
      fetchEquipment();
      fetchLocationLogs();
      toast.success('Completed');
    } catch (err) {
      toast.error('Failed to complete');
    }
  };

  if (!currentLocation) return null;

  const tabs = [
    { key: 'equipment', label: 'Equipment', icon: Settings2 },
    { key: 'maintenance', label: 'Maintenance', icon: ClipboardCheck },
    { key: 'repairs', label: 'Repairs', icon: Hammer },
  ];

  const parseMedia = (urls) => {
    try { return typeof urls === 'string' ? JSON.parse(urls || '[]') : (urls || []); }
    catch { return []; }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <Wrench className="w-6 h-6 text-brand-500" /> Equipment
          </h1>
          <p className="text-sm text-gray-500 mt-1">Assets, maintenance, and repairs at {currentLocation.name}</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <ExportButton endpoint={`/locations/${currentLocation.id}/export/equipment`} filename="equipment.csv" label="Export" />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Equipment', value: equipment.length, dot: 'bg-brand-400' },
          { label: 'Operational', value: equipment.filter((e) => e.status === 'operational').length, dot: 'bg-green-400' },
          { label: 'Offline', value: equipment.filter((e) => e.status === 'out_of_service').length, dot: 'bg-red-400', hint: 'Out of service' },
          { label: 'Down Now', value: equipment.filter((e) => !['operational', 'retired'].includes(e.status)).length, dot: 'bg-purple-400', hint: 'Not currently operational' },
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setLogFilter(''); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === key ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ==================== EQUIPMENT TAB ==================== */}
      {activeTab === 'equipment' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {categories.map((c) => (
                <button key={c.value} onClick={() => setFilterCat(c.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${filterCat === c.value ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {c.label}
                </button>
              ))}
            </div>
            {isManager && (
              <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
                <Plus className="w-4 h-4" /> Add Equipment
              </button>
            )}
          </div>

          {showAdd && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Add Equipment</h3>
                <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              {aiConfigured && (
                <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-brand-600" />
                    <p className="text-sm font-bold text-gray-900">Auto-fill from a manual</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Upload the equipment's PDF manual or spec sheet, or a photo of the nameplate — AI reads it and pre-fills the form. You review before saving.</p>
                  {extracting ? (
                    <div className="flex items-center gap-2 text-sm text-brand-700"><Loader2 className="w-4 h-4 animate-spin" /> Reading the document…</div>
                  ) : (
                    <FileUpload accept="image/*,.pdf" maxFiles={1} label="Upload manual / spec sheet / nameplate photo" onUpload={handleExtract} />
                  )}
                  {draft && !extracting && <p className="text-[11px] text-amber-700 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Pre-filled below — verify part numbers &amp; maintenance intervals (they're the least reliable).</p>}
                </div>
              )}
              <form onSubmit={addEquipment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *<ConfChip level={draft?.confidence?.name} /></label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Area *</label>
                  <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Category *<ConfChip level={draft?.confidence?.category} /></label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    {categories.filter((c) => c.value).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Purchase Cost ($)</label>
                  <input type="number" step="0.01" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Serial Number<ConfChip level={draft?.confidence?.serialNumber} /></label>
                  <input type="text" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer<ConfChip level={draft?.confidence?.manufacturer} /></label>
                  <input type="text" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Model<ConfChip level={draft?.confidence?.model} /></label>
                  <input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Notes / Specs</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={form.notes && form.notes.includes('\n') ? 3 : 1} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>

                {draft && ((draft.maintenanceTasks || []).length > 0 || (draft.parts || []).length > 0) && (
                  <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                    {(draft.maintenanceTasks || []).length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5 text-brand-500" /> Maintenance schedule<ConfChip level={draft.confidence?.maintenanceTasks} /></p>
                        <ul className="space-y-1">
                          {draft.maintenanceTasks.map((m, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><span className="text-brand-400 mt-1">•</span>
                              <span>{m.task}{m.intervalDays != null && <span className="text-gray-400"> · every {m.intervalDays} days</span>}{m.notes && <span className="text-gray-400"> — {m.notes}</span>}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(draft.parts || []).length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><Settings2 className="w-3.5 h-3.5 text-brand-500" /> Replacement parts<ConfChip level={draft.confidence?.parts} /></p>
                        <ul className="space-y-1">
                          {draft.parts.map((p, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><span className="text-brand-400 mt-1">•</span>
                              <span>{p.name}{p.partNumber && <span className="font-mono text-gray-500"> ({p.partNumber})</span>}{p.notes && <span className="text-gray-400"> — {p.notes}</span>}</span></li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-gray-400 mt-1">Saved with this equipment for later use (auto-scheduling &amp; parts links).</p>
                      </div>
                    )}
                  </div>
                )}
                {needsVerify && (
                  <label className="md:col-span-2 flex items-start gap-2 text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-brand-500" />
                    I've reviewed the AI-extracted details — especially the part numbers and maintenance intervals — and confirm they're correct.
                  </label>
                )}

                <div className="md:col-span-2 flex gap-2">
                  <button type="submit" disabled={needsVerify && !reviewed} className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed">Add Equipment</button>
                  <button type="button" onClick={() => { setShowAdd(false); resetForm(); }} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-4">
            {AREAS.map((areaDef) => {
              const areaEquipment = equipment.filter((eq) => (eq.area || 'other') === areaDef.value);
              if (areaEquipment.length === 0) return null;
              const areaCollapsed = collapsedAreas.has(areaDef.value);
              return (
                <div key={areaDef.value} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setCollapsedAreas((prev) => { const n = new Set(prev); n.has(areaDef.value) ? n.delete(areaDef.value) : n.add(areaDef.value); return n; })}
                    className="w-full flex items-center gap-2 px-5 py-3 hover:bg-gray-50">
                    {areaCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    <h3 className="text-sm font-bold text-gray-900">{areaDef.label}</h3>
                    <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{areaEquipment.length}</span>
                  </button>
                  {!areaCollapsed && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {areaEquipment.map((eq) => {
                        const sc = statusConfig[eq.status] || statusConfig.operational;
                        const StatusIcon = sc.icon;
                        const lastMaint = eq.maintenanceLogs?.[0];
                        return (
                          <div key={eq.id} onClick={() => setDetailId(eq.id)} className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/60">
                            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0"><Settings2 className="w-5 h-5 text-brand-500" /></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-gray-900">{eq.name}</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}><StatusIcon className="w-3 h-3 inline mr-1" />{sc.label}</span>
                                {eq._healthScore != null && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eq._healthScore > 80 ? 'bg-green-100 text-green-700' : eq._healthScore > 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>Health: {eq._healthScore}%</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 capitalize">{eq.category.replace('_', ' ')} {eq.manufacturer && `· ${eq.manufacturer}`} {eq.model && eq.model} {eq.serialNumber && `· S/N: ${eq.serialNumber}`}</p>
                            </div>
                            {lastMaint && (<div className="hidden md:block text-right text-xs text-gray-500"><p>Last service</p><p className="font-medium">{new Date(lastMaint.createdAt).toLocaleDateString()}</p></div>)}
                            <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {equipment.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No equipment registered yet</p>
            </div>
          )}
        </>
      )}

      {/* ==================== MAINTENANCE / REPAIRS TAB ==================== */}
      {(activeTab === 'maintenance' || activeTab === 'repairs') && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {['', 'scheduled', 'in_progress', 'completed'].map((s) => (
                <button key={s} onClick={() => setLogFilter(s)}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${logFilter === s ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {s ? (maintStatusConfig[s]?.label || s) : 'All'}
                </button>
              ))}
            </div>
            {isManager && (
              <button onClick={() => setShowLogForm(!showLogForm)} className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
                <Plus className="w-4 h-4" /> {activeTab === 'repairs' ? 'Log Repair' : 'Schedule Maintenance'}
              </button>
            )}
          </div>

          {showLogForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{activeTab === 'repairs' ? 'Log Repair' : 'Schedule Maintenance'}</h3>
                <button onClick={() => setShowLogForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={submitLocationLog} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipment *</label>
                  <select value={logForm.equipmentId} onChange={(e) => setLogForm({ ...logForm, equipmentId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" required>
                    <option value="">Select equipment...</option>
                    {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name} ({eq.category.replace('_', ' ')})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  {activeTab === 'maintenance' ? (
                    <select value={logForm.type} onChange={(e) => setLogForm({ ...logForm, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                      <option value="preventive">Preventive</option>
                      <option value="inspection">Inspection</option>
                    </select>
                  ) : (
                    <select value={logForm.type} onChange={(e) => setLogForm({ ...logForm, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                      <option value="repair">Repair</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  )}
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Cost ($)</label>
                  <input type="number" step="0.01" value={logForm.cost} onChange={(e) => setLogForm({ ...logForm, cost: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" rows={2} required /></div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {activeTab === 'repairs' ? 'Repair Guide / Photos / Videos' : 'Maintenance Guide / Photos / Videos'}
                  </label>
                  <FileUpload accept="image/*,video/*,.pdf" maxFiles={10} label="Upload how-to guides, photos, or videos" onUpload={(urls) => setLogForm({ ...logForm, mediaUrls: [...logForm.mediaUrls, ...urls] })} />
                  <MediaThumbnails urls={logForm.mediaUrls} onRemove={(i) => setLogForm({ ...logForm, mediaUrls: logForm.mediaUrls.filter((_, idx) => idx !== i) })} />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">Save</button>
                  <button type="button" onClick={() => setShowLogForm(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Location-wide log list */}
          <div className="space-y-3">
            {locationLogs.map((log) => {
              const ms = maintStatusConfig[log.status] || maintStatusConfig.scheduled;
              const MsIcon = ms.icon;
              const media = parseMedia(log.mediaUrls);
              const isSelected = selectedLog === log.id;

              return (
                <div key={log.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-5 cursor-pointer hover:bg-gray-50" onClick={() => setSelectedLog(isSelected ? null : log.id)}>
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${activeTab === 'repairs' ? 'bg-red-50' : 'bg-blue-50'}`}>
                        {activeTab === 'repairs' ? <Hammer className="w-5 h-5 text-red-600" /> : <ClipboardCheck className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{log.equipment?.name || 'Equipment'}</h3>
                          <span className="text-xs capitalize px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{log.type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ms.color}`}><MsIcon className="w-3 h-3 inline mr-1" />{ms.label}</span>
                          {media.length > 0 && <span className="text-xs text-gray-400 flex items-center gap-0.5"><ImageIcon className="w-3 h-3" />{media.length}</span>}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 line-clamp-1">{log.description}</p>
                        <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(log.createdAt).toLocaleDateString()}</span>
                          <span>By {log.performedBy?.firstName} {log.performedBy?.lastName}</span>
                          {log.cost && <span>${log.cost.toFixed(2)}</span>}
                        </div>
                      </div>
                      {log.status !== 'completed' && isManager && (
                        <button onClick={(e) => { e.stopPropagation(); completeMaint(log.id); }} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">Complete</button>
                      )}
                    </div>
                  </div>
                  {isSelected && media.length > 0 && (
                    <div className="border-t border-gray-100 p-5 bg-gray-50">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">{activeTab === 'repairs' ? 'Repair Guide & Media' : 'Maintenance Guide & Media'}</h4>
                      <MediaGallery urls={media} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {locationLogs.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              {activeTab === 'repairs' ? <Hammer className="w-10 h-10 text-gray-300 mx-auto mb-2" /> : <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />}
              <p className="text-gray-500">{logFilter ? `No ${activeTab} with this status` : `No ${activeTab} records yet`}</p>
            </div>
          )}
        </>
      )}

      {/* Equipment file (detail) */}
      {detailId && (
        <EquipmentDetailModal
          locationId={currentLocation.id}
          equipmentId={detailId}
          isManager={isManager}
          onClose={() => { setDetailId(null); fetchEquipment(); }}
          onChanged={fetchEquipment}
        />
      )}
    </div>
  );
}
