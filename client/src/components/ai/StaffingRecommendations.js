import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const STATUS_STYLES = {
  understaffed: 'bg-red-100 text-red-700',
  below_recommended: 'bg-yellow-100 text-yellow-700',
  adequate: 'bg-green-100 text-green-700',
  overstaffed: 'bg-blue-100 text-blue-700',
};

export default function StaffingRecommendations() {
  const { currentLocation } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!currentLocation) return;
    api.get(`/locations/${currentLocation.id}/ai/staffing-recommendations`)
      .then(({ data }) => setData(data))
      .catch(() => {});
  }, [currentLocation]);

  if (!data) return <div className="text-center py-8 text-gray-400 text-sm">Loading recommendations...</div>;

  const { recommendations, timeOffCount } = data;

  if (recommendations.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No shift data to analyze</p>;
  }

  // Group by date
  const byDate = {};
  for (const r of recommendations) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  }

  return (
    <div className="space-y-4">
      {timeOffCount > 0 && (
        <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
          {timeOffCount} approved time-off request(s) factored into recommendations
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-2 text-xs font-medium text-gray-500">Day</th>
              <th className="px-4 py-2 text-xs font-medium text-gray-500">Shift</th>
              <th className="px-4 py-2 text-xs font-medium text-gray-500">Current</th>
              <th className="px-4 py-2 text-xs font-medium text-gray-500">Min/Max</th>
              <th className="px-4 py-2 text-xs font-medium text-gray-500">Recommended</th>
              <th className="px-4 py-2 text-xs font-medium text-gray-500">Demand</th>
              <th className="px-4 py-2 text-xs font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, recs]) =>
              recs.map((r, i) => (
                <tr key={`${date}-${r.shiftId}`} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-700">
                    {i === 0 ? (
                      <div>
                        <span className="font-medium">{r.dayOfWeek.slice(0, 3)}</span>
                        <span className="text-xs text-gray-400 ml-1">
                          {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ) : ''}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{r.shiftName}</td>
                  <td className="px-4 py-2">
                    <span className="font-medium">{r.currentStaff}</span>
                    {r.onTimeOff > 0 && (
                      <span className="text-xs text-orange-500 ml-1">(-{r.onTimeOff} off)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{r.minStaff}/{r.maxStaff}</td>
                  <td className="px-4 py-2 font-medium text-blue-600">{r.recommendedStaff}</td>
                  <td className="px-4 py-2 text-gray-500">{r.predictedDemand} cycles</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[r.status] || ''}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
