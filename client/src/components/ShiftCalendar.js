import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekDates(baseDate) {
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay()); // go to Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function ShiftCalendar({ shifts = [], assignments = [] }) {
  const [baseDate, setBaseDate] = useState(new Date());
  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);
  const today = new Date();

  const prevWeek = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 7);
    setBaseDate(d);
  };

  const nextWeek = () => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 7);
    setBaseDate(d);
  };

  const goToday = () => setBaseDate(new Date());

  // Build a lookup: date string -> shifts active on that day
  const shiftsByDay = useMemo(() => {
    const map = {};
    weekDates.forEach((date) => {
      const dayOfWeek = date.getDay(); // 0=Sun
      const dayStr = date.toISOString().slice(0, 10);
      map[dayStr] = shifts.filter((s) => {
        const activeDays = s.daysOfWeek?.split(',').map(Number) || [];
        return activeDays.includes(dayOfWeek);
      });
    });
    return map;
  }, [weekDates, shifts]);

  // Assignments lookup: shiftId+date -> users
  const assignmentsByShiftDate = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      const dateStr = new Date(a.date).toISOString().slice(0, 10);
      const key = `${a.shiftId}-${dateStr}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [assignments]);

  const weekLabel = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Weekly Schedule</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={goToday} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded font-medium">
            Today
          </button>
          <button onClick={prevWeek} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={nextWeek} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
            {weekDates.map((date, i) => {
              const isToday = isSameDay(date, today);
              return (
                <div key={i} className={`px-2 py-3 text-center border-r border-gray-100 dark:border-gray-700 last:border-r-0 ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                  <p className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`}>
                    {DAY_NAMES[i]}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>
                    {date.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Shift rows */}
          {shifts.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">No shifts configured</p>
            </div>
          ) : (
            <div>
              {shifts.map((shift) => (
                <div key={shift.id} className="grid grid-cols-7 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0">
                  {weekDates.map((date, dayIdx) => {
                    const dateStr = date.toISOString().slice(0, 10);
                    const isActive = shiftsByDay[dateStr]?.some((s) => s.id === shift.id);
                    const isToday = isSameDay(date, today);
                    const key = `${shift.id}-${dateStr}`;
                    const dayAssignments = assignmentsByShiftDate[key] || [];

                    return (
                      <div
                        key={dayIdx}
                        className={`px-2 py-2 min-h-[72px] border-r border-gray-50 dark:border-gray-700/50 last:border-r-0 ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/5' : ''}`}
                      >
                        {isActive && (
                          <div
                            className="rounded-lg px-2 py-1.5 text-xs"
                            style={{ backgroundColor: `${shift.color}15`, borderLeft: `3px solid ${shift.color}` }}
                          >
                            <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{shift.name}</p>
                            <p className="text-gray-500 dark:text-gray-400">{shift.startTime} - {shift.endTime}</p>
                            <div className="mt-1 flex items-center gap-1">
                              <Users className="w-3 h-3 text-gray-400" />
                              <span className={`${dayAssignments.length < (shift.minStaff || 1) ? 'text-yellow-600 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                {dayAssignments.length}/{shift.minStaff || 1} staff
                              </span>
                              {dayAssignments.length < (shift.minStaff || 1) && (
                                <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1 rounded">low</span>
                              )}
                            </div>
                            {dayAssignments.length > 0 && (
                              <div className="mt-0.5">
                                <span className="text-gray-500 dark:text-gray-400">
                                  {dayAssignments.map((a) => a.user?.firstName).filter(Boolean).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
