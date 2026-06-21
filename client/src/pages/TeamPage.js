import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import ExportButton from '../components/ExportButton';
import EmployeeFileModal from '../components/team/EmployeeFileModal';
import DocumentTemplatesModal from '../components/documents/DocumentTemplatesModal';
import { Users, Plus, Search, Mail, Phone, MapPin, X, ChevronRight, FileSignature } from 'lucide-react';

const roleLabels = { SUPER_ADMIN: 'Super Admin', REGIONAL_ADMIN: 'Regional Admin', SITE_MANAGER: 'Site Manager', EMPLOYEE: 'Employee' };
const roleBadges = { SUPER_ADMIN: 'bg-purple-100 text-purple-700', REGIONAL_ADMIN: 'bg-blue-100 text-blue-700', SITE_MANAGER: 'bg-green-100 text-green-700', EMPLOYEE: 'bg-gray-100 text-gray-700' };

function blankUser() {
  return { email: '', password: '', firstName: '', lastName: '', phone: '', role: 'EMPLOYEE', position: '', hireDate: '', hourlyRate: '' };
}

export default function TeamPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState(blankUser());
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showDocs, setShowDocs] = useState(false);

  const canInvite = ['SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(user.role);
  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user.role);

  const fetchUsers = useCallback(async () => {
    if (!currentLocation) return;
    try {
      const { data } = await api.get('/users', {
        params: { locationId: currentLocation.id, search: search || undefined, includeArchived: showArchived ? 'true' : undefined },
      });
      setUsers(data);
    } catch { toast.error('Failed to load team members'); }
  }, [currentLocation, search, showArchived, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const addUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', { ...newUser, locationId: currentLocation.id });
      setShowAdd(false); setNewUser(blankUser()); fetchUsers();
      toast.success('Employee invited — they\'ll complete onboarding on first login');
    } catch (err) { setError(err.response?.data?.error || 'Failed to add employee'); }
  };

  if (!currentLocation) return null;

  const active = users.filter((u) => !u.archived);
  const archived = users.filter((u) => u.archived);
  const shown = showArchived ? users : active;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-team">TEAM</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mt-0.5">
            <Users className="w-6 h-6 text-team" /> Directory
          </h1>
          <p className="text-sm text-gray-500 mt-1">{active.length} active members at {currentLocation.name}</p>
        </div>
        <div className="flex gap-2">
          {isManager && <ExportButton endpoint={`/locations/${currentLocation.id}/export/team`} filename="team.csv" label="Export" />}
          {canInvite && (
            <button onClick={() => setShowDocs(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
              <FileSignature className="w-4 h-4" /> Documents &amp; Forms
            </button>
          )}
          {canInvite && (
            <button onClick={() => { setNewUser(blankUser()); setError(''); setShowAdd(!showAdd); }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
              <Plus className="w-4 h-4" /> Add / Invite
            </button>
          )}
        </div>
      </div>

      {/* Search + active/archived filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none"
            placeholder="Search by name or email..." />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setShowArchived(false)} className={`px-3 py-1.5 text-xs font-medium rounded-md ${!showArchived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Active ({active.length})</button>
          <button onClick={() => setShowArchived(true)} className={`px-3 py-1.5 text-xs font-medium rounded-md ${showArchived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Archived ({archived.length})</button>
        </div>
      </div>

      {/* Add / Invite form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900">Add / Invite Employee</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-400 mb-4">New hires are guided through onboarding paperwork & training the first time they log in.</p>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" required /></div>
            <div className="md:col-span-2 flex items-center gap-2 text-xs text-gray-500 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
              <Mail className="w-4 h-4 text-brand-500 shrink-0" /> They'll get an email to set their own password — no temporary password needed.</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Position / Title</label>
              <input value={newUser.position} onChange={(e) => setNewUser({ ...newUser, position: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" placeholder="e.g. Wash Attendant" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none">
                <option value="EMPLOYEE">Employee</option><option value="SITE_MANAGER">Site Manager</option><option value="REGIONAL_ADMIN">Regional Admin</option>
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                <input type="date" value={newUser.hireDate} onChange={(e) => setNewUser({ ...newUser, hireDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate</label>
                <input type="number" step="0.01" value={newUser.hourlyRate} onChange={(e) => setNewUser({ ...newUser, hourlyRate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 outline-none" /></div>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">Add / Invite Employee</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Team grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((member) => (
          <button key={member.id} onClick={() => isManager && setSelectedId(member.id)}
            className={`text-left bg-white rounded-xl border border-gray-200 p-5 transition-shadow ${isManager ? 'hover:shadow-md cursor-pointer' : 'cursor-default'} ${member.archived ? 'opacity-70' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {member.firstName?.[0]}{member.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{member.firstName} {member.lastName}</h3>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${roleBadges[member.role] || roleBadges.EMPLOYEE}`}>{roleLabels[member.role] || member.role}</span>
                  {member.archived && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Archived</span>}
                  {!member.archived && !member.onboardingCompletedAt && member.role === 'EMPLOYEE' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Onboarding</span>}
                </div>
                {member.position && <p className="text-xs text-gray-400 mt-1">{member.position}</p>}
              </div>
              {isManager && <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />}
            </div>
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-gray-500 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {member.email}</p>
              {member.phone && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {member.phone}</p>}
              {member.locations?.length > 0 && <p className="text-xs text-gray-500 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {member.locations.map((l) => l.name).join(', ')}</p>}
            </div>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">{search ? 'No matching team members' : showArchived ? 'No archived employees' : 'No team members at this location'}</p>
        </div>
      )}

      {/* Employee file */}
      {selectedId && (
        <EmployeeFileModal
          employeeId={selectedId}
          isManager={isManager}
          onClose={() => setSelectedId(null)}
          onChanged={fetchUsers}
        />
      )}

      {/* Document templates manager (owner) */}
      {showDocs && <DocumentTemplatesModal onClose={() => setShowDocs(false)} />}
    </div>
  );
}
