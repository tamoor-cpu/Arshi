import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import Pagination from '../components/Pagination';
import {
  Bell, CheckCheck, Wrench, Package, ShieldAlert, Brain,
  GraduationCap, Clock, AlertTriangle, Filter, Inbox,
} from 'lucide-react';

const TYPE_CONFIG = {
  claim: { icon: ShieldAlert, color: 'bg-red-100 text-red-600', label: 'Claims' },
  task: { icon: Brain, color: 'bg-purple-100 text-purple-600', label: 'Tasks' },
  equipment: { icon: Wrench, color: 'bg-yellow-100 text-yellow-600', label: 'Equipment' },
  inventory: { icon: Package, color: 'bg-blue-100 text-blue-600', label: 'Inventory' },
  training: { icon: GraduationCap, color: 'bg-green-100 text-green-600', label: 'Training' },
  maintenance: { icon: Wrench, color: 'bg-orange-100 text-orange-600', label: 'Maintenance' },
  system: { icon: Bell, color: 'bg-gray-100 text-gray-600', label: 'System' },
};

function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

const filterTabs = [
  { key: '', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'task', label: 'Tasks' },
  { key: 'claim', label: 'Claims' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'training', label: 'Training' },
];

export default function NotificationsPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 30 };
      if (filter === 'unread') params.isRead = 'false';
      const { data } = await api.get('/notifications', { params });
      let items = data.data;
      // Client-side filter by type (other than 'unread')
      if (filter && filter !== 'unread') {
        items = items.filter((n) => n.type === filter);
      }
      setNotifications(items);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.count);
    } catch (err) {
      console.error('Failed to get unread count:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Real-time notifications
  useEffect(() => {
    if (!socket) return;
    const handleNotification = () => {
      fetchNotifications();
      fetchUnreadCount();
    };
    socket.on('notification', handleNotification);
    return () => socket.off('notification', handleNotification);
  }, [socket, fetchNotifications, fetchUnreadCount]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleClick = (notification) => {
    if (!notification.isRead) markAsRead(notification.id);
    // Navigate based on entity type
    if (notification.entityType && notification.entityId) {
      const routes = {
        claim: '/claims',
        task: '/tasks',
        equipment: '/equipment',
        inventory: '/inventory',
        training: '/training',
        policy: `/documents?policy=${notification.entityId}`,
      };
      if (routes[notification.entityType]) {
        navigate(routes[notification.entityType]);
      }
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <CheckCheck className="w-4 h-4" /> Mark All Read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap bg-gray-100 p-1 rounded-lg w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === tab.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No notifications</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter ? 'Try a different filter' : 'You\'re all caught up!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;
              const Icon = config.icon;
              return (
                <div
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={`flex gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-gray-400">{timeAgo(notification.createdAt)}</span>
                        {!notification.isRead && (
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${config.color}`}>
                        {config.label}
                      </span>
                      {!notification.isRead && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Pagination pagination={pagination} onPageChange={setPage} />
      )}
    </div>
  );
}
