import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import ExportButton from '../components/ExportButton';
import Pagination from '../components/Pagination';
import {
  UserCircle, Plus, X, Search, Mail, Phone, Car, Calendar,
  CreditCard, ChevronRight, ArrowLeft,
} from 'lucide-react';

const membershipBadges = {
  none: 'bg-gray-100 text-gray-600',
  basic: 'bg-blue-100 text-blue-700',
  premium: 'bg-purple-100 text-purple-700',
  unlimited: 'bg-amber-100 text-amber-700',
};

const washTypes = ['basic', 'premium', 'ultimate', 'detail'];

export default function CustomersPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', membershipType: 'none', notes: '' });
  const [vehicleForm, setVehicleForm] = useState({ make: '', model: '', year: '', color: '', licensePlate: '' });
  const [visitForm, setVisitForm] = useState({ washType: 'basic', amount: '', notes: '' });
  const [error, setError] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      const params = { page, limit: 30 };
      if (search) params.search = search;
      if (memberFilter !== 'all') params.membership = memberFilter;
      const { data } = await api.get('/customers', { params });
      // Handle both paginated and flat array responses
      if (data.data) {
        setCustomers(data.data);
        setPagination(data.pagination);
      } else {
        setCustomers(data);
      }
    } catch (err) {
      toast.error('Failed to load customers');
    }
  }, [search, memberFilter, page, toast]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const fetchDetail = async (id) => {
    try {
      const { data } = await api.get(`/customers/${id}`);
      setSelectedCustomer(data);
    } catch (err) {
      toast.error('Failed to load customer details');
    }
  };

  const addCustomer = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/customers', form);
      setShowAdd(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', membershipType: 'none', notes: '' });
      fetchCustomers();
      toast.success('Customer added successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add customer');
    }
  };

  const addVehicle = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/customers/${selectedCustomer.id}/vehicles`, vehicleForm);
      setShowVehicleForm(false);
      setVehicleForm({ make: '', model: '', year: '', color: '', licensePlate: '' });
      fetchDetail(selectedCustomer.id);
      toast.success('Vehicle added');
    } catch (err) {
      toast.error('Failed to add vehicle');
    }
  };

  const logVisit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/customers/${selectedCustomer.id}/visits`, {
        locationId: currentLocation.id,
        washType: visitForm.washType,
        amount: visitForm.amount ? parseFloat(visitForm.amount) : null,
        notes: visitForm.notes || null,
      });
      setShowVisitForm(false);
      setVisitForm({ washType: 'basic', amount: '', notes: '' });
      fetchDetail(selectedCustomer.id);
      toast.success('Visit logged');
    } catch (err) {
      toast.error('Failed to log visit');
    }
  };

  // Detail view
  if (selectedCustomer) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
        <button onClick={() => setSelectedCustomer(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg">
              {selectedCustomer.firstName[0]}{selectedCustomer.lastName[0]}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{selectedCustomer.firstName} {selectedCustomer.lastName}</h1>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${membershipBadges[selectedCustomer.membershipType]}`}>
                {selectedCustomer.membershipType} member
              </span>
              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                {selectedCustomer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {selectedCustomer.email}</span>}
                {selectedCustomer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selectedCustomer.phone}</span>}
              </div>
              {selectedCustomer.notes && <p className="text-sm text-gray-500 mt-2">{selectedCustomer.notes}</p>}
            </div>
          </div>
        </div>

        {/* Vehicles */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Vehicles</h2>
            <button onClick={() => setShowVehicleForm(!showVehicleForm)} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Vehicle
            </button>
          </div>

          {showVehicleForm && (
            <form onSubmit={addVehicle} className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
              <input type="text" placeholder="Make *" value={vehicleForm.make} onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
              <input type="text" placeholder="Model *" value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
              <input type="text" placeholder="Year" value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="Color" value={vehicleForm.color} onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="text" placeholder="License Plate" value={vehicleForm.licensePlate} onChange={(e) => setVehicleForm({ ...vehicleForm, licensePlate: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Add</button>
                <button type="button" onClick={() => setShowVehicleForm(false)} className="px-3 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          )}

          {selectedCustomer.vehicles?.length > 0 ? (
            <div className="space-y-2">
              {selectedCustomer.vehicles.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Car className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{v.year} {v.make} {v.model}</p>
                    <p className="text-xs text-gray-500">{v.color}{v.licensePlate ? ` · ${v.licensePlate}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-3">No vehicles registered</p>
          )}
        </div>

        {/* Visit History */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Visit History ({selectedCustomer.visits?.length || 0})</h2>
            {currentLocation && (
              <button onClick={() => setShowVisitForm(!showVisitForm)} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Log Visit
              </button>
            )}
          </div>

          {showVisitForm && (
            <form onSubmit={logVisit} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
              <select value={visitForm.washType} onChange={(e) => setVisitForm({ ...visitForm, washType: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none capitalize">
                {washTypes.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <input type="number" step="0.01" placeholder="Amount ($)" value={visitForm.amount} onChange={(e) => setVisitForm({ ...visitForm, amount: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Log</button>
                <button type="button" onClick={() => setShowVisitForm(false)} className="px-3 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          )}

          {selectedCustomer.visits?.length > 0 ? (
            <div className="space-y-2">
              {selectedCustomer.visits.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 capitalize">{v.washType || 'Wash'} at {v.location?.name}</p>
                    <p className="text-xs text-gray-500">{new Date(v.visitDate).toLocaleDateString()}</p>
                  </div>
                  {v.amount && <span className="text-sm font-medium text-gray-700">${v.amount.toFixed(2)}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-3">No visits recorded</p>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{pagination.total || customers.length} customers</p>
        </div>
        <div className="flex gap-2">
          <ExportButton endpoint="/customers/export/customers" filename="customers.csv" label="Export" />
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Search by name, email, or phone..." />
        </div>
        <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="all">All Memberships</option>
          <option value="none">Non-Member</option>
          <option value="basic">Basic</option>
          <option value="premium">Premium</option>
          <option value="unlimited">Unlimited</option>
        </select>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Add Customer</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <form onSubmit={addCustomer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Membership</label>
              <select value={form.membershipType} onChange={(e) => setForm({ ...form, membershipType: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="none">None</option>
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Add Customer</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Customer grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c) => (
          <div key={c.id} onClick={() => fetchDetail(c.id)} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
                {c.firstName?.[0]}{c.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{c.firstName} {c.lastName}</h3>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${membershipBadges[c.membershipType]}`}>
                  {c.membershipType}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </div>
            <div className="mt-3 space-y-1">
              {c.email && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {c.email}</p>}
              {c.phone && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {c.phone}</p>}
              <div className="flex gap-3 mt-2 text-xs text-gray-400">
                <span>{c.vehicles?.length || 0} vehicles</span>
                <span>{c._count?.visits || 0} visits</span>
                {c._count?.damageClaims > 0 && <span className="text-red-500">{c._count.damageClaims} claims</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {customers.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">{search ? 'No matching customers' : 'No customers yet'}</p>
        </div>
      )}

      {pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
