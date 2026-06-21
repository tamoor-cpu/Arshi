import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, RadialBarChart, RadialBar,
} from 'recharts';
import PrintButton from '../components/common/PrintButton';
import {
  TrendingUp, Car, DollarSign, Wrench, Package, ShieldAlert,
  Brain, GraduationCap, UserCircle, RefreshCw,
} from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

function MetricCard({ icon: Icon, label, value, subtitle, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { currentLocation } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!currentLocation) return;
    setLoading(true);
    try {
      const { data: analytics } = await api.get(`/locations/${currentLocation.id}/analytics`);
      setData(analytics);
    } catch (err) {
      console.error('Fetch analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentLocation]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (!currentLocation) return null;

  if (loading || !data) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-20" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => <div key={i} className="bg-white rounded-xl border border-gray-200 h-72" />)}
          </div>
        </div>
      </div>
    );
  }

  const weekTotal = data.carCountsByDay.reduce((s, d) => s + d.cars, 0);
  const weekRevenue = data.carCountsByDay.reduce((s, d) => s + d.revenue, 0);
  const todayCars = data.carCountsByDay[data.carCountsByDay.length - 1]?.cars || 0;

  const equipmentPieData = Object.entries(data.equipmentByStatus)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: key.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    }));

  const claimsPieData = Object.entries(data.claimsByStatus || {})
    .map(([key, value]) => ({
      name: key.replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    }));

  const tasksPieData = Object.entries(data.tasksByPriority || {})
    .map(([key, value]) => ({
      name: key.replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    }));

  const membershipData = Object.entries(data.membershipBreakdown || {})
    .map(([key, value]) => ({
      name: key.replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    }));

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">{currentLocation.name} · 7-Day Overview</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <button onClick={fetchAnalytics} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Car} label="Cars Today" value={todayCars} color="bg-blue-600" />
        <MetricCard icon={TrendingUp} label="7-Day Total" value={weekTotal} subtitle={`~$${weekRevenue.toLocaleString()} revenue`} color="bg-green-600" />
        <MetricCard icon={DollarSign} label="Maintenance Cost" value={`$${(data.totalMaintCost || 0).toLocaleString()}`} subtitle="Last 30 days" color="bg-orange-600" />
        <MetricCard icon={UserCircle} label="Total Customers" value={data.totalCustomers || 0} color="bg-purple-600" />
      </div>

      {/* Car volume chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Cars Washed - Last 7 Days</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.carCountsByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value, name) => [name === 'revenue' ? `$${value}` : value, name === 'revenue' ? 'Revenue' : 'Cars']} />
            <Area type="monotone" dataKey="cars" stroke="#3B82F6" fill="#DBEAFE" strokeWidth={2} />
            <Area type="monotone" dataKey="revenue" stroke="#10B981" fill="#D1FAE5" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Levels */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Inventory Levels</h3>
          {data.inventoryLevels.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.inventoryLevels} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="current" fill="#3B82F6" name="Current" radius={[0, 4, 4, 0]} />
                <Bar dataKey="min" fill="#EF4444" name="Minimum" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">No inventory data yet</p>
          )}
        </div>

        {/* Equipment Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Equipment Status ({data.totalEquipment})</h3>
          {equipmentPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={equipmentPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {equipmentPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">No equipment data yet</p>
          )}
        </div>

        {/* Training Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Training Completion Rate</h3>
          {data.trainingProgress.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.trainingProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="rate" fill="#8B5CF6" name="Completion %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">No training data yet</p>
          )}
        </div>

        {/* Customer Memberships */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Customer Memberships</h3>
          {membershipData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={membershipData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {membershipData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">No customer data yet</p>
          )}
        </div>
      </div>

      {/* Claims & Tasks summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Claims by Status</h3>
          {claimsPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={claimsPieData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#EF4444" name="Claims" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No claims data</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tasks by Priority</h3>
          {tasksPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tasksPieData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Tasks" radius={[4, 4, 0, 0]}>
                  {tasksPieData.map((entry, i) => {
                    const colors = { Critical: '#EF4444', High: '#F97316', Medium: '#EAB308', Low: '#3B82F6' };
                    return <Cell key={i} fill={colors[entry.name] || COLORS[i]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No task data</p>
          )}
        </div>
      </div>

      {/* AI Insights link */}
      <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-purple-900">AI-Powered Insights</h3>
          <p className="text-xs text-purple-600">Demand forecasting, predictive maintenance, staffing recommendations</p>
        </div>
        <a href="/ai-insights" className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 flex items-center gap-1.5 whitespace-nowrap">
          <Brain className="w-4 h-4" /> View AI Insights
        </a>
      </div>
    </div>
  );
}
