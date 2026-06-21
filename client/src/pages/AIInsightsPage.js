import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import DemandForecastChart from '../components/ai/DemandForecastChart';
import EquipmentHealthList from '../components/ai/EquipmentHealthList';
import StaffingRecommendations from '../components/ai/StaffingRecommendations';
import AnomalyTimeline from '../components/ai/AnomalyTimeline';
import {
  Lightbulb,
  TrendingUp,
  Users,
  Wrench,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Package,
  Bell,
  ClipboardList,
} from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Lightbulb },
  { key: 'demand', label: 'Demand Forecast', icon: TrendingUp },
  { key: 'staffing', label: 'Staffing', icon: Users },
  { key: 'equipment', label: 'Equipment Health', icon: Wrench },
  { key: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function AIInsightsPage() {
  const { currentLocation, user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [running, setRunning] = useState(false);

  const isManager = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(user?.role);

  useEffect(() => {
    if (!currentLocation) return;
    api.get(`/locations/${currentLocation.id}/ai/summary`)
      .then(({ data }) => setSummary(data))
      .catch(() => {});
  }, [currentLocation]);

  const runAnalysis = async () => {
    if (!currentLocation) return;
    setRunning(true);
    try {
      const { data } = await api.post(`/locations/${currentLocation.id}/ai/run-analysis`);
      toast.success(`Analysis complete: ${data.maintenance} maintenance, ${data.anomalies} anomalies, ${data.forecastDays} forecast days`);
      // Refresh summary
      const { data: newSummary } = await api.get(`/locations/${currentLocation.id}/ai/summary`);
      setSummary(newSummary);
    } catch (err) {
      toast.error('Failed to run analysis');
    } finally {
      setRunning(false);
    }
  };

  if (!currentLocation) return null;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" /> AI Insights
          </h1>
          <p className="text-sm text-gray-500">Rule-based analytics and predictive heuristics</p>
        </div>
        {isManager && (
          <button
            onClick={runAnalysis}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Run Analysis
          </button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Wrench} label="Equipment at Risk" value={summary?.equipmentAtRisk ?? '—'}
              color="bg-red-100 text-red-600" />
            <StatCard icon={Bell} label="Unacknowledged Alerts" value={summary?.unacknowledgedAlerts ?? '—'}
              color="bg-yellow-100 text-yellow-600" />
            <StatCard icon={ClipboardList} label="Pending AI Tasks" value={summary?.pendingAiTasks ?? '—'}
              color="bg-blue-100 text-blue-600" />
            <StatCard icon={Package} label="Low Stock Items" value={summary?.lowStockItems ?? '—'}
              color="bg-orange-100 text-orange-600" />
          </div>

          {/* Quick views */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> 7-Day Demand Forecast
              </h3>
              <DemandForecastChart />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Recent Anomalies
              </h3>
              <AnomalyTimeline />
            </div>
          </div>
        </div>
      )}

      {/* Demand Forecast tab */}
      {activeTab === 'demand' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> 7-Day Demand Forecast
          </h3>
          <DemandForecastChart />
        </div>
      )}

      {/* Staffing tab */}
      {activeTab === 'staffing' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Smart Staffing Recommendations
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Combines demand forecast with shift requirements and time-off schedules
          </p>
          <StaffingRecommendations />
        </div>
      )}

      {/* Equipment Health tab */}
      {activeTab === 'equipment' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Equipment Health Scores
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Health scores based on MTBF analysis of maintenance history
          </p>
          <EquipmentHealthList />
        </div>
      )}

      {/* Anomalies tab */}
      {activeTab === 'anomalies' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Detected Anomalies
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Alerts from the past 7 days — equipment failures, inventory depletion, attendance irregularities
          </p>
          <AnomalyTimeline />
        </div>
      )}
    </div>
  );
}
