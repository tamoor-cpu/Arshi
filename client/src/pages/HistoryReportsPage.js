import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  History, Bell, AlertTriangle, MessageSquareWarning, Clock, ShieldCheck,
  Star, GraduationCap, CalendarClock, PencilLine, FileEdit, Save,
} from 'lucide-react';

// Notifications that use a frequency segmented control
const FREQUENCY_ROWS = [
  { key: 'daily_summary', icon: Bell, title: 'Daily Summary', desc: 'Morning overview of tasks & metrics', options: ['on', 'off'], schedule: 'Tomorrow 8:00 PM' },
  { key: 'equipment_offline', icon: AlertTriangle, title: 'Equipment Offline', desc: 'Alert when equipment goes offline', options: ['instant', 'daily', 'off'], schedule: 'Immediately when detected' },
  { key: 'new_complaints', icon: MessageSquareWarning, title: 'New Complaints', desc: 'Customer complaint notifications', options: ['instant', 'daily', 'off'], schedule: 'Immediately when detected' },
  { key: 'timesheet_audit', icon: Clock, title: 'Timesheet Audit', desc: 'Long shifts & missing clock-outs', options: ['instant', 'daily', 'off'], schedule: 'Tomorrow 6:00 AM' },
  { key: 'compliance_alerts', icon: ShieldCheck, title: 'Compliance Alerts', desc: 'Overtime & break compliance', options: ['instant', 'weekly', 'off'], schedule: 'Mon 8:00 AM' },
  { key: 'google_reviews', icon: Star, title: 'Google Reviews', desc: 'New reviews & rating changes', options: ['daily', 'weekly', 'off'], schedule: 'Tomorrow 6:00 AM' },
];

// Notifications that are a simple on/off toggle
const TOGGLE_ROWS = [
  { key: 'training_assigned', icon: GraduationCap, title: 'New Training Assigned', desc: 'Notify me when a new training is assigned' },
  { key: 'training_deadline', icon: CalendarClock, title: 'Training Deadline Reminder', desc: 'Remind me 3 days before a training is due' },
  { key: 'time_corrections', icon: PencilLine, title: 'Time Corrections to Review', desc: 'Notify me when an employee submits a time correction' },
  { key: 'timesheet_requests', icon: FileEdit, title: 'Timesheet Correction Requests', desc: 'Notify me when a manager asks me to revise an entry' },
];

const optionLabel = { instant: 'Instant', daily: 'Daily', weekly: 'Weekly', off: 'Off', on: 'On' };

const DEFAULTS = {
  daily_summary: 'on', equipment_offline: 'instant', new_complaints: 'instant',
  timesheet_audit: 'daily', compliance_alerts: 'weekly', google_reviews: 'daily',
  training_assigned: true, training_deadline: true, time_corrections: true, timesheet_requests: true,
};

export default function HistoryReportsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const storageKey = `washops-notify-prefs-${user?.id || 'me'}`;
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved) setPrefs({ ...DEFAULTS, ...saved });
    } catch { /* ignore */ }
  }, [storageKey]);

  const setFreq = (key, value) => { setPrefs((p) => ({ ...p, [key]: value })); setDirty(true); };
  const toggle = (key) => { setPrefs((p) => ({ ...p, [key]: !p[key] })); setDirty(true); };

  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
    setDirty(false);
    toast.success('Notification preferences saved');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-team">TEAM</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <History className="w-6 h-6 text-team" /> History &amp; Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">Control how and when you receive alerts</p>
        </div>
        <button onClick={save} disabled={!dirty}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50">
          <Save className="w-4 h-4" /> Save
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
            <Bell className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Email Notifications</p>
            <p className="text-xs text-gray-400">Control how and when you receive alerts</p>
          </div>
        </div>

        {/* Frequency rows */}
        {FREQUENCY_ROWS.map((row) => {
          const Icon = row.icon;
          const current = prefs[row.key] ?? row.options[0];
          return (
            <div key={row.key} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50">
              <Icon className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{row.title}</p>
                <p className="text-xs text-gray-400">{row.desc}</p>
                {current !== 'off' && (
                  <p className="text-[11px] text-brand-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {row.schedule}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 shrink-0">
                {row.options.map((opt) => (
                  <button key={opt} onClick={() => setFreq(row.key, opt)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      current === opt ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {optionLabel[opt]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Toggle rows */}
        {TOGGLE_ROWS.map((row, i) => {
          const Icon = row.icon;
          const on = !!prefs[row.key];
          return (
            <div key={row.key} className={`flex items-center gap-3 px-5 py-3.5 ${i < TOGGLE_ROWS.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <Icon className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{row.title}</p>
                <p className="text-xs text-gray-400">{row.desc}</p>
              </div>
              <button onClick={() => toggle(row.key)}
                className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-brand-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
