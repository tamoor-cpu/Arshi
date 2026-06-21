import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import ShiftCalendar from '../components/ShiftCalendar';
import TimeOffPanel from '../components/shifts/TimeOffPanel';
import TimeOffCalendar from '../components/shifts/TimeOffCalendar';
import AutoScheduleModal from '../components/shifts/AutoScheduleModal';
import LaborCostCard from '../components/shifts/LaborCostCard';
import PrintButton from '../components/common/PrintButton';
import {
  Clock,
  Plus,
  MapPin,
  CheckCircle2,
  XCircle,
  Users,
  Calendar,
  CalendarOff,
  Wand2,
  DollarSign,
} from 'lucide-react';

function ClockInButton({ locationId, onClockEvent }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    api.get(`/locations/${locationId}/clock-events`).then(({ data }) => {
      if (data.length > 0) {
        setStatus(data[0].eventType === 'clock_in' ? 'in' : 'out');
      }
    });
  }, [locationId]);

  const handleClock = async () => {
    setLoading(true);
    setGeoError('');
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const endpoint = status === 'in' ? 'clock-out' : 'clock-in';
      const { data } = await api.post(`/locations/${locationId}/${endpoint}`, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });

      setStatus(endpoint === 'clock-in' ? 'in' : 'out');
      if (onClockEvent) onClockEvent(data);
    } catch (err) {
      if (err.code) {
        setGeoError('Location access required for clock-in');
      } else {
        setGeoError(err.response?.data?.error || 'Clock operation failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="text-center">
        <button
          onClick={handleClock}
          disabled={loading}
          className={`w-32 h-32 rounded-full text-white font-bold text-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
            status === 'in'
              ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
              : 'bg-green-500 hover:bg-green-600 shadow-green-200'
          }`}
        >
          {loading ? (
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          ) : status === 'in' ? 'Clock Out' : 'Clock In'}
        </button>
        <p className="mt-3 text-sm text-gray-500">
          {status === 'in' ? 'You are currently clocked in' : 'Tap to clock in'}
        </p>
        {geoError && (
          <p className="mt-2 text-xs text-red-500 flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3" /> {geoError}
          </p>
        )}
      </div>
    </div>
  );
}

function OnSiteTeam({ locationId }) {
  const [onSite, setOnSite] = useState([]);

  useEffect(() => {
    api.get(`/locations/${locationId}/on-site`).then(({ data }) => setOnSite(data));
    const interval = setInterval(() => {
      api.get(`/locations/${locationId}/on-site`).then(({ data }) => setOnSite(data));
    }, 30000);
    return () => clearInterval(interval);
  }, [locationId]);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4" /> On-Site Now
        </h3>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          {onSite.length} active
        </span>
      </div>
      <div className="p-4 space-y-2">
        {onSite.length > 0 ? (
          onSite.map((person) => (
            <div key={person.id} className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700">
                {person.firstName?.[0]}{person.lastName?.[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{person.firstName} {person.lastName}</p>
                <p className="text-xs text-gray-400">{person.role?.replace('_', ' ')}</p>
              </div>
              {person.isWithinGeofence ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-orange-500" />
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No one on-site yet</p>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'timeoff', label: 'Time Off', icon: CalendarOff },
  { key: 'auto', label: 'Auto-Schedule', icon: Wand2, managerOnly: true },
  { key: 'labor', label: 'Labor Costs', icon: DollarSign, managerOnly: true },
];

export default function ShiftsPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [newShift, setNewShift] = useState({ name: '', startTime: '07:00', endTime: '15:00', minStaff: 1, maxStaff: '', breakMinutes: 0 });
  const [activeTab, setActiveTab] = useState('schedule');

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user?.role);
  const visibleTabs = TABS.filter((t) => !t.managerOnly || isManager);

  const fetchShifts = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/shifts`);
      setShifts(data);
    } catch (err) {
      toast.error('Failed to load shifts');
    }
  }, [currentLocation, toast]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const createShift = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newShift.name,
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        minStaff: parseInt(newShift.minStaff) || 1,
        breakMinutes: parseInt(newShift.breakMinutes) || 0,
      };
      if (newShift.maxStaff) payload.maxStaff = parseInt(newShift.maxStaff);
      await api.post(`/locations/${currentLocation.id}/shifts`, payload);
      setShowCreateShift(false);
      setNewShift({ name: '', startTime: '07:00', endTime: '15:00', minStaff: 1, maxStaff: '', breakMinutes: 0 });
      fetchShifts();
      toast.success('Shift created successfully');
    } catch (err) {
      toast.error('Failed to create shift');
    }
  };

  if (!currentLocation) return null;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-team">TEAM</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <Clock className="w-6 h-6 text-team" /> Time Clock
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage schedules and track who's on-site</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          {isManager && activeTab === 'schedule' && (
            <button
              onClick={() => setShowCreateShift(!showCreateShift)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600"
            >
              <Plus className="w-4 h-4" /> New Shift
            </button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Schedule tab */}
      {activeTab === 'schedule' && (
        <>
          {showCreateShift && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Create New Shift</h3>
              <form onSubmit={createShift} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shift Name</label>
                  <input type="text" value={newShift.name} onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 outline-none text-sm"
                    placeholder="e.g. Morning, Afternoon" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" value={newShift.startTime} onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input type="time" value={newShift.endTime} onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Staff</label>
                  <input type="number" min="1" value={newShift.minStaff} onChange={(e) => setNewShift({ ...newShift, minStaff: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Staff (optional)</label>
                  <input type="number" min="1" value={newShift.maxStaff} onChange={(e) => setNewShift({ ...newShift, maxStaff: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 outline-none text-sm" placeholder="No limit" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Break (minutes)</label>
                  <input type="number" min="0" value={newShift.breakMinutes} onChange={(e) => setNewShift({ ...newShift, breakMinutes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-400 outline-none text-sm" />
                </div>
                <div className="md:col-span-3 flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">Create Shift</button>
                  <button type="button" onClick={() => setShowCreateShift(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ClockInButton locationId={currentLocation.id} />
            <div className="lg:col-span-2">
              <OnSiteTeam locationId={currentLocation.id} />
            </div>
          </div>

          <ShiftCalendar shifts={shifts} assignments={assignments} />

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Shift Templates
              </h3>
            </div>
            <div className="p-4">
              {shifts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {shifts.map((shift) => (
                    <div key={shift.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                      style={{ borderLeftWidth: 4, borderLeftColor: shift.color }}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{shift.name}</h4>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {shift.assignments?.length || 0} assigned
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {shift.startTime} - {shift.endTime}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-400">
                          {(shift.daysOfWeek || '').split(',').map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseInt(d)]).filter(Boolean).join(', ')}
                        </p>
                        <span className="text-xs text-gray-400">|</span>
                        <p className="text-xs text-gray-400">
                          Staff: {shift.minStaff || 1}{shift.maxStaff ? `-${shift.maxStaff}` : '+'}
                        </p>
                        {shift.breakMinutes > 0 && (
                          <>
                            <span className="text-xs text-gray-400">|</span>
                            <p className="text-xs text-gray-400">{shift.breakMinutes}m break</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No shifts created yet</p>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'timeoff' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarOff className="w-4 h-4" /> Time Off Requests
              </h3>
              <TimeOffPanel />
            </div>
          </div>
          <div>
            <TimeOffCalendar />
          </div>
        </div>
      )}

      {activeTab === 'auto' && isManager && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wand2 className="w-4 h-4" /> Auto-Schedule
          </h3>
          <AutoScheduleModal onScheduleApplied={fetchShifts} />
        </div>
      )}

      {activeTab === 'labor' && isManager && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Labor Cost Summary
          </h3>
          <LaborCostCard />
        </div>
      )}
    </div>
  );
}
