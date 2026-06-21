import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function getWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay()); // Sunday
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export default function LaborCostCard() {
  const { currentLocation } = useAuth();
  const [summary, setSummary] = useState(null);
  const [range, setRange] = useState('week');

  useEffect(() => {
    if (!currentLocation) return;
    const { startDate, endDate } = range === 'week' ? getWeekRange() : (() => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    })();

    api.get(`/locations/${currentLocation.id}/shifts/labor-summary`, {
      params: { startDate, endDate },
    }).then(({ data }) => setSummary(data)).catch(() => {});
  }, [currentLocation, range]);

  if (!summary) return null;

  const chartData = summary.byShift.map((s) => ({
    name: s.shiftName,
    cost: Math.round(s.cost * 100) / 100,
    hours: Math.round(s.hours * 10) / 10,
  }));

  return (
    <div className="space-y-4">
      {/* Range toggle */}
      <div className="flex gap-2">
        {['week', 'month'].map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize ${range === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            This {r}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Labor Cost</p>
          <p className="text-2xl font-bold text-gray-900 flex items-center gap-1">
            <DollarSign className="w-5 h-5 text-green-600" />
            {summary.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Assignments</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalAssignments}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Employees</p>
          <p className="text-2xl font-bold text-gray-900">{summary.byEmployee.length}</p>
        </div>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Cost by Shift</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v, name) => [name === 'cost' ? `$${v}` : `${v}h`, name === 'cost' ? 'Cost' : 'Hours']} />
              <Bar dataKey="cost" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Employee breakdown */}
      {summary.byEmployee.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h4 className="text-sm font-medium text-gray-700">Employee Breakdown</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Employee</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Rate</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Hours</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Cost</th>
              </tr>
            </thead>
            <tbody>
              {summary.byEmployee.sort((a, b) => b.cost - a.cost).map((emp, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-700">{emp.name}</td>
                  <td className="px-4 py-2 text-gray-500">${emp.rate}/hr</td>
                  <td className="px-4 py-2 text-gray-500">{Math.round(emp.hours * 10) / 10}h</td>
                  <td className="px-4 py-2 text-gray-700 font-medium">${emp.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
