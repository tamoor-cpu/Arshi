import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ActivityFeed from '../components/ActivityFeed';
import {
  Car, Users, AlertTriangle, ClipboardCheck, MessageSquare,
  Bell, CheckCircle2, XCircle, Clock as ClockIcon, MapPin, Zap,
  Wrench, Package, Brain, ShieldAlert, UserCircle, GraduationCap,
  TrendingUp, ArrowRight, ArrowUp, ArrowDown, Activity,
  Settings, BarChart3, Building2, DollarSign, RefreshCw, Check,
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, subtext, color, iconBg, to }) {
  const content = (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${iconBg || 'bg-blue-50 dark:bg-blue-900/20'}`}>
          <Icon className={`w-5 h-5 ${color || 'text-blue-600'}`} />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function AlertItem({ alert, onAcknowledge }) {
  const severityStyles = {
    critical: 'border-red-400 bg-red-50 dark:bg-red-900/20',
    high: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
    medium: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    low: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  };
  const severityIcons = {
    critical: <XCircle className="w-5 h-5 text-red-500" />,
    high: <AlertTriangle className="w-5 h-5 text-orange-500" />,
    medium: <Bell className="w-5 h-5 text-yellow-600" />,
    low: <Zap className="w-5 h-5 text-blue-500" />,
  };

  return (
    <div className={`border-l-4 rounded-r-lg p-3 ${severityStyles[alert.severity] || severityStyles.low}`}>
      <div className="flex items-start gap-2">
        {severityIcons[alert.severity]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{alert.title}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{alert.message}</p>
        </div>
        <button onClick={() => onAcknowledge(alert.id)} className="shrink-0 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 hover:bg-white dark:hover:bg-gray-700 rounded">
          Dismiss
        </button>
      </div>
    </div>
  );
}

const priorityColors = {
  critical: 'text-red-600 bg-red-50 dark:bg-red-900/30',
  high: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30',
  medium: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30',
  low: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
};

// Employee Dashboard — focused personal view
function EmployeeDashboard({ dashboard, acknowledgeAlert }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Car} label="Cars Washed Today" value={dashboard?.carCount || 0}
          color="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard icon={ClipboardCheck} label="Checklists Today"
          value={`${dashboard?.checklists?.filter((c) => c.status === 'completed').length || 0} / ${dashboard?.checklists?.length || 0}`}
          subtext="Completed" color="text-purple-600" iconBg="bg-purple-50 dark:bg-purple-900/20" to="/checklists" />
        <StatCard icon={Brain} label="My Tasks" value={dashboard?.pendingTaskCount || 0}
          subtext="Pending" color="text-indigo-600" iconBg="bg-indigo-50 dark:bg-indigo-900/20" to="/tasks" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">My Tasks</h3>
            <Link to="/tasks" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-2">
            {dashboard?.pendingTasks?.length > 0 ? (
              dashboard.pendingTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority] || ''}`}>
                    {task.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{task.category}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">All caught up!</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Training Progress</h3>
            <Link to="/training" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {dashboard?.trainingStats ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Modules Complete</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{dashboard.trainingStats.completed || 0} / {dashboard.trainingStats.totalModules || 0}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${dashboard.trainingStats.totalModules ? (dashboard.trainingStats.completed / dashboard.trainingStats.totalModules * 100) : 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No training data</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Today's Checklists</h3>
        </div>
        <div className="p-4">
          {dashboard?.checklists?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dashboard.checklists.map((cl) => (
                <div key={cl.id} className={`flex items-center gap-3 p-3 rounded-lg border ${cl.status === 'completed' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'}`}>
                  {cl.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  ) : (
                    <ClockIcon className="w-5 h-5 text-yellow-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{cl.templateName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{cl.completedBy}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No checklists started today</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        </div>
        <div className="p-2">
          <ActivityFeed limit={10} />
        </div>
      </div>
    </>
  );
}

// Manager Dashboard — full operations view with widget customization
function ManagerDashboard({ dashboard, acknowledgeAlert, hiddenWidgets = [] }) {
  const h = (key) => hiddenWidgets.includes(key);

  return (
    <>
      {!h('primary_stats') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Car} label="Cars Washed Today" value={dashboard?.carCount || 0}
            subtext={`~$${((dashboard?.carCount || 0) * 15).toLocaleString()} revenue`}
            color="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard icon={Users} label="Team On-Site" value={`${dashboard?.onSiteCount || 0} / ${dashboard?.totalTeam || 0}`}
            subtext="Currently clocked in" color="text-green-600" iconBg="bg-green-50 dark:bg-green-900/20" />
          <StatCard icon={ClipboardCheck} label="Checklists Today"
            value={`${dashboard?.checklists?.filter((c) => c.status === 'completed').length || 0} / ${dashboard?.checklists?.length || 0}`}
            subtext="Completed" color="text-purple-600" iconBg="bg-purple-50 dark:bg-purple-900/20" to="/checklists" />
          <StatCard icon={AlertTriangle} label="Active Alerts" value={dashboard?.alerts?.length || 0}
            subtext={dashboard?.alerts?.filter((a) => a.severity === 'critical').length > 0 ? 'Includes critical!' : 'Needs attention'}
            color="text-orange-600" iconBg="bg-orange-50 dark:bg-orange-900/20" />
        </div>
      )}

      {!h('secondary_stats') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Wrench} label="Equipment Issues" value={dashboard?.equipmentIssues || 0}
            subtext="Needs maintenance" color="text-red-600" iconBg="bg-red-50 dark:bg-red-900/20" to="/equipment" />
          <StatCard icon={Package} label="Low Stock Items" value={dashboard?.lowStockCount || 0}
            subtext="Below minimum" color="text-amber-600" iconBg="bg-amber-50 dark:bg-amber-900/20" to="/inventory" />
          <StatCard icon={Brain} label="Active Tasks" value={dashboard?.pendingTaskCount || 0}
            subtext="Pending & in progress" color="text-purple-600" iconBg="bg-purple-50 dark:bg-purple-900/20" to="/tasks" />
          <StatCard icon={ShieldAlert} label="Open Claims" value={dashboard?.openClaims || 0}
            subtext="Reported & investigating" color="text-red-600" iconBg="bg-red-50 dark:bg-red-900/20" to="/claims" />
        </div>
      )}

      {(!h('alerts') || !h('live_feed')) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {!h('alerts') && (
            <div className={!h('live_feed') ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Active Alerts</h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{dashboard?.alerts?.length || 0} active</span>
                </div>
                <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                  {dashboard?.alerts?.length > 0 ? (
                    dashboard.alerts.map((alert) => (
                      <AlertItem key={alert.id} alert={alert} onAcknowledge={acknowledgeAlert} />
                    ))
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      <p className="text-sm">All clear! No active alerts.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!h('live_feed') && (
            <div className={!h('alerts') ? '' : 'lg:col-span-3'}>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Live Feed</h3>
                </div>
                <div className="p-2 max-h-[350px] overflow-y-auto">
                  <ActivityFeed limit={12} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(!h('tasks') || !h('low_stock')) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!h('tasks') && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Priority Tasks</h3>
                <Link to="/tasks" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-4 space-y-2">
                {dashboard?.pendingTasks?.length > 0 ? (
                  dashboard.pendingTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority] || ''}`}>
                        {task.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{task.category}{task.assignedTo ? ` \u00B7 ${task.assignedTo}` : ''}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">No pending tasks</p>
                )}
              </div>
            </div>
          )}

          {!h('low_stock') && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Low Stock Alerts</h3>
                <Link to="/inventory" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  Full Inventory <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-4 space-y-2">
                {dashboard?.lowStockItems?.length > 0 ? (
                  dashboard.lowStockItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                      <Package className="w-4 h-4 text-red-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">{item.currentStock} {item.unit} remaining (min: {item.minStock})</p>
                      </div>
                      <ArrowDown className="w-4 h-4 text-red-400" />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-400" />
                    <p className="text-sm">All stock levels healthy</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!h('checklists') && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Today's Checklists</h3>
          </div>
          <div className="p-4">
            {dashboard?.checklists?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dashboard.checklists.map((cl) => (
                  <div key={cl.id} className={`flex items-center gap-3 p-3 rounded-lg border ${cl.status === 'completed' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'}`}>
                    {cl.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    ) : (
                      <ClockIcon className="w-5 h-5 text-yellow-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{cl.templateName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{cl.completedBy}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">No checklists started today</p>
            )}
          </div>
        </div>
      )}

      {!h('info_bar') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/customers" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <UserCircle className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{dashboard?.customerCount || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Customers</p>
            </div>
          </Link>
          <Link to="/training" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{dashboard?.trainingStats?.totalModules || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Training Modules</p>
            </div>
          </Link>
          <Link to="/equipment" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <Wrench className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{(dashboard?.equipmentIssues || 0) === 0 ? 'All Good' : `${dashboard?.equipmentIssues} Issues`}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Equipment Status</p>
            </div>
          </Link>
          <Link to="/analytics" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">Analytics</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">View Reports</p>
            </div>
          </Link>
        </div>
      )}
    </>
  );
}

// Admin Dashboard — multi-location overview for SUPER_ADMIN and REGIONAL_ADMIN
function AdminDashboard({ switchLocation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data: result } = await api.get('/analytics/multi-location');
      setData(result);
    } catch (err) {
      console.error('Multi-location fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  }

  if (!data) {
    return <p className="text-sm text-gray-400 text-center py-8">Unable to load multi-location data.</p>;
  }

  return (
    <>
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Building2} label="Locations" value={data.summary.totalLocations}
          color="text-indigo-600" iconBg="bg-indigo-50 dark:bg-indigo-900/20" />
        <StatCard icon={Car} label="Cars This Week" value={data.summary.totalCarsWeek.toLocaleString()}
          subtext={`${data.summary.totalCarsToday} today`}
          color="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard icon={DollarSign} label="Est. Revenue (7d)" value={`$${data.summary.estimatedRevenueWeek.toLocaleString()}`}
          color="text-green-600" iconBg="bg-green-50 dark:bg-green-900/20" />
        <StatCard icon={Users} label="Total Team" value={data.summary.totalTeamSize}
          color="text-purple-600" iconBg="bg-purple-50 dark:bg-purple-900/20" />
        <StatCard icon={GraduationCap} label="Avg Training" value={`${data.summary.overallTrainingCompliance}%`}
          color="text-orange-600" iconBg="bg-orange-50 dark:bg-orange-900/20" />
      </div>

      {/* Aggregate Issues */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wrench} label="Equipment Issues" value={data.summary.totalEquipmentIssues}
          subtext="Across all locations" color="text-red-600" iconBg="bg-red-50 dark:bg-red-900/20" />
        <StatCard icon={Package} label="Low Stock Items" value={data.summary.totalLowStockItems}
          subtext="Below minimum" color="text-amber-600" iconBg="bg-amber-50 dark:bg-amber-900/20" />
        <StatCard icon={ShieldAlert} label="Open Claims" value={data.summary.totalOpenClaims}
          subtext="Reported & investigating" color="text-red-600" iconBg="bg-red-50 dark:bg-red-900/20" />
        <StatCard icon={Brain} label="Pending Tasks" value={data.summary.totalPendingTasks}
          subtext="Across all locations" color="text-purple-600" iconBg="bg-purple-50 dark:bg-purple-900/20" />
      </div>

      {/* Location Cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Location Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.locationBreakdown.map((loc) => (
            <button
              key={loc.locationId}
              onClick={() => switchLocation && switchLocation({ id: loc.locationId, name: loc.locationName })}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left"
            >
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-blue-500" />
                <h4 className="font-semibold text-gray-900 dark:text-white truncate">{loc.locationName}</h4>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{loc.carsWeek}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Cars (7d)</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">${loc.revenueWeek.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Revenue</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{loc.teamSize}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Team</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs">
                {loc.equipmentIssues > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <Wrench className="w-3 h-3" /> {loc.equipmentIssues} issues
                  </span>
                )}
                {loc.openClaims > 0 && (
                  <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <ShieldAlert className="w-3 h-3" /> {loc.openClaims} claims
                  </span>
                )}
                <span className={`ml-auto font-medium ${loc.trainingCompliance >= 80 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {loc.trainingCompliance}% trained
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Rankings */}
      {data.rankings && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Top by Cars', items: data.rankings.topByCarCount, suffix: '' },
            { title: 'Top by Revenue', items: data.rankings.topByRevenue, suffix: '$' },
            { title: 'Most Claims', items: data.rankings.mostClaims, suffix: '' },
            { title: 'Best Training', items: data.rankings.bestTrainingCompliance, suffix: '%' },
          ].map((rank) => (
            <div key={rank.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">{rank.title}</h4>
              <div className="space-y-2">
                {rank.items?.slice(0, 3).map((item, i) => (
                  <div key={item.locationId} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{item.locationName}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {rank.suffix === '$' ? `$${item.value.toLocaleString()}` : `${item.value}${rank.suffix}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          to="/multi-location-analytics"
          className="flex items-center justify-center gap-2 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
        >
          <BarChart3 className="w-4 h-4" />
          Multi-Location Analytics
        </Link>
        <Link
          to="/ai-insights"
          className="flex items-center justify-center gap-2 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-sm font-medium"
        >
          <Brain className="w-4 h-4" />
          AI Insights & Predictions
        </Link>
      </div>
    </>
  );
}

// Widget Settings dropdown for SITE_MANAGER dashboard customization
function WidgetSettings({ hiddenWidgets, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const widgets = [
    { key: 'primary_stats', label: 'Primary Stats' },
    { key: 'secondary_stats', label: 'Module Stats' },
    { key: 'alerts', label: 'Active Alerts' },
    { key: 'live_feed', label: 'Live Feed' },
    { key: 'tasks', label: 'Priority Tasks' },
    { key: 'low_stock', label: 'Low Stock Alerts' },
    { key: 'checklists', label: "Today's Checklists" },
    { key: 'info_bar', label: 'Quick Links' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Customize widgets"
      >
        <Settings className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Show/Hide Widgets</p>
          </div>
          {widgets.map((w) => {
            const visible = !hiddenWidgets.includes(w.key);
            return (
              <button
                key={w.key}
                onClick={() => onToggle(w.key)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${visible ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                  {visible && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className={visible ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>{w.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Main Dashboard — routes to role-specific view
export default function DashboardPage() {
  const { currentLocation, user, switchLocation } = useAuth();
  const socket = useSocket();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hiddenWidgets, setHiddenWidgets] = useState([]);

  const role = user?.role;
  const isAdmin = ['SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(role);

  // Fetch widget prefs for SITE_MANAGER
  useEffect(() => {
    if (role !== 'SITE_MANAGER') return;
    api.get('/dashboard-preferences').then(({ data }) => {
      try { setHiddenWidgets(JSON.parse(data.hiddenWidgets || '[]')); } catch { /* ignore */ }
    }).catch(() => {});
  }, [role]);

  const toggleWidget = async (key) => {
    const next = hiddenWidgets.includes(key)
      ? hiddenWidgets.filter((k) => k !== key)
      : [...hiddenWidgets, key];
    setHiddenWidgets(next);
    try {
      await api.put('/dashboard-preferences', { hiddenWidgets: JSON.stringify(next) });
    } catch { /* ignore */ }
  };

  // Fetch location-specific dashboard (skip for admin roles)
  const fetchDashboard = useCallback(async () => {
    if (!currentLocation || isAdmin) return;
    try {
      const { data } = await api.get(`/locations/${currentLocation.id}/dashboard`);
      setDashboard(data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentLocation, isAdmin]);

  useEffect(() => {
    if (isAdmin) { setLoading(false); return; }
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard, isAdmin]);

  useEffect(() => {
    if (!socket || isAdmin) return;
    socket.on('car-count-update', (data) => {
      setDashboard((prev) => prev ? { ...prev, carCount: data.count } : prev);
    });
    socket.on('clock-event', () => fetchDashboard());
    socket.on('new-alert', () => fetchDashboard());
    socket.on('checklist-completed', () => fetchDashboard());
    socket.on('task-created', () => fetchDashboard());
    socket.on('equipment-updated', () => fetchDashboard());
    socket.on('low-stock-alert', () => fetchDashboard());
    socket.on('new-claim', () => fetchDashboard());

    return () => {
      socket.off('car-count-update');
      socket.off('clock-event');
      socket.off('new-alert');
      socket.off('checklist-completed');
      socket.off('task-created');
      socket.off('equipment-updated');
      socket.off('low-stock-alert');
      socket.off('new-claim');
    };
  }, [socket, fetchDashboard, isAdmin]);

  const acknowledgeAlert = async (alertId) => {
    if (!currentLocation) return;
    try {
      await api.post(`/locations/${currentLocation.id}/alerts/${alertId}/acknowledge`);
      setDashboard((prev) => ({
        ...prev,
        alerts: prev.alerts.filter((a) => a.id !== alertId),
      }));
    } catch (err) {
      console.error('Acknowledge error:', err);
    }
  };

  // Admin roles see multi-location overview
  if (isAdmin) {
    return (
      <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Multi-Location Overview &middot; {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link to="/multi-location-analytics" className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium">
            <BarChart3 className="w-4 h-4" /> Full Analytics
          </Link>
        </div>
        <AdminDashboard switchLocation={switchLocation} />
      </div>
    );
  }

  // Non-admin roles need a location
  if (!currentLocation) {
    return (
      <div className="p-6 text-center">
        <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <h2 className="text-lg font-medium text-gray-600 dark:text-gray-400">No Location Selected</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500">Create a location in Settings to get started.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentLocation.name} &middot; {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {role === 'EMPLOYEE' && <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Employee View</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {role === 'SITE_MANAGER' && (
            <WidgetSettings hiddenWidgets={hiddenWidgets} onToggle={toggleWidget} />
          )}
          {role === 'SITE_MANAGER' && (
            <Link to="/analytics" className="hidden md:flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <TrendingUp className="w-4 h-4" /> Analytics
            </Link>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Live
          </div>
        </div>
      </div>

      {/* Role-based content */}
      {role === 'SITE_MANAGER' ? (
        <ManagerDashboard dashboard={dashboard} acknowledgeAlert={acknowledgeAlert} hiddenWidgets={hiddenWidgets} />
      ) : (
        <EmployeeDashboard dashboard={dashboard} acknowledgeAlert={acknowledgeAlert} />
      )}
    </div>
  );
}
