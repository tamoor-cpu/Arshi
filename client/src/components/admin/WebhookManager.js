import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { Webhook, Plus, Send, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const AVAILABLE_EVENTS = [
  '*', 'time_off.create', 'time_off.approve', 'time_off.deny',
  'auto_schedule.create', 'equipment.create', 'equipment.update',
  'incident.create', 'inventory.create', 'inventory.update',
  'shift.create', 'shift.update', 'task.create', 'task.update',
];

export default function WebhookManager() {
  const toast = useToast();
  const [webhooks, setWebhooks] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ url: '', events: ['*'], description: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [deliveries, setDeliveries] = useState({});
  const [testing, setTesting] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const { data } = await api.get('/webhooks');
      setWebhooks(data);
    } catch {
      // silently fail — user may not have admin access
    }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const createWebhook = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/webhooks', form);
      setShowCreate(false);
      setForm({ url: '', events: ['*'], description: '' });
      fetchWebhooks();
      toast.success('Webhook created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create webhook');
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async (id) => {
    try {
      await api.delete(`/webhooks/${id}`);
      fetchWebhooks();
      toast.success('Webhook deleted');
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  const testWebhook = async (id) => {
    setTesting(id);
    try {
      const { data } = await api.post(`/webhooks/${id}/test`);
      if (data.success) {
        toast.success(`Test ping sent — Status ${data.statusCode}`);
      } else {
        toast.error(`Test failed: ${data.error || `Status ${data.statusCode}`}`);
      }
    } catch {
      toast.error('Test request failed');
    } finally {
      setTesting(null);
    }
  };

  const toggleDeliveries = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!deliveries[id]) {
      try {
        const { data } = await api.get(`/webhooks/${id}/deliveries`);
        setDeliveries((prev) => ({ ...prev, [id]: data.data }));
      } catch {
        toast.error('Failed to load deliveries');
      }
    }
  };

  const toggleEvent = (event) => {
    setForm((prev) => {
      const has = prev.events.includes(event);
      if (event === '*') return { ...prev, events: has ? [] : ['*'] };
      const filtered = prev.events.filter((e) => e !== '*' && e !== event);
      if (!has) filtered.push(event);
      return { ...prev, events: filtered };
    });
  };

  const toggleActive = async (id, isActive) => {
    try {
      await api.patch(`/webhooks/${id}`, { isActive: !isActive });
      fetchWebhooks();
    } catch {
      toast.error('Failed to update webhook');
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" /> Add Webhook
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={createWebhook} className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Endpoint URL</label>
            <input type="url" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="https://example.com/webhook" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Optional description" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Events</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <button key={event} type="button" onClick={() => toggleEvent(event)}
                  className={`px-2 py-1 text-xs rounded-md border ${
                    form.events.includes(event)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {event === '*' ? 'All Events' : event}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Webhook className="w-3.5 h-3.5" />} Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-200 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {/* Webhooks list */}
      {webhooks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No webhooks configured</p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{wh.url}</p>
                    {wh.description && <p className="text-xs text-gray-500 mt-0.5">{wh.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(wh.events || []).map((ev, i) => (
                        <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {ev === '*' ? 'All Events' : ev}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button onClick={() => toggleActive(wh.id, wh.isActive)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${wh.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {wh.isActive ? 'Active' : 'Paused'}
                    </button>
                    <button onClick={() => testWebhook(wh.id)} disabled={testing === wh.id}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Send test ping">
                      {testing === wh.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteWebhook(wh.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Last delivery: {wh.lastDeliveryAt ? new Date(wh.lastDeliveryAt).toLocaleString() : 'Never'}
                  </p>
                  <button onClick={() => toggleDeliveries(wh.id)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                    Deliveries {expandedId === wh.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Delivery log */}
              {expandedId === wh.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-3 max-h-64 overflow-y-auto">
                  {!deliveries[wh.id] || deliveries[wh.id].length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">No deliveries yet</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="pb-1">Event</th>
                          <th className="pb-1">Status</th>
                          <th className="pb-1">Attempts</th>
                          <th className="pb-1">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries[wh.id].map((d) => (
                          <tr key={d.id} className="border-t border-gray-200">
                            <td className="py-1.5 text-gray-700">{d.event}</td>
                            <td className="py-1.5">
                              <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                                d.statusCode >= 200 && d.statusCode < 300 ? 'bg-green-100 text-green-700' :
                                d.statusCode > 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {d.statusCode || 'pending'}
                              </span>
                            </td>
                            <td className="py-1.5 text-gray-500">{d.attemptCount}</td>
                            <td className="py-1.5 text-gray-400">{new Date(d.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
