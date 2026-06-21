const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/v1/analytics/multi-location
router.get('/multi-location', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { locationIds } = req.query;

    // Get target locations
    let locations;
    if (locationIds) {
      const ids = locationIds.split(',').map(s => s.trim());
      locations = await prisma.location.findMany({ where: { tenantId, id: { in: ids }, isActive: true } });
    } else {
      locations = await prisma.location.findMany({ where: { tenantId, isActive: true } });
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    // Per-location metrics in parallel
    const locationBreakdown = await Promise.all(
      locations.map(async (loc) => {
        const [carsToday, carsWeek, equipmentIssues, lowStockItems, openClaims, pendingTasks, teamSize, trainingData] = await Promise.all([
          prisma.tunnelCycle.count({ where: { locationId: loc.id, status: 'completed', startTime: { gte: today, lt: tomorrow } } }),
          prisma.tunnelCycle.count({ where: { locationId: loc.id, status: 'completed', startTime: { gte: weekAgo, lt: tomorrow } } }),
          prisma.equipment.count({ where: { locationId: loc.id, status: { in: ['needs_maintenance', 'out_of_service'] } } }),
          prisma.inventoryItem.findMany({ where: { locationId: loc.id, isActive: true } }).then(items => items.filter(i => i.currentStock <= i.minStock).length),
          prisma.damageClaim.count({ where: { locationId: loc.id, status: { in: ['reported', 'investigating'] } } }),
          prisma.aITask.count({ where: { locationId: loc.id, status: { in: ['pending', 'assigned', 'in_progress'] } } }),
          prisma.userLocation.count({ where: { locationId: loc.id } }),
          (async () => {
            const modules = await prisma.trainingModule.findMany({ where: { tenantId, isActive: true, isRequired: true }, include: { completions: { where: { status: 'completed' } } } });
            const ts = await prisma.userLocation.count({ where: { locationId: loc.id } });
            if (modules.length === 0 || ts === 0) return 100;
            const totalPossible = modules.length * ts;
            const totalCompleted = modules.reduce((s, m) => s + m.completions.length, 0);
            return Math.round((totalCompleted / totalPossible) * 100);
          })(),
        ]);

        return {
          locationId: loc.id,
          locationName: loc.name,
          carsToday,
          carsWeek,
          revenueWeek: carsWeek * 15,
          equipmentIssues,
          lowStockCount: lowStockItems,
          openClaims,
          pendingTasks,
          trainingCompliance: trainingData,
          teamSize,
        };
      })
    );

    // Aggregated summary
    const summary = {
      totalLocations: locations.length,
      totalCarsToday: locationBreakdown.reduce((s, l) => s + l.carsToday, 0),
      totalCarsWeek: locationBreakdown.reduce((s, l) => s + l.carsWeek, 0),
      estimatedRevenueWeek: locationBreakdown.reduce((s, l) => s + l.revenueWeek, 0),
      totalEquipmentIssues: locationBreakdown.reduce((s, l) => s + l.equipmentIssues, 0),
      totalLowStockItems: locationBreakdown.reduce((s, l) => s + l.lowStockCount, 0),
      totalOpenClaims: locationBreakdown.reduce((s, l) => s + l.openClaims, 0),
      totalPendingTasks: locationBreakdown.reduce((s, l) => s + l.pendingTasks, 0),
      overallTrainingCompliance: locationBreakdown.length > 0
        ? Math.round(locationBreakdown.reduce((s, l) => s + l.trainingCompliance, 0) / locationBreakdown.length)
        : 100,
      totalTeamSize: locationBreakdown.reduce((s, l) => s + l.teamSize, 0),
    };

    // 7-day trends with per-location values
    const carsByDay = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(); day.setDate(day.getDate() - i); day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);

      const locValues = {};
      let total = 0;
      for (const loc of locations) {
        const count = await prisma.tunnelCycle.count({
          where: { locationId: loc.id, status: 'completed', startTime: { gte: day, lt: nextDay } },
        });
        locValues[loc.id] = count;
        total += count;
      }

      carsByDay.push({
        date: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        total,
        locations: locValues,
      });
    }

    // Rankings
    const sorted = (key, desc = true) =>
      [...locationBreakdown]
        .sort((a, b) => desc ? b[key] - a[key] : a[key] - b[key])
        .map(l => ({ locationId: l.locationId, locationName: l.locationName, value: l[key] }));

    const rankings = {
      topByCarCount: sorted('carsWeek'),
      topByRevenue: sorted('revenueWeek'),
      mostClaims: sorted('openClaims'),
      bestTrainingCompliance: sorted('trainingCompliance'),
    };

    res.json({ summary, locationBreakdown, trends: { carsByDay }, rankings });
  } catch (err) {
    console.error('Multi-location analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch multi-location analytics' });
  }
});

module.exports = router;
