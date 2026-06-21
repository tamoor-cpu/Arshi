import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import {
  Bell,
  X,
  AlertTriangle,
  Package,
  Wrench,
  ShieldAlert,
  Brain,
  CheckCircle,
  Clock,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';

const TYPE_ICONS = {
  equipment: Wrench,
  inventory: Package,
  maintenance: Wrench,
  claim: ShieldAlert,
  task: Brain,
  training: GraduationCap,
  system: Bell,
};

const TYPE_COLORS = {
  claim: 'bg-red-100 text-red-600',
  task: 'bg-purple-100 text-purple-600',
  equipment: 'bg-yellow-100 text-yellow-600',
  inventory: 'bg-blue-100 text-blue-600',
  training: 'bg-green-100 text-green-600',
  maintenance: 'bg-orange-100 text-orange-600',
  system: 'bg-gray-100 text-gray-600',
};

function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: { limit: 15 } });
      setNotifications(data.data);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count);
    } catch (err) {
      console.error('Unread count error:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket) return;
    const handleNotification = () => {
      fetchNotifications();
      fetchUnreadCount();
    };
    socket.on('notification', handleNotification);
    // Also refresh on legacy events
    const legacyEvents = ['new-alert', 'equipment-updated', 'low-stock-alert', 'new-claim', 'task-created', 'tasks-generated'];
    legacyEvents.forEach((event) => socket.on(event, handleNotification));
    return () => {
      socket.off('notification', handleNotification);
      legacyEvents.forEach((event) => socket.off(event, handleNotification));
    };
  }, [socket, fetchNotifications, fetchUnreadCount]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  // Resolve a notification to an in-app destination (deep-link).
  const linkFor = (n) => {
    const id = n.entityId;
    switch (n.entityType) {
      case 'policy': return `/documents?policy=${id}`;
      case 'task': return '/tasks';
      case 'claim': return '/claims';
      case 'equipment': return '/equipment';
      case 'training': return '/learning';
      case 'inventory': return '/inventory';
      default: return null;
    }
  };

  const openNotification = (n) => {
    if (!n.isRead) markAsRead(n.id);
    const to = linkFor(n);
    setOpen(false);
    if (to) navigate(to);
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-blue-600 hover:text-blue-700 font-medium">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">All clear! No notifications.</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] || Bell;
                const colorClass = TYPE_COLORS[notification.type] || TYPE_COLORS.system;

                return (
                  <div
                    key={notification.id}
                    onClick={() => openNotification(notification)}
                    className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notification.isRead ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'} text-gray-900 truncate`}>
                            {notification.title}
                          </p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeAgo(notification.createdAt)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                        {!notification.isRead && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                            className="mt-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with View All */}
          <div className="px-4 py-2.5 bg-gray-50 border-t">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View All Notifications <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
