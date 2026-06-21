import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import FileUpload, { MediaThumbnails } from '../components/common/FileUpload';
import MediaGallery from '../components/common/MediaGallery';
import {
  GraduationCap, Plus, X, BookOpen, Clock, CheckCircle2, Award,
  AlertCircle, Play, Star, Film,
} from 'lucide-react';

const categoryOptions = [
  { value: '', label: 'All' },
  { value: 'safety', label: 'Safety' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'chemical', label: 'Chemical' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'operations', label: 'Operations' },
];

const categoryColors = {
  safety: 'bg-red-100 text-red-700',
  equipment: 'bg-blue-100 text-blue-700',
  chemical: 'bg-purple-100 text-purple-700',
  customer_service: 'bg-green-100 text-green-700',
  operations: 'bg-amber-100 text-amber-700',
};

const statusIcons = {
  not_started: { icon: Play, color: 'text-gray-400', label: 'Not Started' },
  in_progress: { icon: Clock, color: 'text-blue-500', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Completed' },
  failed: { icon: AlertCircle, color: 'text-red-500', label: 'Failed' },
};

export default function TrainingPage() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState(null);
  const [filterCat, setFilterCat] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'safety', content: '', durationMinutes: '', isRequired: false, mediaUrls: [] });
  const [error, setError] = useState('');

  const toast = useToast();
  const isAdmin = ['SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(user.role);

  const fetchModules = useCallback(async () => {
    try {
      const params = {};
      if (filterCat) params.category = filterCat;
      const { data } = await api.get('/training', { params });
      setModules(data);
    } catch (err) {
      console.error('Fetch training error:', err);
    }
  }, [filterCat]);

  const fetchProgress = async () => {
    try {
      const { data } = await api.get('/training/my/progress');
      setProgress(data);
    } catch (err) {
      console.error('Fetch progress error:', err);
    }
  };

  useEffect(() => { fetchModules(); fetchProgress(); }, [fetchModules]);

  const fetchDetail = async (id) => {
    try {
      const { data } = await api.get(`/training/${id}`);
      setAcknowledged(false);
      setSelectedModule(data);
    } catch (err) {
      console.error('Fetch module detail error:', err);
    }
  };

  const addModule = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/training', {
        ...form,
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : null,
        mediaUrls: form.mediaUrls,
      });
      setShowAdd(false);
      setForm({ title: '', description: '', category: 'safety', content: '', durationMinutes: '', isRequired: false, mediaUrls: [] });
      fetchModules();
      toast.success('Training module created');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create module');
    }
  };

  const startTraining = async (moduleId) => {
    try {
      await api.post(`/training/${moduleId}/start`);
      fetchModules();
      fetchProgress();
    } catch (err) {
      console.error('Start training error:', err);
    }
  };

  const completeTraining = async (moduleId) => {
    try {
      // Record completion as an acknowledgement — omit score so no fabricated
      // quiz result is stored (server marks status 'completed' when score is absent).
      await api.patch(`/training/${moduleId}/complete`, {});
      fetchModules();
      fetchProgress();
      setSelectedModule(null);
      setAcknowledged(false);
    } catch (err) {
      console.error('Complete training error:', err);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">RESOURCES</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <GraduationCap className="w-6 h-6 text-brand-500" /> Training
          </h1>
          <p className="text-sm text-gray-500 mt-1">SOP training compliance across your team</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
            <Plus className="w-4 h-4" /> Add Module
          </button>
        )}
      </div>

      {/* Progress card */}
      {progress && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Progress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-brand-600">{progress.percentage}%</p>
              <p className="text-xs text-gray-500">Overall</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{progress.completed}/{progress.total}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{progress.requiredCompleted}/{progress.required}</p>
              <p className="text-xs text-gray-500">Required</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{progress.total - progress.completed}</p>
              <p className="text-xs text-gray-500">Remaining</p>
            </div>
          </div>
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5">
            <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${progress.percentage}%` }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {categoryOptions.map((c) => (
          <button key={c.value} onClick={() => setFilterCat(c.value)} className={`px-3 py-1.5 text-sm rounded-lg border ${filterCat === c.value ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Create Training Module</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <form onSubmit={addModule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                {categoryOptions.filter((c) => c.value).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" rows={4} placeholder="Training content (supports text)..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Training Media (Videos, Images, PDFs)</label>
              <FileUpload accept="image/*,video/*,.pdf" maxFiles={10} label="Upload training videos, images, or documents" onUpload={(urls) => setForm({ ...form, mediaUrls: [...form.mediaUrls, ...urls] })} />
              <MediaThumbnails urls={form.mediaUrls} onRemove={(i) => setForm({ ...form, mediaUrls: form.mediaUrls.filter((_, idx) => idx !== i) })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="required" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} className="w-4 h-4 text-brand-500 rounded" />
              <label htmlFor="required" className="text-sm text-gray-700">Required for all employees</label>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">Create Module</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Module detail modal */}
      {selectedModule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedModule(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">{selectedModule.title}</h3>
              <button onClick={() => setSelectedModule(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>

            {selectedModule.description && <p className="text-sm text-gray-600 mb-4">{selectedModule.description}</p>}
            {selectedModule.content && (
              <div className="p-4 bg-gray-50 rounded-lg mb-4 text-sm text-gray-700 whitespace-pre-wrap">{selectedModule.content}</div>
            )}
            {(() => {
              const media = typeof selectedModule.mediaUrls === 'string' ? JSON.parse(selectedModule.mediaUrls || '[]') : (selectedModule.mediaUrls || []);
              return media.length > 0 ? (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Training Media</h4>
                  <MediaGallery urls={media} />
                </div>
              ) : null;
            })()}

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                />
                <span className="text-sm text-gray-700">I have read and understood this training</span>
              </label>
              <div className="flex gap-3 mt-3">
                <button onClick={() => startTraining(selectedModule.id)} className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 flex items-center gap-1">
                  <Play className="w-4 h-4" /> Start
                </button>
                <button
                  onClick={() => completeTraining(selectedModule.id)}
                  disabled={!acknowledged}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirm Completion
                </button>
              </div>
            </div>

            {isAdmin && selectedModule.completions?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Team Progress ({selectedModule.completions.length})</h4>
                <div className="space-y-1">
                  {selectedModule.completions.map((comp) => (
                    <div key={comp.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                      <span className="font-medium text-gray-900">{comp.user.firstName} {comp.user.lastName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${comp.status === 'completed' ? 'bg-green-100 text-green-700' : comp.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {comp.status}
                      </span>
                      {comp.score !== null && <span className="text-xs text-gray-500">Score: {comp.score}%</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const si = statusIcons[mod.userStatus] || statusIcons.not_started;
          const StatusIcon = si.icon;
          const catColor = categoryColors[mod.category] || 'bg-gray-100 text-gray-700';

          return (
            <div key={mod.id} onClick={() => fetchDetail(mod.id)} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${catColor}`}>
                      {mod.category.replace('_', ' ')}
                    </span>
                    {mod.isRequired && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium flex items-center gap-0.5">
                        <Star className="w-3 h-3" /> Required
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-2">{mod.title}</h3>
                  {mod.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{mod.description}</p>}
                </div>
                <StatusIcon className={`w-5 h-5 ${si.color} shrink-0 ml-2`} />
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                {mod.durationMinutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {mod.durationMinutes} min</span>}
                {(() => { try { const m = typeof mod.mediaUrls === 'string' ? JSON.parse(mod.mediaUrls || '[]') : (mod.mediaUrls || []); return m.length > 0 ? <span className="flex items-center gap-0.5"><Film className="w-3 h-3" /> {m.length} media</span> : null; } catch { return null; } })()}
                <span>{mod._count?.completions || 0} completed</span>
                <span className={`ml-auto font-medium ${si.color}`}>{si.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {modules.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No training modules yet</p>
        </div>
      )}
    </div>
  );
}
