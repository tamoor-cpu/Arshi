import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { Monitor, LogIn, LogOut, Clock, MapPin, CheckCircle2 } from 'lucide-react';

export default function KioskPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [now, setNow] = useState(new Date());
  const [onSite, setOnSite] = useState([]);
  const [busy, setBusy] = useState(false);
  const [kioskMode, setKioskMode] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchOnSite = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/on-site`);
      setOnSite(Array.isArray(data) ? data : (data.onSite || []));
    } catch { /* non-critical */ }
  }, [currentLocation]);

  useEffect(() => { fetchOnSite(); const t = setInterval(fetchOnSite, 15000); return () => clearInterval(t); }, [fetchOnSite]);

  const meClockedIn = onSite.some((u) => u.id === user.id);

  const getCoords = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve({}), { timeout: 4000 }
    );
  });

  const punch = async (kind) => {
    setBusy(true);
    try {
      const coords = await getCoords();
      await api.post(`/locations/${currentLocation.id}/${kind}`, coords);
      await fetchOnSite();
      toast.success(kind === 'clock-in' ? 'Clocked in — have a great shift!' : 'Clocked out — see you next time!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record punch');
    } finally { setBusy(false); }
  };

  if (!currentLocation) return null;

  const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold tracking-wider text-team">TEAM</p>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
          <Monitor className="w-6 h-6 text-team" /> Kiosk
        </h1>
        <p className="text-sm text-gray-500 mt-1">Shared tablets your team uses to clock in with a PIN.</p>
      </div>

      {/* Sites — kiosk mode config */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Sites</h3>
        <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-team/10 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-team" /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{currentLocation.name}</p>
              <p className="text-xs text-gray-400">{kioskMode ? 'Kiosk Mode active — terminal below' : 'Enable to launch the shared clock-in terminal'}</p>
            </div>
          </div>
          <button onClick={() => setKioskMode((v) => !v)} aria-label={`Kiosk Mode for ${currentLocation.name}`}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${kioskMode ? 'bg-team' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${kioskMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {!kioskMode ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-16 text-center">
          <Monitor className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">Kiosk Mode is off</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Turn on Kiosk Mode above to launch a shared clock-in terminal staff can use on an on-site tablet.</p>
        </div>
      ) : (
      <>
      {/* Clock terminal */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 mb-6 text-center">
        <p className="text-sm text-white/50 flex items-center justify-center gap-1.5"><MapPin className="w-4 h-4" /> {currentLocation.name}</p>
        <p className="text-6xl font-bold tracking-tight mt-3 tabular-nums">{timeStr}</p>
        <p className="text-white/60 mt-1">{dateStr}</p>

        <div className="mt-8">
          <p className="text-white/70 text-sm mb-3">
            {user.firstName} {user.lastName} · <span className={meClockedIn ? 'text-green-400' : 'text-white/50'}>{meClockedIn ? 'On the clock' : 'Off the clock'}</span>
          </p>
          {meClockedIn ? (
            <button onClick={() => punch('clock-out')} disabled={busy}
              className="inline-flex items-center gap-2.5 px-10 py-5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xl font-bold rounded-2xl shadow-lg transition-colors">
              <LogOut className="w-6 h-6" /> Clock Out
            </button>
          ) : (
            <button onClick={() => punch('clock-in')} disabled={busy}
              className="inline-flex items-center gap-2.5 px-10 py-5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-xl font-bold rounded-2xl shadow-lg transition-colors">
              <LogIn className="w-6 h-6" /> Clock In
            </button>
          )}
        </div>
      </div>

      {/* On-site roster */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Clock className="w-4 h-4 text-team" /> On Site Now</h3>
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{onSite.length} active</span>
        </div>
        {onSite.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No one is clocked in right now</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {onSite.map((u) => (
              <div key={u.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {u.firstName?.[0]}{u.lastName?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{u.firstName} {u.lastName}</p>
                  <p className="text-[11px] text-gray-400">
                    Since {new Date(u.clockedInAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    {u.isWithinGeofence && <CheckCircle2 className="w-3 h-3 text-green-500 inline ml-1" />}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
