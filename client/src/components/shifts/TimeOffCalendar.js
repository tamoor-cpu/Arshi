import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TYPE_COLORS = {
  vacation: '#3B82F6',
  sick: '#EF4444',
  personal: '#8B5CF6',
};

export default function TimeOffCalendar() {
  const { currentLocation } = useAuth();
  const [month, setMonth] = useState(new Date());
  const [approvedOff, setApprovedOff] = useState([]);

  useEffect(() => {
    if (!currentLocation) return;
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    api.get(`/locations/${currentLocation.id}/time-off/calendar`, {
      params: { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) },
    }).then(({ data }) => setApprovedOff(data)).catch(() => {});
  }, [currentLocation, month]);

  const daysInMonth = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return cells;
  }, [month]);

  // Build lookup: day -> people off
  const offByDay = useMemo(() => {
    const map = {};
    for (const req of approvedOff) {
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      const d = new Date(start);
      while (d <= end) {
        if (d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()) {
          const key = d.getDate();
          if (!map[key]) map[key] = [];
          map[key].push(req);
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [approvedOff, month]);

  const prevMonth = () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const nextMonth = () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  const today = new Date();
  const isCurrentMonth = today.getMonth() === month.getMonth() && today.getFullYear() === month.getFullYear();

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
          <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
        </div>
      </div>

      <div className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-xs font-medium text-gray-400 text-center py-1">{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {daysInMonth.map((day, i) => {
            if (!day) return <div key={i} />;
            const isToday = isCurrentMonth && day === today.getDate();
            const off = offByDay[day] || [];

            return (
              <div key={i} className={`min-h-[64px] rounded-lg p-1 ${isToday ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}>
                <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{day}</span>
                <div className="mt-0.5 space-y-0.5">
                  {off.slice(0, 3).map((r, j) => (
                    <div key={j} className="flex items-center gap-1 text-[10px]" title={`${r.user?.firstName} ${r.user?.lastName} - ${r.type}`}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[r.type] || '#6B7280' }} />
                      <span className="truncate text-gray-600">{r.user?.firstName}</span>
                    </div>
                  ))}
                  {off.length > 3 && <span className="text-[10px] text-gray-400">+{off.length - 3} more</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-gray-500 capitalize">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} /> {type}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
