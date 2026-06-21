import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import {
  Clock, ClipboardCheck, Wrench, Package, ShieldAlert, Brain, Megaphone,
  LogIn, LogOut as LogOutIcon, Zap, RefreshCw,
} from 'lucide-react';

const ACTIVITY_CONFIG = {
  clock_in: { icon: LogIn, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
  clock_out: { icon: LogOutIcon, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
  checklist: { icon: ClipboardCheck, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800' },
  maintenance: { icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800' },
  inventory: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
  claim: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
  task_complete: { icon: Brain, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800' },
  task_ai: { icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800' },
  announcement: { icon: Megaphone, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-800' },
};

function timeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ActivityFeed({ limit = 15 }) {
  const { currentLocation } = useAuth();
  const socket = useSocket();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/activity`);
      setActivities(data.slice(0, limit));
    } catch (err) {
      console.error('Activity feed error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentLocation, limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchActivity();
    socket.on('clock-event', refresh);
    socket.on('checklist-completed', refresh);
    socket.on('equipment-updated', refresh);
    socket.on('low-stock-alert', refresh);
    socket.on('new-claim', refresh);
    socket.on('task-created', refresh);
    socket.on('tasks-generated', refresh);

    return () => {
      socket.off('clock-event', refresh);
      socket.off('checklist-completed', refresh);
      socket.off('equipment-updated', refresh);
      socket.off('low-stock-alert', refresh);
      socket.off('new-claim', refresh);
      socket.off('task-created', refresh);
      socket.off('tasks-generated', refresh);
    };
  }, [socket, fetchActivity]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-3">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div className="flex-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-400 dark:text-gray-500">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, i) => {
        const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.clock_in;
        const Icon = config.icon;
        return (
          <div
            key={`${activity.type}-${activity.timestamp}-${i}`}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100">
                <span className="font-medium">{activity.actor}</span>{' '}
                <span className="text-gray-600 dark:text-gray-400">{activity.description}</span>
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {timeAgo(activity.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
      <button
        onClick={fetchActivity}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
      >
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
    </div>
  );
}
