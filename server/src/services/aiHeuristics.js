/**
 * AI Heuristic Services — rule-based analytics, no external ML/APIs.
 * All functions use simple statistical heuristics for predictions.
 */

const { notify, notifyLocationManagers } = require('./notify');

/**
 * 1. Predictive Maintenance
 * Calculates MTBF from MaintenanceLog intervals. If time since last maintenance
 * exceeds 80% of MTBF, flags equipment for attention.
 */
async function runPredictiveMaintenance(prisma, io) {
  const equipment = await prisma.equipment.findMany({
    where: { status: { not: 'decommissioned' } },
    include: {
      maintenanceLogs: {
        orderBy: { completedAt: 'desc' },
        where: { completedAt: { not: null } },
        take: 20,
      },
      location: { select: { id: true, name: true } },
    },
  });

  const predictions = [];

  for (const eq of equipment) {
    const logs = eq.maintenanceLogs.filter((l) => l.completedAt);
    if (logs.length < 2) {
      predictions.push({
        equipmentId: eq.id,
        equipmentName: eq.name,
        locationId: eq.locationId,
        locationName: eq.location.name,
        category: eq.category,
        healthScore: 70, // unknown — default moderate
        riskLevel: 'unknown',
        mtbfDays: null,
        daysSinceLast: logs.length > 0 ? daysBetween(new Date(logs[0].completedAt), new Date()) : null,
        nextMaintenanceEstimate: null,
        message: 'Insufficient maintenance history for prediction',
      });
      continue;
    }

    // Calculate MTBF (mean time between failures/maintenance)
    const intervals = [];
    for (let i = 0; i < logs.length - 1; i++) {
      const days = daysBetween(new Date(logs[i + 1].completedAt), new Date(logs[i].completedAt));
      if (days > 0) intervals.push(days);
    }

    const mtbfDays = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 90;
    const daysSinceLast = daysBetween(new Date(logs[0].completedAt), new Date());
    const ratio = daysSinceLast / mtbfDays;

    let riskLevel, healthScore;
    if (ratio > 1.0) {
      riskLevel = 'high';
      healthScore = Math.max(0, Math.round((1 - (ratio - 1) * 0.5) * 100));
    } else if (ratio > 0.8) {
      riskLevel = 'medium';
      healthScore = Math.round((1 - ratio * 0.3) * 100);
    } else {
      riskLevel = 'low';
      healthScore = Math.round((1 - ratio * 0.2) * 100);
    }
    healthScore = Math.min(100, Math.max(0, healthScore));

    const nextMaintenanceEstimate = new Date();
    nextMaintenanceEstimate.setDate(nextMaintenanceEstimate.getDate() + Math.max(0, Math.round(mtbfDays - daysSinceLast)));

    predictions.push({
      equipmentId: eq.id,
      equipmentName: eq.name,
      locationId: eq.locationId,
      locationName: eq.location.name,
      category: eq.category,
      healthScore,
      riskLevel,
      mtbfDays: Math.round(mtbfDays),
      daysSinceLast,
      nextMaintenanceEstimate: nextMaintenanceEstimate.toISOString().slice(0, 10),
      message: riskLevel === 'high'
        ? `${eq.name} is overdue for maintenance (${daysSinceLast} days since last, MTBF ${Math.round(mtbfDays)} days)`
        : riskLevel === 'medium'
        ? `${eq.name} approaching maintenance window`
        : `${eq.name} is in good condition`,
    });

    // Create alerts for high-risk equipment
    if (riskLevel === 'high' || riskLevel === 'medium') {
      await prisma.systemAlert.create({
        data: {
          locationId: eq.locationId,
          alertType: 'maintenance',
          severity: riskLevel === 'high' ? 'high' : 'medium',
          title: `Predictive Maintenance: ${eq.name}`,
          message: `MTBF analysis suggests ${eq.name} needs attention. ${daysSinceLast} days since last maintenance (avg interval: ${Math.round(mtbfDays)} days).`,
        },
      }).catch(() => {});

      if (riskLevel === 'high' && io) {
        await notifyLocationManagers({
          prisma, io,
          locationId: eq.locationId,
          type: 'maintenance_prediction',
          title: `Maintenance Alert: ${eq.name}`,
          message: `${eq.name} is overdue for maintenance based on historical patterns`,
          entityType: 'equipment',
          entityId: eq.id,
        });
      }
    }
  }

  return predictions;
}

/**
 * 2. Demand Forecast
 * Aggregates 30 days of TunnelCycle data by day-of-week to predict next 7 days.
 */
async function runDemandForecast(prisma, locationId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const cycles = await prisma.tunnelCycle.findMany({
    where: {
      locationId,
      startTime: { gte: thirtyDaysAgo },
    },
  });

  // Group by day of week
  const byDow = {};
  for (let d = 0; d < 7; d++) byDow[d] = [];

  for (const c of cycles) {
    const dow = new Date(c.startTime).getDay();
    const dateStr = new Date(c.startTime).toISOString().slice(0, 10);
    if (!byDow[dow].includes(dateStr)) byDow[dow].push(dateStr);
  }

  // Count cycles per day-of-week
  const countByDow = {};
  for (let d = 0; d < 7; d++) countByDow[d] = [];

  for (const c of cycles) {
    const dateStr = new Date(c.startTime).toISOString().slice(0, 10);
    const dow = new Date(c.startTime).getDay();
    const key = `${dow}-${dateStr}`;
    if (!countByDow[dow][dateStr]) countByDow[dow][dateStr] = 0;
    // Use object notation
  }

  // Simpler approach: count per date, then avg by dow
  const cyclesByDate = {};
  for (const c of cycles) {
    const dateStr = new Date(c.startTime).toISOString().slice(0, 10);
    cyclesByDate[dateStr] = (cyclesByDate[dateStr] || 0) + 1;
  }

  const dowTotals = {};
  const dowCounts = {};
  for (const [dateStr, count] of Object.entries(cyclesByDate)) {
    const dow = new Date(dateStr + 'T12:00:00').getDay();
    dowTotals[dow] = (dowTotals[dow] || 0) + count;
    dowCounts[dow] = (dowCounts[dow] || 0) + 1;
  }

  // Generate 7-day forecast
  const forecast = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dow = date.getDay();
    const dataPoints = dowCounts[dow] || 0;
    const avgCycles = dataPoints > 0 ? Math.round(dowTotals[dow] / dataPoints) : 0;

    forecast.push({
      date: date.toISOString().slice(0, 10),
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow],
      predictedCycles: avgCycles,
      confidence: dataPoints >= 4 ? 'high' : dataPoints >= 2 ? 'medium' : 'low',
      dataPoints,
    });
  }

  return { forecast, totalHistoricalCycles: cycles.length, daysAnalyzed: Object.keys(cyclesByDate).length };
}

/**
 * 3. Smart Staffing Recommendations
 * Combines demand forecast with shift templates and time-off to flag staffing gaps.
 */
async function runSmartStaffingRecommendations(prisma, locationId) {
  const forecast = await runDemandForecast(prisma, locationId);
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const shifts = await prisma.shift.findMany({
    where: { locationId, isActive: true },
  });

  const timeOff = await prisma.timeOffRequest.findMany({
    where: {
      locationId,
      status: 'approved',
      startDate: { lte: weekEnd },
      endDate: { gte: today },
    },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      shift: { locationId },
      date: { gte: today, lte: weekEnd },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      shift: true,
    },
  });

  const recommendations = [];

  for (const day of forecast.forecast) {
    const date = new Date(day.date + 'T12:00:00');
    const dow = date.getDay();

    // Time-off on this day
    const offOnDay = timeOff.filter((to) => {
      return new Date(to.startDate) <= date && new Date(to.endDate) >= date;
    });

    for (const shift of shifts) {
      const shiftDays = (shift.daysOfWeek || '1,2,3,4,5,6,0').split(',').map(Number);
      if (!shiftDays.includes(dow)) continue;

      const dateStr = day.date;
      const assigned = assignments.filter(
        (a) => a.shiftId === shift.id && a.date.toISOString().slice(0, 10) === dateStr
      );

      // Remove time-off employees from effective count
      const offUserIds = new Set(offOnDay.map((o) => o.userId));
      const effectiveStaff = assigned.filter((a) => !offUserIds.has(a.userId));

      const minStaff = shift.minStaff || 1;
      const maxStaff = shift.maxStaff || minStaff;

      // Demand-based recommendation: scale minStaff by demand vs average
      const avgForecast = forecast.forecast.reduce((sum, f) => sum + f.predictedCycles, 0) / 7;
      const demandFactor = avgForecast > 0 ? day.predictedCycles / avgForecast : 1;
      const recommendedStaff = Math.max(minStaff, Math.min(maxStaff, Math.round(minStaff * demandFactor)));

      let status;
      if (effectiveStaff.length < minStaff) status = 'understaffed';
      else if (effectiveStaff.length > maxStaff) status = 'overstaffed';
      else if (effectiveStaff.length < recommendedStaff) status = 'below_recommended';
      else status = 'adequate';

      recommendations.push({
        date: dateStr,
        dayOfWeek: day.dayOfWeek,
        shiftId: shift.id,
        shiftName: shift.name,
        currentStaff: effectiveStaff.length,
        assignedStaff: assigned.length,
        onTimeOff: assigned.length - effectiveStaff.length,
        minStaff,
        maxStaff,
        recommendedStaff,
        predictedDemand: day.predictedCycles,
        status,
      });
    }
  }

  return { recommendations, timeOffCount: timeOff.length };
}

/**
 * 4. Anomaly Detection
 * Checks for: sudden equipment status changes, inventory depletion spikes,
 * clock-in pattern irregularities, and no-show rates.
 */
async function runAnomalyDetection(prisma, io) {
  const anomalies = [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // 4a. Equipment status changes
  const recentAlerts = await prisma.systemAlert.findMany({
    where: {
      alertType: 'equipment',
      createdAt: { gte: sevenDaysAgo },
    },
    include: { location: { select: { id: true, name: true } } },
  });

  const equipmentDown = await prisma.equipment.findMany({
    where: { status: { in: ['down', 'maintenance'] } },
    include: { location: { select: { id: true, name: true } } },
  });

  for (const eq of equipmentDown) {
    anomalies.push({
      type: 'equipment_down',
      severity: 'high',
      locationId: eq.locationId,
      locationName: eq.location.name,
      title: `Equipment Down: ${eq.name}`,
      message: `${eq.name} is currently ${eq.status}`,
      entityType: 'equipment',
      entityId: eq.id,
      detectedAt: new Date().toISOString(),
    });
  }

  // 4b. Inventory depletion check
  const lowStockItems = await prisma.inventoryItem.findMany({
    where: {
      isActive: true,
      currentStock: { lte: prisma.raw ? 0 : undefined },
    },
    include: { location: { select: { id: true, name: true } } },
  });

  // Alternative: fetch all and filter
  const allItems = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    include: { location: { select: { id: true, name: true } } },
  });

  for (const item of allItems) {
    if (item.currentStock <= item.minStock && item.minStock > 0) {
      const depletionRate = item.currentStock / item.minStock;
      anomalies.push({
        type: 'low_inventory',
        severity: depletionRate <= 0.25 ? 'high' : 'medium',
        locationId: item.locationId,
        locationName: item.location.name,
        title: `Low Inventory: ${item.name}`,
        message: `${item.name} is at ${item.currentStock} ${item.unit} (min: ${item.minStock})`,
        entityType: 'inventory',
        entityId: item.id,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // 4c. Clock-in pattern irregularities (>30 min off schedule)
  const recentClockEvents = await prisma.clockEvent.findMany({
    where: {
      eventType: 'clock_in',
      timestamp: { gte: sevenDaysAgo },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: 200,
  });

  // Group by user and check for late arrivals
  const lateByUser = {};
  for (const event of recentClockEvents) {
    const hour = new Date(event.timestamp).getHours();
    // Flag if clocking in outside typical work hours (before 5am or after 10pm)
    if (hour < 5 || hour > 22) {
      const userId = event.userId;
      lateByUser[userId] = (lateByUser[userId] || 0) + 1;
    }
  }

  for (const [userId, count] of Object.entries(lateByUser)) {
    if (count >= 2) {
      const user = recentClockEvents.find((e) => e.userId === userId)?.user;
      anomalies.push({
        type: 'unusual_clock_pattern',
        severity: 'low',
        title: `Unusual Clock-In Pattern: ${user?.firstName} ${user?.lastName}`,
        message: `${count} clock-ins outside normal hours in the past 7 days`,
        entityType: 'user',
        entityId: userId,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // 4d. No-show detection (assigned but didn't clock in)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const yesterdayAssignments = await prisma.shiftAssignment.findMany({
    where: {
      date: { gte: yesterday, lte: yesterdayEnd },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      shift: { select: { locationId: true, name: true } },
    },
  });

  const yesterdayClockIns = await prisma.clockEvent.findMany({
    where: {
      eventType: 'clock_in',
      timestamp: { gte: yesterday, lte: yesterdayEnd },
    },
  });

  const clockedInUsers = new Set(yesterdayClockIns.map((e) => e.userId));
  const noShows = yesterdayAssignments.filter((a) => !clockedInUsers.has(a.userId));

  if (noShows.length > 0 && yesterdayAssignments.length > 0) {
    const noShowRate = noShows.length / yesterdayAssignments.length;
    if (noShowRate > 0.2) {
      anomalies.push({
        type: 'high_no_show_rate',
        severity: 'high',
        title: 'High No-Show Rate',
        message: `${noShows.length}/${yesterdayAssignments.length} assigned employees didn't clock in yesterday (${Math.round(noShowRate * 100)}%)`,
        detectedAt: new Date().toISOString(),
      });
    }

    for (const ns of noShows) {
      anomalies.push({
        type: 'no_show',
        severity: 'medium',
        locationId: ns.shift.locationId,
        title: `No-Show: ${ns.user.firstName} ${ns.user.lastName}`,
        message: `Assigned to ${ns.shift.name} on ${yesterday.toLocaleDateString()} but didn't clock in`,
        entityType: 'user',
        entityId: ns.userId,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // Create system alerts for high-severity anomalies
  for (const a of anomalies.filter((a) => a.severity === 'high' && a.locationId)) {
    await prisma.systemAlert.create({
      data: {
        locationId: a.locationId,
        alertType: a.type.includes('equipment') ? 'equipment' : a.type.includes('inventory') ? 'chemical' : 'staffing',
        severity: 'high',
        title: a.title,
        message: a.message,
      },
    }).catch(() => {});
  }

  return anomalies;
}

// Helper
function daysBetween(d1, d2) {
  return Math.round(Math.abs((d2 - d1) / (1000 * 60 * 60 * 24)));
}

module.exports = {
  runPredictiveMaintenance,
  runDemandForecast,
  runSmartStaffingRecommendations,
  runAnomalyDetection,
};
