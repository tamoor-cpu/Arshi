import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  Wrench, Plus, X, Search, HelpCircle, Play, CheckCircle2, User, Trash2, Clock,
} from 'lucide-react';

const STATUS = {
  open: { label: 'Open', color: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-purple-100 text-purple-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};
const PRIORITY = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-500' },
  normal: { label: 'Normal', color: 'bg-blue-50 text-blue-600' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
};

function blank() { return { title: '', description: '', equipmentName: '', zone: '', priority: 'normal', assignedToId: '' }; }

export default function WorkOrdersPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(blank());
  const [error, setError] = useState('');

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchOrders = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/work-orders`);
      setOrders(data);
    } catch { toast.error('Failed to load work orders'); }
  }, [currentLocation, toast]);

  const fetchUsers = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get('/users', { params: { locationId: currentLocation.id } });
      setUsers(data);
    } catch { /* non-critical */ }
  }, [currentLocation]);

  useEffect(() => { fetchOrders(); fetchUsers(); }, [fetchOrders, fetchUsers]);

  const createOrder = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/locations/${currentLocation.id}/work-orders`, { ...form, assignedToId: form.assignedToId || null });
      setShowAdd(false); setForm(blank()); fetchOrders();
      toast.success('Work order created');
    } catch (err) { setError(err.response?.data?.error || 'Failed to create work order'); }
  };

  const setStatus = async (id, status) => {
    try { await api.patch(`/locations/${currentLocation.id}/work-orders/${id}`, { status }); fetchOrders(); toast.success(`Marked ${STATUS[status].label.toLowerCase()}`); }
    catch { toast.error('Failed to update'); }
  };
  const assign = async (id, assignedToId) => {
    try { await api.patch(`/locations/${currentLocation.id}/work-orders/${id}`, { assignedToId }); fetchOrders(); }
    catch { toast.error('Failed to assign'); }
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this work order?')) return;
    try { await api.delete(`/locations/${currentLocation.id}/work-orders/${id}`); fetchOrders(); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  if (!currentLocation) return null;

  const assignStart = orders.filter((o) => o.status === 'open').length;
  const inProgress = orders.filter((o) => o.status === 'in_progress').length;
  const completed = orders.filter((o) => o.status === 'completed').length;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600000;
  const fixTimes = orders.filter((o) => o.completedAt && o.startedAt && new Date(o.completedAt).getTime() >= thirtyDaysAgo)
    .map((o) => (new Date(o.completedAt) - new Date(o.startedAt)) / 3600000);
  const avgFix = fixTimes.length ? `${(fixTimes.reduce((a, b) => a + b, 0) / fixTimes.length).toFixed(1)}h` : '—';

  const visible = orders
    .filter((o) => !statusFilter || o.status === statusFilter)
    .filter((o) => !priorityFilter || o.priority === priorityFilter)
    .filter((o) => !assigneeFilter || o.assignedToId === assigneeFilter)
    .filter((o) => !search || o.title.toLowerCase().includes(search.toLowerCase()) || o.ticketNumber.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <Wrench className="w-6 h-6 text-brand-500" /> Work Orders
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track repairs from report to resolution at {currentLocation.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600"><HelpCircle className="w-5 h-5" /></button>
          {isManager && (
            <button onClick={() => { setForm(blank()); setError(''); setShowAdd(true); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-sm">
              <Plus className="w-4 h-4" /> New Work Order
            </button>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Assign & Start', value: assignStart, dot: 'bg-amber-400', hint: 'Needs assignment or start' },
          { label: 'In Progress', value: inProgress, dot: 'bg-blue-400', hint: 'Being worked on' },
          { label: 'Completed', value: completed, dot: 'bg-purple-400', hint: 'Awaiting manager approval' },
          { label: 'Avg Fix Time', value: avgFix, dot: 'bg-green-400', hint: 'Last 30 days' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{s.label}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
        </div>
        <span className="text-xs text-gray-400">{visible.length} ticket{visible.length !== 1 ? 's' : ''}</span>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-600">
          <option value="">Status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-600">
          <option value="">Priority</option>
          {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-600">
          <option value="">Assignee</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
      </div>

      {/* Ticket list */}
      <div className="space-y-2.5">
        {visible.map((o) => {
          const st = STATUS[o.status] || STATUS.open;
          const pr = PRIORITY[o.priority] || PRIORITY.normal;
          return (
            <div key={o.id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:border-brand-200 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0"><Wrench className="w-5 h-5 text-brand-500" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">{o.ticketNumber}</span>
                    <h3 className="text-sm font-semibold text-gray-900">{o.title}</h3>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${pr.color}`}>{pr.label}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                  </div>
                  {o.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{o.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    {o.equipmentName && <span>{o.equipmentName}{o.zone ? ` · ${o.zone}` : ''}</span>}
                    {o.assignedTo
                      ? <span className="flex items-center gap-1"><User className="w-3 h-3" />{o.assignedTo.firstName} {o.assignedTo.lastName?.[0]}.</span>
                      : <span className="text-amber-500">Unassigned</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(o.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {isManager && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {o.status === 'open' && (
                      <>
                        <select value={o.assignedToId || ''} onChange={(e) => assign(o.id, e.target.value || null)}
                          className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600">
                          <option value="">Assign</option>
                          {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName?.[0]}.</option>)}
                        </select>
                        <button onClick={() => setStatus(o.id, 'in_progress')} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100"><Play className="w-3.5 h-3.5" /> Start</button>
                      </>
                    )}
                    {o.status === 'in_progress' && (
                      <button onClick={() => setStatus(o.id, 'completed')} className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg hover:bg-purple-100"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</button>
                    )}
                    {o.status === 'completed' && (
                      <button onClick={() => setStatus(o.id, 'approved')} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-100"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
                    )}
                    <button onClick={() => remove(o.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl py-14 text-center">
            <Wrench className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600">No work orders found</p>
            <p className="text-xs text-gray-400 mt-1">{search || statusFilter || priorityFilter || assigneeFilter ? 'Try adjusting your filters' : 'Create a work order to dispatch and track equipment repairs.'}</p>
          </div>
        )}
      </div>

      {/* New work order modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-brand-500">OPERATIONS</p>
                <h3 className="text-lg font-bold text-gray-900">New Work Order</h3>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createOrder} className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Replace Vacuum #3 motor" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Equipment</label>
                  <input value={form.equipmentName} onChange={(e) => setForm({ ...form, equipmentName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Vacuum #3" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Zone</label>
                  <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Vacuum Lot" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                    {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg">Create Work Order</button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
