import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Users, Sparkles } from 'lucide-react';

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
  const { currentLocation } = useAuth();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [assignments, setAssignments] = useState([]);

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

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

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
          <button className="flex items-center gap-1.5 px-3 py-2 border border-team/30 text-team text-sm font-medium rounded-lg hover:bg-team/5">
            <Sparkles className="w-4 h-4" /> Get Advice
          </button>
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
          <button key={t} disabled={i > 0}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              i === 0 ? 'border-team text-gray-900' : 'border-transparent text-gray-300 cursor-not-allowed'
            }`}>
            {t}{i === 1 ? ' (0)' : ''}
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
                  <div key={a.id} className="rounded-lg px-2 py-1.5 text-left" style={{ background: (a.shift?.color || '#1fb6d8') + '18' }}>
                    <p className="text-[11px] font-semibold text-gray-800 truncate">{a.shift?.name || 'Shift'}</p>
                    <p className="text-[10px] text-gray-500">{a.shift?.startTime}–{a.shift?.endTime}</p>
                    <p className="text-[11px] text-gray-600 truncate">{a.user ? `${a.user.firstName} ${a.user.lastName?.[0]}.` : 'Unassigned'}</p>
                  </div>
                ))}
                {items.length === 0 && <p className="text-[11px] text-gray-300 text-center pt-6">No shifts</p>}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Build and auto-assign shifts from <span className="font-medium text-team">Time Clock → Auto-Schedule</span>. Assignments appear here automatically.
      </p>
    </div>
  );
}
