import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import {
  FileBarChart, Plus, X, Play, Download, Trash2, Clock,
  CheckCircle2, AlertTriangle, Calendar, Mail, Settings2, ToggleLeft, ToggleRight,
} from 'lucide-react';

const REPORT_TYPES = [
  { value: 'operations_summary', label: 'Operations Summary', color: 'bg-blue-100 text-blue-700' },
  { value: 'inventory', label: 'Inventory Report', color: 'bg-green-100 text-green-700' },
  { value: 'equipment_health', label: 'Equipment Health', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'training_compliance', label: 'Training Compliance', color: 'bg-purple-100 text-purple-700' },
];

const FREQUENCIES = [
  { value: 'manual', label: 'Manual Only', cron: null },
  { value: 'daily', label: 'Daily (6 AM)', cron: '0 6 * * *' },
  { value: 'weekly', label: 'Weekly (Monday 6 AM)', cron: '0 6 * * 1' },
  { value: 'monthly', label: 'Monthly (1st at 6 AM)', cron: '0 6 1 * *' },
];

const STATUS_BADGES = {
  completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  generating: { color: 'bg-blue-100 text-blue-700', icon: Clock },
  failed: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  pending: { color: 'bg-gray-100 text-gray-600', icon: Clock },
};

function timeAgo(date) {
  if (!date) return 'Never';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBytes(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReportsPage() {
  const { currentLocation, locations, user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('scheduled');
  const [reports, setReports] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', reportType: 'operations_summary', frequency: 'manual', locationId: '', recipients: '',
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports');
      setReports(data);
    } catch (err) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAllRuns = useCallback(async () => {
    try {
      const allRuns = [];
      for (const report of reports) {
        const { data } = await api.get(`/reports/${report.id}/runs`, { params: { limit: 10 } });
        allRuns.push(...data.data.map(r => ({ ...r, reportName: report.name, reportType: report.reportType })));
      }
      allRuns.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
      setRuns(allRuns);
    } catch (err) {
      console.error('Failed to load runs:', err);
    }
  }, [reports]);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { if (reports.length > 0) fetchAllRuns(); }, [reports, fetchAllRuns]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const freq = FREQUENCIES.find(f => f.value === form.frequency);
      const payload = {
        name: form.name,
        reportType: form.reportType,
        frequency: form.frequency,
        cronExpression: freq?.cron || null,
        locationId: form.locationId || null,
        recipients: form.recipients ? form.recipients.split(',').map(s => s.trim()).filter(Boolean) : [],
      };

      if (editingId) {
        await api.patch(`/reports/${editingId}`, payload);
        toast.success('Report updated');
      } else {
        await api.post('/reports', payload);
        toast.success('Report created');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', reportType: 'operations_summary', frequency: 'manual', locationId: '', recipients: '' });
      fetchReports();
    } catch (err) {
      toast.error('Failed to save report');
    }
  };

  const handleEdit = (report) => {
    setEditingId(report.id);
    setForm({
      name: report.name,
      reportType: report.reportType,
      frequency: report.frequency,
      locationId: report.locationId || '',
      recipients: JSON.parse(report.recipients || '[]').join(', '),
    });
    setShowForm(true);
  };

  const handleGenerate = async (reportId) => {
    setGenerating(reportId);
    try {
      await api.post(`/reports/${reportId}/generate`);
      toast.success('Report generated! Check the History tab to download.');
      fetchReports();
      fetchAllRuns();
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const handleDelete = async (reportId) => {
    try {
      await api.delete(`/reports/${reportId}`);
      toast.success('Report deleted');
      fetchReports();
    } catch (err) {
      toast.error('Failed to delete report');
    }
  };

  const handleToggle = async (report) => {
    try {
      await api.patch(`/reports/${report.id}`, { isActive: !report.isActive });
      fetchReports();
    } catch (err) {
      toast.error('Failed to toggle report');
    }
  };

  const handleDownload = async (runId, reportName) => {
    try {
      const response = await api.get(`/reports/runs/${runId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportName || 'report'}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download report');
    }
  };

  if (!currentLocation) return null;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Schedule and generate PDF reports</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', reportType: 'operations_summary', frequency: 'manual', locationId: '', recipients: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Report
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[{ key: 'scheduled', label: 'Scheduled Reports' }, { key: 'history', label: 'Report History' }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Report' : 'New Report'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Weekly Operations Summary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
              <select value={form.reportType} onChange={e => setForm({ ...form, reportType: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">All Locations</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Recipients (comma-separated)</label>
              <input value={form.recipients} onChange={e => setForm({ ...form, recipients: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="manager@example.com, owner@example.com" />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                {editingId ? 'Update Report' : 'Create Report'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Scheduled Reports Tab */}
      {activeTab === 'scheduled' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <FileBarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No reports configured</p>
              <p className="text-sm text-gray-400 mt-1">Create a report to generate PDF summaries</p>
            </div>
          ) : (
            reports.map(report => {
              const typeConfig = REPORT_TYPES.find(t => t.value === report.reportType) || REPORT_TYPES[0];
              const lastRun = report.runs?.[0];
              return (
                <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <FileBarChart className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{report.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${typeConfig.color}`}>{typeConfig.label}</span>
                          <span className="text-xs text-gray-400">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {report.frequency === 'manual' ? 'Manual' : report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1)}
                          </span>
                          {JSON.parse(report.recipients || '[]').length > 0 && (
                            <span className="text-xs text-gray-400"><Mail className="w-3 h-3 inline mr-1" />{JSON.parse(report.recipients).length} recipient(s)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lastRun && (
                        <span className="text-xs text-gray-400">Last: {timeAgo(lastRun.generatedAt)}</span>
                      )}
                      <button onClick={() => handleToggle(report)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={report.isActive ? 'Disable' : 'Enable'}>
                        {report.isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                      </button>
                      <button onClick={() => handleGenerate(report.id)} disabled={generating === report.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                        <Play className="w-3.5 h-3.5" /> {generating === report.id ? 'Generating...' : 'Generate Now'}
                      </button>
                      <button onClick={() => handleEdit(report)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <Settings2 className="w-4 h-4 text-gray-400" />
                      </button>
                      <button onClick={() => handleDelete(report.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Report History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {runs.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No reports generated yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Report</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Generated</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map(run => {
                  const statusConf = STATUS_BADGES[run.status] || STATUS_BADGES.pending;
                  const StatusIcon = statusConf.icon;
                  return (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{run.reportName}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-500">{run.reportType?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">{new Date(run.generatedAt).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${statusConf.color}`}>
                          <StatusIcon className="w-3 h-3" /> {run.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">{formatBytes(run.fileSize)}</td>
                      <td className="px-5 py-3 text-right">
                        {run.status === 'completed' && run.filePath && (
                          <button onClick={() => handleDownload(run.id, run.reportName)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                        )}
                        {run.status === 'failed' && (
                          <span className="text-xs text-red-500">{run.errorMessage?.slice(0, 50)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
