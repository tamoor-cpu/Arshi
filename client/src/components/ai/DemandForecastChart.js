import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function DemandForecastChart() {
  const { currentLocation } = useAuth();
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    if (!currentLocation) return;
    api.get(`/locations/${currentLocation.id}/ai/demand-forecast`)
      .then(({ data }) => setForecast(data))
      .catch(() => {});
  }, [currentLocation]);

  if (!forecast) return <div className="text-center py-8 text-gray-400 text-sm">Loading forecast...</div>;

  const chartData = forecast.forecast.map((d) => ({
    name: d.dayOfWeek.slice(0, 3),
    date: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cycles: d.predictedCycles,
    confidence: d.confidence,
  }));

  const CONFIDENCE_COLORS = { high: '#22C55E', medium: '#F59E0B', low: '#EF4444' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Based on {forecast.totalHistoricalCycles} cycles over {forecast.daysAnalyzed} days
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorCycles" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                  <p className="font-medium">{d.name} — {d.date}</p>
                  <p className="text-blue-600">{d.cycles} predicted cycles</p>
                  <p className="flex items-center gap-1 mt-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS[d.confidence] }} />
                    <span className="text-gray-500 capitalize">{d.confidence} confidence</span>
                  </p>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="cycles" stroke="#3B82F6" fillOpacity={1} fill="url(#colorCycles)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex gap-4 pt-2 border-t border-gray-100">
        {['high', 'medium', 'low'].map((c) => (
          <div key={c} className="flex items-center gap-1.5 text-xs text-gray-500 capitalize">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS[c] }} /> {c}
          </div>
        ))}
      </div>
    </div>
  );
}
