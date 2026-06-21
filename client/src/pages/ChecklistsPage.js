import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import PrintButton from '../components/common/PrintButton';
import {
  ClipboardCheck,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sunrise,
  Sunset,
  Beaker,
  Wrench,
  ListChecks,
  X,
} from 'lucide-react';

const typeIcons = {
  opening: Sunrise,
  closing: Sunset,
  chemical: Beaker,
  equipment: Wrench,
  custom: ListChecks,
};

const typeColors = {
  opening: 'bg-amber-50 text-amber-700 border-amber-200',
  closing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  chemical: 'bg-green-50 text-green-700 border-green-200',
  equipment: 'bg-red-50 text-red-700 border-red-200',
  custom: 'bg-gray-50 text-gray-700 border-gray-200',
};

export default function ChecklistsPage() {
  const { currentLocation, user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    type: 'opening',
    tasks: [{ title: '', requiresPhoto: false, section: '', estimatedMinutes: 5 }],
  });

  const fetchData = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const [templatesRes, completedRes] = await Promise.all([
        api.get(`/locations/${currentLocation.id}/checklists/templates`),
        api.get(`/locations/${currentLocation.id}/checklists/completed`),
      ]);
      setTemplates(templatesRes.data);
      setCompleted(completedRes.data);
    } catch (err) {
      console.error('Fetch checklists error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentLocation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startChecklist = async (templateId) => {
    try {
      const { data } = await api.post(`/locations/${currentLocation.id}/checklists/start`, { templateId });
      navigate(`/checklists/${data.id}`);
    } catch (err) {
      console.error('Start checklist error:', err);
    }
  };

  const createTemplate = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/locations/${currentLocation.id}/checklists/templates`, newTemplate);
      setShowCreate(false);
      setNewTemplate({
        name: '',
        description: '',
        type: 'opening',
        tasks: [{ title: '', requiresPhoto: false, section: '', estimatedMinutes: 5 }],
      });
      fetchData();
    } catch (err) {
      console.error('Create template error:', err);
    }
  };

  const addTask = () => {
    setNewTemplate({
      ...newTemplate,
      tasks: [...newTemplate.tasks, { title: '', requiresPhoto: false, section: '', estimatedMinutes: 5 }],
    });
  };

  const updateTask = (idx, field, value) => {
    const tasks = [...newTemplate.tasks];
    tasks[idx] = { ...tasks[idx], [field]: value };
    setNewTemplate({ ...newTemplate, tasks });
  };

  const removeTask = (idx) => {
    setNewTemplate({ ...newTemplate, tasks: newTemplate.tasks.filter((_, i) => i !== idx) });
  };

  if (!currentLocation) return null;

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <ClipboardCheck className="w-6 h-6 text-brand-500" /> Inspections
          </h1>
          <p className="text-sm text-gray-500 mt-1">Daily procedures and compliance tracking</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          {isManager && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600"
            >
              <Plus className="w-4 h-4" /> New Template
            </button>
          )}
        </div>
      </div>

      {/* Create template form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Create Checklist Template</h3>
          <form onSubmit={createTemplate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                  placeholder="e.g. Morning Opening Checklist"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newTemplate.type}
                  onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                >
                  <option value="opening">Opening</option>
                  <option value="closing">Closing</option>
                  <option value="chemical">Chemical Check</option>
                  <option value="equipment">Equipment</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tasks</label>
              <div className="space-y-2">
                {newTemplate.tasks.map((task, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-6">{idx + 1}.</span>
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => updateTask(idx, 'title', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                      placeholder="Task description"
                      required
                    />
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={task.requiresPhoto}
                        onChange={(e) => updateTask(idx, 'requiresPhoto', e.target.checked)}
                        className="rounded"
                      />
                      Photo
                    </label>
                    {newTemplate.tasks.length > 1 && (
                      <button type="button" onClick={() => removeTask(idx)} className="p-1 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addTask} className="mt-2 text-sm text-brand-600 hover:text-brand-700">
                + Add task
              </button>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">Create Template</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Templates grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Available Checklists</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-40 animate-pulse" />
            ))}
          </div>
        ) : templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => {
              const Icon = typeIcons[tmpl.type] || ListChecks;
              return (
                <div key={tmpl.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`px-2.5 py-1 rounded-md text-xs font-medium border ${typeColors[tmpl.type] || typeColors.custom}`}>
                      <Icon className="w-3.5 h-3.5 inline-block mr-1" />
                      {tmpl.type}
                    </div>
                    <span className="text-xs text-gray-400">{tmpl.tasks?.length || 0} tasks</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{tmpl.name}</h3>
                  {tmpl.description && <p className="text-xs text-gray-500 mb-3">{tmpl.description}</p>}
                  <button
                    onClick={() => startChecklist(tmpl.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600"
                  >
                    <Play className="w-4 h-4" /> Start Checklist
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No checklist templates yet</p>
          </div>
        )}
      </div>

      {/* Recent completions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Completions</h2>
        <div className="bg-white rounded-xl border border-gray-200">
          {completed.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {completed.slice(0, 10).map((cl) => (
                <div key={cl.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  {cl.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{cl.template?.name}</p>
                    <p className="text-xs text-gray-500">
                      {cl.user?.firstName} {cl.user?.lastName} &middot;{' '}
                      {new Date(cl.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    cl.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {cl.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No completed checklists yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
