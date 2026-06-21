import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  ClipboardList, Plus, X, Search, Pencil, Trash2, CheckCircle2,
  ChevronDown, ChevronRight, ListPlus, SlidersHorizontal,
} from 'lucide-react';

const SECTIONS = [
  { key: 'opening', label: 'Opening' },
  { key: 'midshift', label: 'Midshift' },
  { key: 'closing', label: 'Closing' },
  { key: 'other', label: 'Anytime' },
];
const freqLabel = { daily: 'Daily', weekly: 'Weekly', once: 'One-time' };
const freqBadge = { daily: 'bg-blue-50 text-blue-600', weekly: 'bg-green-50 text-green-600', once: 'bg-gray-100 text-gray-500' };
const categories = ['maintenance', 'cleaning', 'chemical', 'staffing', 'customer', 'other'];

export default function TasksPage() {
  const { currentLocation, user } = useAuth();
  const socket = useSocket();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState('all'); // all | mine | unassigned
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [listFilter, setListFilter] = useState('all'); // all | <listName> | none
  const [showLists, setShowLists] = useState(false);

  function blankForm() {
    return { title: '', description: '', priority: 'medium', category: 'cleaning',
      frequency: 'daily', shiftPeriod: 'opening', required: false, assignedToId: '', dueBy: '', listName: '' };
  }

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchTasks = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/tasks`, { params: { limit: 200 } });
      setTasks(data.data || data);
    } catch { toast.error('Failed to load tasks'); }
  }, [currentLocation, toast]);

  const fetchUsers = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get('/users', { params: { locationId: currentLocation.id } });
      setUsers(data);
    } catch { /* non-critical */ }
  }, [currentLocation]);

  useEffect(() => { fetchTasks(); fetchUsers(); }, [fetchTasks, fetchUsers]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchTasks();
    socket.on('task-created', refresh);
    socket.on('task-updated', refresh);
    socket.on('tasks-generated', refresh);
    return () => {
      socket.off('task-created', refresh);
      socket.off('task-updated', refresh);
      socket.off('tasks-generated', refresh);
    };
  }, [socket, fetchTasks]);

  const openCreate = () => { setEditing(null); setForm(blankForm()); setError(''); setShowForm(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      title: t.title, description: t.description || '', priority: t.priority, category: t.category,
      frequency: t.frequency || 'once', shiftPeriod: t.shiftPeriod || 'opening',
      required: !!t.required, assignedToId: t.assignedToId || '', dueBy: t.dueBy ? t.dueBy.slice(0, 16) : '',
      listName: t.listName || '',
    });
    setError(''); setShowForm(true);
  };

  const saveTask = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form, assignedToId: form.assignedToId || null, dueBy: form.dueBy || null, listName: form.listName.trim() || null };
    try {
      if (editing) { await api.patch(`/locations/${currentLocation.id}/tasks/${editing.id}`, payload); toast.success('Task updated'); }
      else { await api.post(`/locations/${currentLocation.id}/tasks`, payload); toast.success('Task added'); }
      setShowForm(false); fetchTasks();
    } catch (err) { setError(err.response?.data?.error || 'Failed to save task'); }
  };

  const completeTask = async (id) => {
    try { await api.patch(`/locations/${currentLocation.id}/tasks/${id}`, { status: 'completed' }); fetchTasks(); }
    catch { toast.error('Failed to complete task'); }
  };

  const assignToList = async (id, listName) => {
    try { await api.patch(`/locations/${currentLocation.id}/tasks/${id}`, { listName: listName || null }); fetchTasks(); toast.success(listName ? `Moved to "${listName}"` : 'Removed from list'); }
    catch { toast.error('Failed to update list'); }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try { await api.delete(`/locations/${currentLocation.id}/tasks/bulk`, { data: { taskIds: [id] } }); fetchTasks(); toast.success('Task deleted'); }
    catch { toast.error('Failed to delete task'); }
  };

  const toggleSection = (key) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const setAllCollapsed = (val) => setCollapsed(val ? new Set(SECTIONS.map((s) => s.key)) : new Set());

  if (!currentLocation) return null;

  const active = tasks.filter((t) => !['completed', 'cancelled'].includes(t.status));
  const completed = tasks.filter((t) => t.status === 'completed');
  const totalToday = active.length + completed.length;

  // Named lists derived from existing tasks' listName field
  const lists = Array.from(new Set(tasks.map((t) => t.listName).filter(Boolean))).sort();
  const listCount = (name) => active.filter((t) => (t.listName || null) === name).length;

  const matchesFilters = (t) => {
    if (assigneeFilter === 'mine' && t.assignedToId !== user.id) return false;
    if (assigneeFilter === 'unassigned' && t.assignedToId) return false;
    if (listFilter === 'none' && t.listName) return false;
    if (listFilter !== 'all' && listFilter !== 'none' && t.listName !== listFilter) return false;
    if (search && !(t.title.toLowerCase().includes(search.toLowerCase()) || (t.description || '').toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  };
  const visibleActive = active.filter(matchesFilters);
  const sectionTasks = (key) => visibleActive.filter((t) => (t.shiftPeriod || 'other') === key);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <ClipboardList className="w-6 h-6 text-brand-500" /> To-Do
          </h1>
          <p className="text-sm text-gray-500 mt-1">Opening, midshift, and closing tasks for {currentLocation.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLists(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
            <ListPlus className="w-4 h-4" /> Custom Lists
          </button>
          {isManager && (
            <button onClick={() => setShowLists(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
              <SlidersHorizontal className="w-4 h-4" /> Manage Lists
            </button>
          )}
          {isManager && (
            <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-sm">
              <Plus className="w-4 h-4" /> Add Task
            </button>
          )}
        </div>
      </div>

      {/* Today's Progress */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Today's Progress</h3>
          <span className="text-xs text-gray-400">{completed.length} of {totalToday} complete</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-2.5 rounded-full bg-brand-500 transition-all" style={{ width: `${totalToday ? (completed.length / totalToday) * 100 : 0}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">{active.length} still need follow-up</p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-1.5">
          {[
            { key: 'all', label: 'All' },
            { key: 'mine', label: 'Mine' },
            { key: 'unassigned', label: 'Unassigned' },
          ].map((f) => (
            <button key={f.key} onClick={() => setAssigneeFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${assigneeFilter === f.key ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAllCollapsed(false)} className="text-xs text-gray-400 hover:text-gray-600">Expand all</button>
          <span className="text-gray-200">·</span>
          <button onClick={() => setAllCollapsed(true)} className="text-xs text-gray-400 hover:text-gray-600">Collapse all</button>
        </div>
      </div>

      {/* List filter chips (only when named lists exist) */}
      {lists.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-xs text-gray-400 mr-1">Lists:</span>
          {[{ key: 'all', label: 'All lists' }, ...lists.map((l) => ({ key: l, label: l })), { key: 'none', label: 'No list' }].map((f) => (
            <button key={f.key} onClick={() => setListFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${listFilter === f.key ? 'bg-brand-50 text-brand-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..."
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
      </div>

      {/* Shift sections (accordions) */}
      <div className="space-y-3">
        {SECTIONS.map((section) => {
          const items = sectionTasks(section.key);
          if (items.length === 0) return null;
          const isCollapsed = collapsed.has(section.key);
          return (
            <div key={section.key} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <button onClick={() => toggleSection(section.key)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50">
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                <h3 className="text-sm font-bold text-gray-900">{section.label}</h3>
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{items.length}</span>
              </button>
              {!isCollapsed && (
                <div className="border-t border-gray-50 divide-y divide-gray-50">
                  {items.map((t) => {
                    const isHigh = t.priority === 'high' || t.priority === 'critical';
                    return (
                      <div key={t.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50">
                        <button onClick={() => completeTask(t.id)} title="Mark complete" className="mt-0.5 text-gray-300 hover:text-green-500 shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-gray-900">{t.title}</h4>
                            {isHigh && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 uppercase">High</span>}
                            {t.required && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-600">Req'd</span>}
                            {t.source === 'ai_generated' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">AI</span>}
                          </div>
                          {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${freqBadge[t.frequency] || freqBadge.once}`}>{freqLabel[t.frequency] || 'One-time'}</span>
                            {t.assignedTo
                              ? <span className="text-[10px] text-gray-400">· {t.assignedTo.firstName} {t.assignedTo.lastName?.[0]}.</span>
                              : <span className="text-[10px] text-amber-500">· Unassigned</span>}
                          </div>
                        </div>
                        {isManager && (
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteTask(t.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {visibleActive.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl py-14 text-center">
            <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">All caught up</p>
            <p className="text-xs text-gray-400 mt-1">No open tasks match this filter. Add a task to get started.</p>
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Completed ({completed.length})</h3>
          <div className="space-y-1.5">
            {completed.slice(0, 12).map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-4 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm text-gray-400 line-through">{t.title}</span>
                {t.completedAt && <span className="text-xs text-gray-300 ml-auto">{new Date(t.completedAt).toLocaleDateString()}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manage Lists modal */}
      {showLists && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLists(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
                <h3 className="text-lg font-bold text-gray-900">Custom Lists</h3>
              </div>
              <button onClick={() => setShowLists(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">Group active tasks into named lists. Filter the board by tapping a list below, or {isManager ? 'reassign tasks to a list here.' : 'open a task to change its list.'}</p>
              {lists.length === 0 && active.filter((t) => !t.listName).length === 0 && (
                <p className="text-sm text-gray-400">No tasks yet.</p>
              )}
              {[...lists, null].map((name) => {
                const items = active.filter((t) => (t.listName || null) === (name || null));
                if (items.length === 0) return null;
                return (
                  <div key={name || '__none__'} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <ListPlus className="w-4 h-4 text-brand-500" />
                        <span className="text-sm font-semibold text-gray-800">{name || 'No list'}</span>
                        <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{listCount(name || null)}</span>
                      </div>
                      <button onClick={() => { setListFilter(name || 'none'); setShowLists(false); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Filter</button>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {items.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 px-3 py-2">
                          <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{t.title}</span>
                          {isManager && (
                            <select value={t.listName || ''} onChange={(e) => assignToList(t.id, e.target.value)}
                              className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600 shrink-0">
                              <option value="">No list</option>
                              {lists.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {isManager && (
                <p className="text-xs text-gray-400">Tip: create a new list by typing its name in the List field when adding or editing a task.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
                <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit Task' : 'New Task'}</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveTask} className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Task Name</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Fold 300 towels" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Frequency</label>
                  <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="once">One-time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Shift Period</label>
                  <select value={form.shiftPeriod} onChange={(e) => setForm({ ...form, shiftPeriod: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    <option value="opening">Opening</option>
                    <option value="midshift">Midshift</option>
                    <option value="closing">Closing</option>
                    <option value="other">Anytime</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none capitalize">
                    {categories.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Assign To</label>
                  <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Due By</label>
                  <input type="datetime-local" value={form.dueBy} onChange={(e) => setForm({ ...form, dueBy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">List (optional)</label>
                  <input value={form.listName} onChange={(e) => setForm({ ...form, listName: e.target.value })} list="task-list-names"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Weekend Deep Clean" />
                  <datalist id="task-list-names">
                    {lists.map((l) => <option key={l} value={l} />)}
                  </datalist>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-brand-400" />
                Required task (must be completed each shift)
              </label>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg">{editing ? 'Save Changes' : 'Add Task'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
