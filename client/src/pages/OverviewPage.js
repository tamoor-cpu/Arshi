import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  ClipboardList, Wrench, Package, Users, CalendarDays, Sparkles, ArrowRight,
  Sun, AlertTriangle, Star, Droplets, Clock, Trophy,
} from 'lucide-react';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const CAT_ICON = { reviews: Star, tasks: ClipboardList, workOrders: Wrench };
const rankStyle = (i) => (i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-600' : 'bg-orange-100 text-orange-700');
const initials = (name) => (name || '').split(' ').map((p) => p[0]).slice(0, 2).join('');

export default function OverviewPage() {
  const { user, currentLocation } = useAuth();
  const [d, setD] = useState({ tasks: [], workOrders: [], lowStock: [], onSite: [], schedule: [], chemicals: [], reviews: [], leaderboard: [] });

  const load = useCallback(async () => {
    if (!currentLocation) return;
    const id = currentLocation.id;
    const today = new Date().toISOString().slice(0, 10);
    const g = (p) => api.get(p).then((r) => r.data).catch(() => []);
    const [tasks, workOrders, inventory, onSite, schedule, chemicals, reviews, leaderboard] = await Promise.all([
      g(`/locations/${id}/tasks?limit=200`).then((x) => x.data || x),
      g(`/locations/${id}/work-orders`),
      g(`/locations/${id}/inventory?lowStock=true`),
      g(`/locations/${id}/on-site`),
      g(`/locations/${id}/assignments?startDate=${today}&endDate=${today}`),
      g(`/locations/${id}/chemicals`),
      g(`/locations/${id}/reviews`),
      g(`/locations/${id}/leaderboard`).then((x) => x.categories || []),
    ]);
    setD({
      tasks: (Array.isArray(tasks) ? tasks : []).filter((t) => !['completed', 'cancelled'].includes(t.status)),
      workOrders: Array.isArray(workOrders) ? workOrders : [],
      lowStock: Array.isArray(inventory) ? inventory : [],
      onSite: Array.isArray(onSite) ? onSite : (onSite.onSite || []),
      schedule: Array.isArray(schedule) ? schedule : [],
      chemicals: Array.isArray(chemicals) ? chemicals : [],
      reviews: Array.isArray(reviews) ? reviews : [],
      leaderboard: Array.isArray(leaderboard) ? leaderboard : [],
    });
  }, [currentLocation]);

  useEffect(() => { load(); }, [load]);
  if (!currentLocation || !user) return null;

  const openWO = d.workOrders.filter((w) => ['open', 'in_progress'].includes(w.status));
  const unassignedWO = d.workOrders.filter((w) => w.status === 'open' && !w.assignedToId);
  const lowChem = d.chemicals.filter((c) => c.reorderPoint != null && c.currentLevel <= c.reorderPoint);
  const needsReply = d.reviews.filter((r) => !r.replied);

  const stats = [
    { label: 'Tasks due', value: d.tasks.length, icon: ClipboardList, to: '/tasks', tint: 'bg-brand-50 text-brand-600' },
    { label: 'Open work orders', value: openWO.length, icon: Wrench, to: '/work-orders', tint: 'bg-blue-50 text-blue-600' },
    { label: 'Low stock', value: d.lowStock.length + lowChem.length, icon: Package, to: '/inventory', tint: 'bg-amber-50 text-amber-600' },
    { label: 'On-site now', value: d.onSite.length, icon: Users, to: '/team', tint: 'bg-green-50 text-green-600' },
  ];

  // ARSHI suggestions — rule-based intelligence from today's data
  const suggestions = [];
  if (unassignedWO.length) suggestions.push({ text: `${unassignedWO.length} work order${unassignedWO.length > 1 ? 's' : ''} need assigning`, to: '/work-orders' });
  if (lowChem.length) suggestions.push({ text: `${lowChem.length} chemical${lowChem.length > 1 ? 's are' : ' is'} below reorder point`, to: '/chemicals' });
  if (d.lowStock.length) suggestions.push({ text: `${d.lowStock.length} inventory item${d.lowStock.length > 1 ? 's' : ''} running low`, to: '/inventory' });
  if (needsReply.length) suggestions.push({ text: `${needsReply.length} guest review${needsReply.length > 1 ? 's' : ''} await a reply`, to: '/reviews' });
  if (d.tasks.filter((t) => !t.assignedToId).length) suggestions.push({ text: `${d.tasks.filter((t) => !t.assignedToId).length} tasks are unassigned today`, to: '/tasks' });
  if (suggestions.length === 0) suggestions.push({ text: 'Everything looks on track. Nice work.', to: '/tasks' });

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-7">
        <div>
          <p className="text-sm font-semibold text-brand-600">{currentLocation.name}</p>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white mt-1">{greeting()}, {user.firstName}.</h1>
          <p className="text-gray-500 mt-1">Here's what's happening at your wash today.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-100 rounded-xl px-3.5 py-2 shadow-sm">
          <Sun className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-gray-700">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} to={s.to} className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className={`w-10 h-10 rounded-xl ${s.tint} flex items-center justify-center mb-3`}><Icon className="w-5 h-5" /></div>
              <p className="text-3xl font-black text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">{s.label} <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" /></p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ARSHI suggests */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl bg-gray-900 text-white p-5 shadow-sm h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center"><Sparkles className="w-4.5 h-4.5 text-brand-300" /></div>
              <div>
                <p className="text-sm font-bold">ARSHI Suggests</p>
                <p className="text-[11px] text-white/40">Intelligent priorities for today</p>
              </div>
            </div>
            <div className="space-y-2">
              {suggestions.slice(0, 5).map((s, i) => (
                <Link key={i} to={s.to} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2.5 transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                  <span className="text-sm text-white/85 flex-1">{s.text}</span>
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Today's schedule */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm h-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><CalendarDays className="w-4 h-4 text-brand-500" /> Today's Schedule</h2>
              <Link to="/schedule" className="text-xs font-semibold text-brand-600 hover:underline">View schedule</Link>
            </div>
            {d.schedule.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No shifts scheduled for today.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {d.schedule.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{a.user?.firstName} {a.user?.lastName}</p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {a.shift?.name} · {a.shift?.startTime}–{a.shift?.endTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* quick alerts row */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
              <Link to="/work-orders" className="text-center hover:bg-gray-50 rounded-xl py-2 transition-colors">
                <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900">{unassignedWO.length}</p>
                <p className="text-[11px] text-gray-400">Unassigned WOs</p>
              </Link>
              <Link to="/chemicals" className="text-center hover:bg-gray-50 rounded-xl py-2 transition-colors">
                <Droplets className="w-4 h-4 text-brand-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900">{lowChem.length}</p>
                <p className="text-[11px] text-gray-400">Chemicals low</p>
              </Link>
              <Link to="/reviews" className="text-center hover:bg-gray-50 rounded-xl py-2 transition-colors">
                <Star className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900">{needsReply.length}</p>
                <p className="text-[11px] text-gray-400">Reviews to reply</p>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Team Leaderboard */}
      <div className="mt-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Trophy className="w-4 h-4 text-amber-500" /> Team Leaderboard</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Recognizing your top performers</p>
            </div>
            <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 rounded-full px-2.5 py-1">Last 30 days</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {d.leaderboard.map((cat) => {
              const Icon = CAT_ICON[cat.key] || Star;
              return (
                <div key={cat.key} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 leading-tight">{cat.label}</p>
                      <p className="text-[10px] text-gray-400">{cat.sublabel}</p>
                    </div>
                  </div>
                  {(!cat.leaders || cat.leaders.length === 0) ? (
                    <p className="text-[11px] text-gray-400 py-4 text-center">No data yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {cat.leaders.slice(0, 3).map((l, i) => (
                        <div key={l.userId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${i === 0 ? 'bg-white shadow-sm border border-amber-100' : ''}`}>
                          <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${rankStyle(i)}`}>{i + 1}</span>
                          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">{initials(l.name)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-900 truncate">{l.name}</p>
                            {l.position && <p className="text-[9px] text-gray-400 truncate capitalize">{l.position}</p>}
                          </div>
                          <span className="text-xs font-black text-brand-600 shrink-0">{l.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
