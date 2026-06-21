import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FileText, ChevronLeft, ChevronRight, Filter, Plus, Edit3, Trash2,
  Download, LogIn, LogOut as LogOutIcon, Shield,
} from 'lucide-react';

const ACTION_ICONS = {
  create: { icon: Plus, color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
  update: { icon: Edit3, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  delete: { icon: Trash2, color: 'text-red-600 bg-red-50 dark:bg-red-900/30' },
  export: { icon: Download, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30' },
  login: { icon: LogIn, color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
  logout: { icon: LogOutIcon, color: 'text-gray-600 bg-gray-50 dark:bg-gray-800' },
};

const ENTITY_LABELS = {
  equipment: 'Equipment',
  inventory: 'Inventory',
  task: 'Task',
  claim: 'Claim',
  customer: 'Customer',
  shift: 'Shift',
  user: 'User',
  training: 'Training',
  settings: 'Settings',
  supplier: 'Supplier',
};

export default function AuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entity: '' });

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 30 };
      if (filters.action) params.action = filters.action;
      if (filters.entity) params.entity = filters.entity;

      const { data } = await api.get('/audit', { params });
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const isAdmin = ['SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(user?.role);

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <h2 className="text-lg font-medium text-gray-600 dark:text-gray-400">Access Denied</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500">Only administrators can view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track all changes across your organization</p>
        </div>
        <div className="text-sm text-gray-400 dark:text-gray-500">{pagination.total} events</div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="export">Export</option>
          <option value="login">Login</option>
        </select>
        <select
          value={filters.entity}
          onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <option value="">All Entities</option>
          {Object.entries(ENTITY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Log entries */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No audit events found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {logs.map((log) => {
              const actionConf = ACTION_ICONS[log.action] || ACTION_ICONS.update;
              const Icon = actionConf.icon;
              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${actionConf.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      <span className="font-medium">{log.user.firstName} {log.user.lastName}</span>
                      {' '}
                      <span className="text-gray-500 dark:text-gray-400">
                        {log.action === 'create' && 'created'}
                        {log.action === 'update' && 'updated'}
                        {log.action === 'delete' && 'deleted'}
                        {log.action === 'export' && 'exported'}
                        {log.action === 'login' && 'logged in'}
                        {log.action === 'logout' && 'logged out'}
                      </span>
                      {' '}
                      <span className="font-medium">{ENTITY_LABELS[log.entity] || log.entity}</span>
                      {log.details?.name && (
                        <span className="text-gray-500 dark:text-gray-400"> "{log.details.name}"</span>
                      )}
                    </p>
                    {log.details && !log.details.name && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                        {typeof log.details === 'object' ? Object.keys(log.details).join(', ') : String(log.details)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-gray-300 dark:text-gray-600">
                      {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
