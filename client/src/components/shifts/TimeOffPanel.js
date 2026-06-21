import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { CalendarOff, Check, X, Clock, Send } from 'lucide-react';

const TYPE_COLORS = {
  vacation: 'bg-blue-100 text-blue-700',
  sick: 'bg-red-100 text-red-700',
  personal: 'bg-purple-100 text-purple-700',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
};

export default function TimeOffPanel() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ startDate: '', endDate: '', type: 'vacation', reason: '' });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user?.role);

  const fetchRequests = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const { data } = await api.get(`/locations/${currentLocation.id}/time-off${params}`);
      setRequests(data);
    } catch {
      toast.error('Failed to load time-off requests');
    }
  }, [currentLocation, filter, toast]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/locations/${currentLocation.id}/time-off`, form);
      toast.success('Time-off request submitted');
      setShowForm(false);
      setForm({ startDate: '', endDate: '', type: 'vacation', reason: '' });
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action, reviewNotes = '') => {
    try {
      await api.post(`/locations/${currentLocation.id}/time-off/${id}/${action}`, { reviewNotes });
      toast.success(`Request ${action}d`);
      fetchRequests();
    } catch {
      toast.error(`Failed to ${action} request`);
    }
  };

  const cancelRequest = async (id) => {
    try {
      await api.delete(`/locations/${currentLocation.id}/time-off/${id}`);
      toast.success('Request cancelled');
      fetchRequests();
    } catch {
      toast.error('Failed to cancel request');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['all', 'pending', 'approved', 'denied'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
        >
          <CalendarOff className="w-3.5 h-3.5" /> Request Time Off
        </button>
      </div>

      {/* Request form */}
      {showForm && (
        <form onSubmit={submit} className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="vacation">Vacation</option>
                <option value="sick">Sick</option>
                <option value="personal">Personal</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
            <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Brief reason..." />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" /> Submit
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-200 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {/* Requests list */}
      <div className="space-y-2">
        {requests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No time-off requests found</p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                    {r.user?.firstName?.[0]}{r.user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.user?.firstName} {r.user?.lastName}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TYPE_COLORS[r.type] || ''}`}>{r.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span>
                </div>
              </div>
              {r.reason && <p className="text-xs text-gray-500 mt-2 ml-12">{r.reason}</p>}
              {r.reviewNotes && <p className="text-xs text-gray-400 mt-1 ml-12 italic">Review: {r.reviewNotes}</p>}

              {/* Actions */}
              <div className="mt-3 ml-12 flex gap-2">
                {r.status === 'pending' && isManager && r.userId !== user.id && (
                  <>
                    <button onClick={() => handleAction(r.id, 'approve')} className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100">
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => handleAction(r.id, 'deny')} className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100">
                      <X className="w-3 h-3" /> Deny
                    </button>
                  </>
                )}
                {r.status === 'pending' && r.userId === user.id && (
                  <button onClick={() => cancelRequest(r.id)} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200">
                    Cancel Request
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
