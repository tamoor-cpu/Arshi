import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LocationMultiSelect from '../components/LocationMultiSelect';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, Car, DollarSign, Wrench, Package, ShieldAlert,
  Brain, GraduationCap, Users, Trophy, RefreshCw, MapPin,
} from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#F97316'];

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

function RankingList({ title, icon: Icon, items, suffix = '' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.slice(0, 5).map((item, i) => (
          <div key={item.locationId} className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
              {i + 1}
            </span>
            <span className="flex-1 text-sm text-gray-700 truncate">{item.locationName}</span>
            <span className="text-sm font-semibold text-gray-900">{typeof item.value === 'number' && suffix === '$' ? `$${item.value.toLocaleString()}` : `${item.value}${suffix}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MultiLocationAnalyticsPage() {
  const { locations, user } = useAuth();
  const [selectedIds, setSelectedIds] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = selectedIds.length > 0 ? `?locationIds=${selectedIds.join(',')}` : '';
      const { data: result } = await api.get(`/analytics/multi-location${params}`);
      setData(result);
    } catch (err) {
      console.error('Multi-location analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!['SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(user?.role)) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">You do not have permission to view multi-location analytics.</p>
      </div>
    );
  }

  // Prepare chart data
  const comparisonData = data?.locationBreakdown?.map(l => ({
    name: l.locationName.length > 12 ? l.locationName.slice(0, 12) + '...' : l.locationName,
    cars: l.carsWeek,
    revenue: l.revenueWeek,
    claims: l.openClaims,
    tasks: l.pendingTasks,
  })) || [];

  const trendData = data?.trends?.carsByDay?.map(day => {
    const entry = { date: day.date, total: day.total };
    data.locationBreakdown?.forEach(loc => {
      entry[loc.locationName] = day.locations[loc.locationId] || 0;
    });
    return entry;
  }) || [];

  const equipmentData = data?.locationBreakdown?.map(l => ({
    name: l.locationName.length > 10 ? l.locationName.slice(0, 10) + '...' : l.locationName,
    issues: l.equipmentIssues,
    lowStock: l.lowStockCount,
  })) || [];

  const trainingData = data?.locationBreakdown?.map(l => ({
    name: l.locationName.length > 12 ? l.locationName.slice(0, 12) + '...' : l.locationName,
    compliance: l.trainingCompliance,
  })) || [];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Multi-Location Analytics</h1>
          <p className="text-sm text-gray-500">
            {data ? `${data.summary.totalLocations} locations · 7-Day Overview` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LocationMultiSelect locations={locations} selected={selectedIds} onChange={setSelectedIds} />
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : data ? (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard icon={MapPin} label="Locations" value={data.summary.totalLocations} color="bg-indigo-600" />
            <MetricCard icon={Car} label="Cars This Week" value={data.summary.totalCarsWeek.toLocaleString()} color="bg-blue-600" />
            <MetricCard icon={DollarSign} label="Est. Revenue" value={`$${data.summary.estimatedRevenueWeek.toLocaleString()}`} color="bg-green-600" />
            <MetricCard icon={Users} label="Total Team" value={data.summary.totalTeamSize} color="bg-purple-600" />
            <MetricCard icon={GraduationCap} label="Training" value={`${data.summary.overallTrainingCompliance}%`} color="bg-orange-500" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cars by Location */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Cars Washed by Location (7 Days)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="cars" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 7-Day Trends */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">7-Day Car Wash Trends</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {data.locationBreakdown?.map((loc, i) => (
                    <Line key={loc.locationId} type="monotone" dataKey={loc.locationName}
                      stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Equipment & Inventory Issues */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Issues by Location</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={equipmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="issues" name="Equipment Issues" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lowStock" name="Low Stock" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Training Compliance */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Training Compliance by Location</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trainingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="compliance" name="Compliance %" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <RankingList title="Top by Cars Washed" icon={Trophy} items={data.rankings.topByCarCount} />
            <RankingList title="Top by Revenue" icon={DollarSign} items={data.rankings.topByRevenue} suffix="$" />
            <RankingList title="Most Open Claims" icon={ShieldAlert} items={data.rankings.mostClaims} />
            <RankingList title="Best Training" icon={GraduationCap} items={data.rankings.bestTrainingCompliance} suffix="%" />
          </div>
        </>
      ) : null}
    </div>
  );
}
