import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Truck, Plus, X, Search, Mail, Phone, Globe, Package, Edit2,
} from 'lucide-react';

export default function SuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', contactEmail: '', phone: '', website: '' });
  const [error, setError] = useState('');

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchSuppliers = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const { data } = await api.get('/suppliers', { params });
      setSuppliers(data);
    } catch (err) {
      console.error('Fetch suppliers error:', err);
    }
  }, [search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const saveSupplier = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api.patch(`/suppliers/${editingId}`, form);
      } else {
        await api.post('/suppliers', form);
      }
      setShowAdd(false);
      setEditingId(null);
      setForm({ name: '', contactEmail: '', phone: '', website: '' });
      fetchSuppliers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save supplier');
    }
  };

  const startEdit = (supplier) => {
    setForm({
      name: supplier.name,
      contactEmail: supplier.contactEmail || '',
      phone: supplier.phone || '',
      website: supplier.website || '',
    });
    setEditingId(supplier.id);
    setShowAdd(true);
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500">{suppliers.length} suppliers</p>
        </div>
        {isManager && (
          <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm({ name: '', contactEmail: '', phone: '', website: '' }); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Search suppliers..." />
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{editingId ? 'Edit Supplier' : 'Add Supplier'}</h3>
            <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <form onSubmit={saveSupplier} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input type="text" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://" />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">{editingId ? 'Update' : 'Add Supplier'}</button>
              <button type="button" onClick={() => { setShowAdd(false); setEditingId(null); }} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{s.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Package className="w-3 h-3" /> {s._count?.inventoryItems || 0} linked items
                  </p>
                </div>
              </div>
              {isManager && (
                <button onClick={() => startEdit(s)} className="p-1.5 hover:bg-gray-100 rounded">
                  <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
            <div className="mt-3 space-y-1.5">
              {s.contactEmail && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {s.contactEmail}
                </p>
              )}
              {s.phone && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {s.phone}
                </p>
              )}
              {s.website && (
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> {s.website}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {suppliers.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">{search ? 'No matching suppliers' : 'No suppliers yet'}</p>
        </div>
      )}
    </div>
  );
}
