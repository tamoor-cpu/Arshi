import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Wrench, AlertTriangle } from 'lucide-react';

function HealthBar({ score }) {
  const color = score > 80 ? '#22C55E' : score > 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium min-w-[32px] text-right" style={{ color }}>{score}%</span>
    </div>
  );
}

export default function EquipmentHealthList() {
  const { currentLocation } = useAuth();
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    if (!currentLocation) return;
    api.get(`/locations/${currentLocation.id}/ai/maintenance-predictions`)
      .then(({ data }) => setPredictions(data))
      .catch(() => {});
  }, [currentLocation]);

  if (predictions.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No equipment data available</p>;
  }

  const sorted = [...predictions].sort((a, b) => a.healthScore - b.healthScore);

  return (
    <div className="space-y-3">
      {sorted.map((eq) => (
        <div key={eq.equipmentId} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">{eq.equipmentName}</p>
                <p className="text-xs text-gray-400 capitalize">{eq.category}</p>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              eq.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
              eq.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              eq.riskLevel === 'low' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {eq.riskLevel} risk
            </span>
          </div>

          <HealthBar score={eq.healthScore} />

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            {eq.mtbfDays && <span>MTBF: {eq.mtbfDays}d</span>}
            {eq.daysSinceLast != null && <span>Last: {eq.daysSinceLast}d ago</span>}
            {eq.nextMaintenanceEstimate && <span>Next: {eq.nextMaintenanceEstimate}</span>}
          </div>

          {eq.riskLevel === 'high' && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="w-3 h-3" /> {eq.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
