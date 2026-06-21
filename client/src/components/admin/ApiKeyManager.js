import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { Key, Plus, Copy, Check, XCircle, Loader2 } from 'lucide-react';

export default function ApiKeyManager() {
  const toast = useToast();
  const [keys, setKeys] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', expiresAt: '' });
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const { data } = await api.get('/api-keys');
      setKeys(data);
    } catch {
      // silently fail — user may not have admin access
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name: newKey.name };
      if (newKey.expiresAt) payload.expiresAt = newKey.expiresAt;
      const { data } = await api.post('/api-keys', payload);
      setGeneratedKey(data.key);
      setShowCreate(false);
      setNewKey({ name: '', expiresAt: '' });
      fetchKeys();
      toast.success('API key created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const toggleKey = async (id, isActive) => {
    try {
      await api.patch(`/api-keys/${id}`, { isActive: !isActive });
      fetchKeys();
      toast.success(isActive ? 'Key deactivated' : 'Key activated');
    } catch {
      toast.error('Failed to update key');
    }
  };

  const revokeKey = async (id) => {
    try {
      await api.delete(`/api-keys/${id}`);
      fetchKeys();
      toast.success('API key revoked');
    } catch {
      toast.error('Failed to revoke key');
    }
  };

  const copyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Generated key display */}
      {generatedKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-800 mb-2">New API Key (save this now — it won't be shown again)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-3 py-2 rounded border border-green-300 text-sm font-mono text-green-900 break-all">
              {generatedKey}
            </code>
            <button onClick={copyToClipboard} className="p-2 hover:bg-green-100 rounded-lg">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-green-600" />}
            </button>
          </div>
          <button onClick={() => setGeneratedKey(null)} className="mt-2 text-xs text-green-600 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" /> Generate API Key
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={createKey} className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Key Name</label>
              <input type="text" required value={newKey.name} onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Production Integration" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expires At (optional)</label>
              <input type="date" value={newKey.expiresAt} onChange={(e) => setNewKey({ ...newKey, expiresAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />} Generate
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-200 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      {/* Keys table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Prefix</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Last Used</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Expires</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400">No API keys created yet</td></tr>
            ) : (
              keys.map((k) => (
                <tr key={k.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-700">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{k.prefix}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleKey(k.id, k.isActive)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${k.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {k.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => revokeKey(k.id)}
                      className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
