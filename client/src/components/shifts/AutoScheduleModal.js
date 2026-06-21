import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { Wand2, AlertTriangle, Check, Loader2 } from 'lucide-react';

function getNextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function AutoScheduleModal({ onScheduleApplied }) {
  const { currentLocation } = useAuth();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(getNextMonday());
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const generatePreview = async () => {
    if (!currentLocation) return;
    setLoading(true);
    setPreview(null);
    try {
      const { data } = await api.post(`/locations/${currentLocation.id}/shifts/auto-schedule/preview`, {
        weekStartDate: weekStart,
      });
      setPreview(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate schedule preview');
    } finally {
      setLoading(false);
    }
  };

  const applySchedule = async () => {
    if (!preview || !currentLocation) return;
    setApplying(true);
    try {
      const { data } = await api.post(`/locations/${currentLocation.id}/shifts/auto-schedule/apply`, {
        assignments: preview.assignments,
      });
      toast.success(`Schedule applied: ${data.created} assignments created`);
      setPreview(null);
      if (onScheduleApplied) onScheduleApplied();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to apply schedule');
    } finally {
      setApplying(false);
    }
  };

  // Group preview assignments by date
  const byDate = preview?.assignments?.reduce((acc, a) => {
    if (!acc[a.date]) acc[a.date] = [];
    acc[a.date].push(a);
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Week Starting</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={generatePreview}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Generate Preview
        </button>
      </div>

      {/* Warnings */}
      {preview?.warnings?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm font-medium text-yellow-800 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-4 h-4" /> Staffing Warnings
          </p>
          <ul className="space-y-1">
            {preview.warnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-700">{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview table */}
      {preview && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                Preview: {preview.weekStart} to {preview.weekEnd} ({preview.assignments.length} assignments)
              </p>
              <button
                onClick={applySchedule}
                disabled={applying || preview.assignments.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Apply Schedule
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Shift</th>
                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Employee</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) =>
                    items.map((a, i) => (
                      <tr key={`${date}-${i}`} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-700">{i === 0 ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}</td>
                        <td className="px-4 py-2 text-gray-600">{a.shiftName}</td>
                        <td className="px-4 py-2 text-gray-600">{a.userName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {preview.assignments.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No assignments generated. Check if shifts and employees exist.</p>
          )}
        </>
      )}

      {!preview && !loading && (
        <div className="text-center py-8">
          <Wand2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Select a week and generate a preview</p>
          <p className="text-xs text-gray-300 mt-1">The auto-scheduler assigns employees fairly based on availability and time-off</p>
        </div>
      )}
    </div>
  );
}
