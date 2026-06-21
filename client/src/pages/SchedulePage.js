import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Users, Plus, X } from 'lucide-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDate(d) { return d.toISOString().slice(0, 10); }

export default function SchedulePage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [assignments, setAssignments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignDate, setAssignDate] = useState(null); // Date object for modal
  const [assignForm, setAssignForm] = useState({ shiftId: '', userId: '' });
  const [saving, setSaving] = useState(false);

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user?.role);

  const fetchAssignments = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const end = addDays(weekStart, 6);
      const { data } = await api.get(`/locations/${currentLocation.id}/assignments`, {
        params: { startDate: fmtDate(weekStart), endDate: fmtDate(end) },
      });
      setAssignments(data);
    } catch { toast.error('Failed to load schedule'); }
  }, [currentLocation, weekStart, toast]);

  const fetchOptions = useCallback(async () => {
    if (!currentLocation || !isManager) return;
    try {
      const [shiftsRes, usersRes] = await Promise.all([
        api.get(`/locations/${currentLocation.id}/shifts`),
        api.get('/users', { params: { locationId: currentLocation.id } }),
      ]);
      setShifts(shiftsRes.data);
      setEmployees(usersRes.data);
    } catch { /* non-critical: assign modal just won't have options */ }
  }, [currentLocation, isManager]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);
  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const openAssign = (d) => {
    setAssignForm({ shiftId: shifts[0]?.id || '', userId: '' });
    setAssignDate(d);
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.shiftId || !assignForm.userId) {
      toast.error('Pick a shift and an employee');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/locations/${currentLocation.id}/shifts/${assignForm.shiftId}/assign`, {
        userId: assignForm.userId,
        date: fmtDate(assignDate),
      });
      toast.success('Shift assigned');
      setAssignDate(null);
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign shift');
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (assignmentId) => {
    try {
      await api.delete(`/locations/${currentLocation.id}/assignments/${assignmentId}`);
      toast.success('Assignment removed');
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove assignment');
    }
  };

  if (!currentLocation) return null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = (d) => assignments.filter((a) => new Date(a.date).toDateString() === d.toDateString());
  const totalShifts = assignments.length;
  const staffCount = new Set(assignments.map((a) => a.user?.id)).size;
  const today = new Date().toDateString();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-team">TEAM</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <CalendarDays className="w-6 h-6 text-team" /> Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-1">{currentLocation.name}: weather-based staffing insights</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">Today</button>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 hover:bg-gray-50"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 hover:bg-gray-50 border-l border-gray-200"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        {['Schedule', 'Requests', 'Availability'].map((t, i) => (
          <button key={t} disabled={i > 0} title={i > 0 ? 'Coming soon' : undefined}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              i === 0 ? 'border-team text-gray-900' : 'border-transparent text-gray-300 cursor-not-allowed'
            }`}>
            {t}
            {i > 0 && <span className="ml-1 text-[10px] text-gray-300">(soon)</span>}
          </button>
        ))}
      </div>

      {/* Week summary */}
      <div className="flex items-center gap-4 mb-4">
        <p className="text-sm font-semibold text-gray-700">
          {weekStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} – {addDays(weekStart, 6).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3.5 h-3.5" /> {totalShifts} shifts</span>
        <span className="flex items-center gap-1 text-xs text-gray-400"><Users className="w-3.5 h-3.5" /> {staffCount} staff</span>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {days.map((d) => {
          const items = byDay(d);
          const isToday = d.toDateString() === today;
          return (
            <div key={d.toISOString()} className={`bg-white border rounded-2xl overflow-hidden ${isToday ? 'border-brand-300 ring-1 ring-brand-100' : 'border-gray-100'}`}>
              <div className={`px-3 py-2 text-center border-b ${isToday ? 'bg-brand-50 border-brand-100' : 'bg-gray-50 border-gray-100'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? 'text-brand-600' : 'text-gray-400'}`}>{DAY_NAMES[d.getDay()]}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-brand-700' : 'text-gray-800'}`}>{d.getDate()}</p>
              </div>
              <div className="p-2 space-y-1.5 min-h-[120px]">
                {items.map((a) => (
                  <div key={a.id} className="group relative rounded-lg px-2 py-1.5 text-left" style={{ background: (a.shift?.color || '#1fb6d8') + '18' }}>
                    {isManager && (
                      <button
                        onClick={() => removeAssignment(a.id)}
                        title="Remove assignment"
                        className="absolute top-1 right-1 p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <p className="text-[11px] font-semibold text-gray-800 truncate pr-4">{a.shift?.name || 'Shift'}</p>
                    <p className="text-[10px] text-gray-500">{a.shift?.startTime}–{a.shift?.endTime}</p>
                    <p className="text-[11px] text-gray-600 truncate">{a.user ? `${a.user.firstName} ${a.user.lastName?.[0]}.` : 'Unassigned'}</p>
                  </div>
                ))}
                {items.length === 0 && <p className="text-[11px] text-gray-300 text-center pt-6">No shifts</p>}
                {isManager && (
                  <button
                    onClick={() => openAssign(d)}
                    className="w-full flex items-center justify-center gap-1 mt-1 px-2 py-1 text-[11px] font-medium text-team border border-dashed border-team/30 rounded-lg hover:bg-team/5"
                  >
                    <Plus className="w-3 h-3" /> Assign
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Assign staff to shifts directly from a day cell, or build and auto-assign shifts from <span className="font-medium text-team">Time Clock → Auto-Schedule</span>.
      </p>

      {/* Assign modal */}
      {assignDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAssignDate(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                Assign shift &middot; {assignDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </h3>
              <button onClick={() => setAssignDate(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                <select
                  value={assignForm.shiftId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, shiftId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-team/40 outline-none"
                  required
                >
                  <option value="">Select a shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                  ))}
                </select>
                {shifts.length === 0 && (
                  <p className="text-[11px] text-gray-400 mt-1">No shift templates yet. Create one from Time Clock first.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  value={assignForm.userId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, userId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-team/40 outline-none"
                  required
                >
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-team text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Assigning…' : 'Assign'}
                </button>
                <button
                  type="button"
                  onClick={() => setAssignDate(null)}
                  className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
