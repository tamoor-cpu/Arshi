import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50 border-red-200', icon: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  high: { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', badge: 'bg-red-100 text-red-700' },
  medium: { bg: 'bg-yellow-50 border-yellow-200', icon: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700' },
  low: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-500', badge: 'bg-blue-100 text-blue-700' },
};

function SeverityIcon({ severity }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
  if (severity === 'critical' || severity === 'high') return <AlertTriangle className={`w-4 h-4 ${style.icon}`} />;
  if (severity === 'medium') return <AlertCircle className={`w-4 h-4 ${style.icon}`} />;
  return <Info className={`w-4 h-4 ${style.icon}`} />;
}

export default function AnomalyTimeline() {
  const { currentLocation } = useAuth();
  const [anomalies, setAnomalies] = useState([]);

  useEffect(() => {
    if (!currentLocation) return;
    api.get(`/locations/${currentLocation.id}/ai/anomalies`)
      .then(({ data }) => setAnomalies(data))
      .catch(() => {});
  }, [currentLocation]);

  if (anomalies.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
          <Info className="w-5 h-5 text-green-600" />
        </div>
        <p className="text-sm text-gray-500">No anomalies detected in the past 7 days</p>
      </div>
    );
  }

  // Group by date
  const byDate = {};
  for (const a of anomalies) {
    const dateStr = new Date(a.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(a);
  }

  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([date, items]) => (
        <div key={date}>
          <p className="text-xs font-medium text-gray-500 mb-2">{date}</p>
          <div className="space-y-2">
            {items.map((a) => {
              const style = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.low;
              return (
                <div key={a.id} className={`border rounded-lg p-3 ${style.bg}`}>
                  <div className="flex items-start gap-2">
                    <SeverityIcon severity={a.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-gray-900">{a.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${style.badge}`}>
                          {a.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{a.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(a.createdAt).toLocaleTimeString()}
                        {a.alertType && ` · ${a.alertType}`}
                        {a.acknowledgedAt && ' · Acknowledged'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
