const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');
const {
  runPredictiveMaintenance,
  runDemandForecast,
  runSmartStaffingRecommendations,
  runAnomalyDetection,
} = require('../services/aiHeuristics');

// GET /:locationId/ai/demand-forecast — 7-day forecast
router.get('/:locationId/ai/demand-forecast', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await runDemandForecast(prisma, req.params.locationId);
    res.json(result);
  } catch (err) {
    console.error('Demand forecast error:', err);
    res.status(500).json({ error: 'Failed to generate demand forecast' });
  }
});

// GET /:locationId/ai/staffing-recommendations
router.get('/:locationId/ai/staffing-recommendations', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await runSmartStaffingRecommendations(prisma, req.params.locationId);
    res.json(result);
  } catch (err) {
    console.error('Staffing recommendations error:', err);
    res.status(500).json({ error: 'Failed to generate staffing recommendations' });
  }
});

// GET /:locationId/ai/maintenance-predictions
router.get('/:locationId/ai/maintenance-predictions', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const io = req.app.get('io');
    const allPredictions = await runPredictiveMaintenance(prisma, io);
    // Filter to this location
    const predictions = allPredictions.filter((p) => p.locationId === req.params.locationId);
    res.json(predictions);
  } catch (err) {
    console.error('Maintenance predictions error:', err);
    res.status(500).json({ error: 'Failed to generate maintenance predictions' });
  }
});

// GET /:locationId/ai/anomalies — recent anomaly alerts (7 days)
router.get('/:locationId/ai/anomalies', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const alerts = await prisma.systemAlert.findMany({
      where: {
        locationId: req.params.locationId,
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

// GET /:locationId/ai/summary — aggregate counts for overview cards
router.get('/:locationId/ai/summary', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const locationId = req.params.locationId;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [equipmentAtRisk, recentAlerts, pendingTasks, lowStockCount] = await Promise.all([
      prisma.equipment.count({
        where: { locationId, status: { in: ['down', 'maintenance'] } },
      }),
      prisma.systemAlert.count({
        where: { locationId, createdAt: { gte: sevenDaysAgo }, acknowledgedAt: null },
      }),
      prisma.aITask.count({
        where: { locationId, status: { in: ['pending', 'assigned', 'in_progress'] } },
      }),
      prisma.inventoryItem.count({
        where: {
          locationId,
          isActive: true,
          currentStock: { lte: 0 }, // will be filtered below
        },
      }),
    ]);

    // Better low-stock: check currentStock <= minStock
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: { locationId, isActive: true },
      select: { currentStock: true, minStock: true },
    });
    const actualLowStock = lowStockItems.filter((i) => i.currentStock <= i.minStock && i.minStock > 0).length;

    res.json({
      equipmentAtRisk,
      unacknowledgedAlerts: recentAlerts,
      pendingAiTasks: pendingTasks,
      lowStockItems: actualLowStock,
    });
  } catch (err) {
    console.error('AI summary error:', err);
    res.status(500).json({ error: 'Failed to fetch AI summary' });
  }
});

// POST /:locationId/ai/run-analysis — trigger on-demand
router.post('/:locationId/ai/run-analysis', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const io = req.app.get('io');

    const [maintenance, anomalies, forecast, staffing] = await Promise.all([
      runPredictiveMaintenance(prisma, io),
      runAnomalyDetection(prisma, io),
      runDemandForecast(prisma, req.params.locationId),
      runSmartStaffingRecommendations(prisma, req.params.locationId),
    ]);

    req.audit('run', 'ai_analysis', null, { locationId: req.params.locationId });

    res.json({
      maintenance: maintenance.filter((p) => p.locationId === req.params.locationId).length,
      anomalies: anomalies.filter((a) => a.locationId === req.params.locationId).length,
      forecastDays: forecast.forecast.length,
      staffingRecommendations: staffing.recommendations.length,
    });
  } catch (err) {
    console.error('AI run-analysis error:', err);
    res.status(500).json({ error: 'Failed to run analysis' });
  }
});

module.exports = router;
