const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireLocationAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get dashboard summary for a location
router.get('/:locationId/dashboard', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const locationId = req.params.locationId;
    const tenantId = req.user.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Run all queries in parallel
    const [
      todayCycles,
      activeAlerts,
      onSiteCount,
      todayChecklists,
      totalTeamMembers,
      recentMessages,
      equipmentIssues,
      lowStockItems,
      openClaims,
      pendingTasks,
      trainingStats,
      customerCount,
    ] = await Promise.all([
      // Cars washed today
      prisma.tunnelCycle.count({
        where: { locationId, status: 'completed', startTime: { gte: today, lt: tomorrow } },
      }),
      // Active alerts
      prisma.systemAlert.findMany({
        where: { locationId, acknowledgedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Who's on-site (count users whose last event today is clock_in)
      (async () => {
        const events = await prisma.clockEvent.findMany({
          where: { locationId, timestamp: { gte: today } },
          orderBy: { timestamp: 'asc' },
        });
        const userLastEvent = {};
        events.forEach((e) => { userLastEvent[e.userId] = e; });
        const count = Object.values(userLastEvent).filter((e) => e.eventType === 'clock_in').length;
        return [{ count }];
      })(),
      // Today's checklist completions
      prisma.completedChecklist.findMany({
        where: { locationId, startedAt: { gte: today, lt: tomorrow } },
        include: {
          template: { select: { name: true, type: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      // Total team members assigned
      prisma.userLocation.count({ where: { locationId } }),
      // Recent messages
      prisma.message.findMany({
        where: { locationId },
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Equipment needing attention
      prisma.equipment.count({
        where: { locationId, status: { in: ['needs_maintenance', 'out_of_service'] } },
      }),
      // Low stock inventory items
      (async () => {
        const items = await prisma.inventoryItem.findMany({
          where: { locationId, isActive: true },
        });
        return items.filter((i) => i.currentStock <= i.minStock);
      })(),
      // Open damage claims
      prisma.damageClaim.count({
        where: { locationId, status: { in: ['reported', 'investigating'] } },
      }),
      // Pending/in-progress tasks
      prisma.aITask.findMany({
        where: { locationId, status: { in: ['pending', 'assigned', 'in_progress'] } },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      // Training completion stats
      (async () => {
        const modules = await prisma.trainingModule.findMany({
          where: { tenantId, isActive: true },
          include: { _count: { select: { completions: true } } },
        });
        const teamSize = await prisma.userLocation.count({ where: { locationId } });
        const totalRequired = modules.filter((m) => m.isRequired).length;
        return { totalModules: modules.length, totalRequired, teamSize };
      })(),
      // Total customers
      prisma.customer.count({ where: { tenantId } }),
    ]);

    res.json({
      carCount: todayCycles,
      alerts: activeAlerts,
      onSiteCount: onSiteCount[0]?.count ? Number(onSiteCount[0].count) : 0,
      totalTeam: totalTeamMembers,
      checklists: todayChecklists.map((c) => ({
        id: c.id,
        templateName: c.template.name,
        type: c.template.type,
        status: c.status,
        completedBy: `${c.user.firstName} ${c.user.lastName}`,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
      })),
      recentMessages: recentMessages.map((m) => ({
        id: m.id,
        text: m.messageText,
        type: m.messageType,
        sender: `${m.user.firstName} ${m.user.lastName}`,
        avatar: m.user.avatarUrl,
        time: m.createdAt,
      })),
      // New module stats
      equipmentIssues,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 3).map((i) => ({
        id: i.id,
        name: i.name,
        currentStock: i.currentStock,
        minStock: i.minStock,
        unit: i.unit,
      })),
      openClaims,
      pendingTasks: pendingTasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        category: t.category,
        assignedTo: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : null,
      })),
      pendingTaskCount: pendingTasks.length,
      trainingStats,
      customerCount,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Analytics data endpoint
router.get('/:locationId/analytics', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const locationId = req.params.locationId;
    const tenantId = req.user.tenantId;

    // Last 7 days car counts
    const carCountsByDay = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const count = await prisma.tunnelCycle.count({
        where: { locationId, status: 'completed', startTime: { gte: day, lt: nextDay } },
      });

      carCountsByDay.push({
        date: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        cars: count,
        revenue: count * 15,
      });
    }

    // Equipment status breakdown
    const equipment = await prisma.equipment.findMany({ where: { locationId } });
    const equipmentByStatus = {
      operational: equipment.filter((e) => e.status === 'operational').length,
      needs_maintenance: equipment.filter((e) => e.status === 'needs_maintenance').length,
      out_of_service: equipment.filter((e) => e.status === 'out_of_service').length,
      retired: equipment.filter((e) => e.status === 'retired').length,
    };

    // Inventory levels
    const inventory = await prisma.inventoryItem.findMany({
      where: { locationId, isActive: true },
      orderBy: { name: 'asc' },
    });
    const inventoryLevels = inventory.map((i) => ({
      name: i.name.length > 15 ? i.name.substring(0, 15) + '...' : i.name,
      current: i.currentStock,
      min: i.minStock,
      max: i.maxStock || i.minStock * 3,
      unit: i.unit,
    }));

    // Claims by status
    const allClaims = await prisma.damageClaim.findMany({ where: { locationId } });
    const claimsByStatus = {};
    allClaims.forEach((c) => { claimsByStatus[c.status] = (claimsByStatus[c.status] || 0) + 1; });

    // Tasks by priority
    const allTasks = await prisma.aITask.findMany({
      where: { locationId, status: { notIn: ['completed', 'cancelled'] } },
    });
    const tasksByPriority = {};
    allTasks.forEach((t) => { tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1; });

    // Training completion rate per module
    const trainingModules = await prisma.trainingModule.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: { select: { completions: true } },
        completions: { where: { status: 'completed' } },
      },
    });
    const teamSize = await prisma.userLocation.count({ where: { locationId } });
    const trainingProgress = trainingModules.map((m) => ({
      name: m.title.length > 20 ? m.title.substring(0, 20) + '...' : m.title,
      completed: m.completions.length,
      total: teamSize,
      rate: teamSize > 0 ? Math.round((m.completions.length / teamSize) * 100) : 0,
      required: m.isRequired,
    }));

    // Maintenance costs (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const maintLogs = await prisma.maintenanceLog.findMany({
      where: {
        equipment: { locationId },
        createdAt: { gte: thirtyDaysAgo },
        cost: { not: null },
      },
    });
    const totalMaintCost = maintLogs.reduce((sum, l) => sum + (l.cost || 0), 0);

    // Customer membership breakdown
    const customers = await prisma.customer.findMany({ where: { tenantId } });
    const membershipBreakdown = {};
    customers.forEach((c) => {
      const type = c.membershipType || 'none';
      membershipBreakdown[type] = (membershipBreakdown[type] || 0) + 1;
    });

    res.json({
      carCountsByDay,
      equipmentByStatus,
      inventoryLevels,
      claimsByStatus,
      tasksByPriority,
      trainingProgress,
      totalMaintCost,
      membershipBreakdown,
      totalEquipment: equipment.length,
      totalInventoryItems: inventory.length,
      totalCustomers: customers.length,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Record tunnel cycle (car wash)
router.post('/:locationId/tunnel/cycle', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const cycle = await prisma.tunnelCycle.create({
      data: {
        locationId: req.params.locationId,
        status: 'completed',
        endTime: new Date(),
        cycleDuration: req.body.duration || 180, // default 3 min
      },
    });

    // Get updated count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await prisma.tunnelCycle.count({
      where: {
        locationId: req.params.locationId,
        status: 'completed',
        startTime: { gte: today },
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('car-count-update', { count });

    res.status(201).json({ cycle, todayCount: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record cycle' });
  }
});

// Get/manage alerts
router.get('/:locationId/alerts', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { acknowledged } = req.query;
    const where = { locationId: req.params.locationId };

    if (acknowledged === 'false') where.acknowledgedAt = null;
    if (acknowledged === 'true') where.acknowledgedAt = { not: null };

    const alerts = await prisma.systemAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Create alert
router.post('/:locationId/alerts', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { alertType, severity, title, message } = req.body;

    const alert = await prisma.systemAlert.create({
      data: {
        locationId: req.params.locationId,
        alertType,
        severity: severity || 'medium',
        title,
        message,
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('new-alert', alert);

    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Acknowledge alert
router.post('/:locationId/alerts/:alertId/acknowledge', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const alert = await prisma.systemAlert.update({
      where: { id: req.params.alertId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: req.user.id,
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('alert-acknowledged', { alertId: alert.id });

    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Employee recognition leaderboard for a location.
// Categories: most reviews (name mentioned), most completed tasks,
// most completed maintenance, most completed work orders.
router.get('/:locationId/leaderboard', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const locationId = req.params.locationId;
    const tenantId = req.user.tenantId;
    const days = Math.min(parseInt(req.query.days, 10) || 30, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Active employees at this location (for display + name matching)
    const users = await prisma.user.findMany({
      where: { tenantId, archived: false, userLocations: { some: { locationId } } },
      select: { id: true, firstName: true, lastName: true, position: true, role: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const [taskGroups, woGroups, maintGroups, reviews] = await Promise.all([
      prisma.aITask.groupBy({
        by: ['assignedToId'],
        where: { locationId, status: 'completed', assignedToId: { not: null }, completedAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.workOrder.groupBy({
        by: ['assignedToId'],
        where: { locationId, status: { in: ['completed', 'approved'] }, assignedToId: { not: null }, completedAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.maintenanceLog.groupBy({
        by: ['performedById'],
        where: { status: 'completed', completedAt: { gte: since }, equipment: { is: { locationId } } },
        _count: { _all: true },
      }),
      prisma.review.findMany({
        where: { locationId, reviewedAt: { gte: since }, comment: { not: null } },
        select: { comment: true },
      }),
    ]);

    // Tally review name mentions (whole-word, case-insensitive, first name >= 2 chars)
    const reviewCounts = new Map();
    for (const r of reviews) {
      const text = ' ' + (r.comment || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
      const mentioned = new Set();
      for (const u of users) {
        const f = (u.firstName || '').toLowerCase();
        if (f.length >= 2 && text.includes(' ' + f + ' ')) mentioned.add(u.id);
      }
      mentioned.forEach((id) => reviewCounts.set(id, (reviewCounts.get(id) || 0) + 1));
    }

    const groupsToCounts = (groups, key, into) => {
      const m = into || new Map();
      for (const g of groups) {
        const id = g[key];
        if (id) m.set(id, (m.get(id) || 0) + g._count._all);
      }
      return m;
    };

    // Work orders + maintenance are recognized together
    const workCounts = groupsToCounts(maintGroups, 'performedById', groupsToCounts(woGroups, 'assignedToId'));

    const rank = (counts, limit = 5) =>
      [...counts.entries()]
        .map(([id, count]) => {
          const u = byId.get(id);
          return u ? { userId: id, name: `${u.firstName} ${u.lastName}`, position: u.position || u.role?.replace('_', ' '), count } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    res.json({
      period: { days, since },
      categories: [
        { key: 'reviews', label: 'Most Reviews', sublabel: 'Name mentioned', leaders: rank(reviewCounts) },
        { key: 'tasks', label: 'Most Completed Tasks', sublabel: 'To-Do items closed', leaders: rank(groupsToCounts(taskGroups, 'assignedToId')) },
        { key: 'workOrders', label: 'Most Completed Work Orders', sublabel: 'Work orders & maintenance', leaders: rank(workCounts) },
      ],
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to build leaderboard' });
  }
});

module.exports = router;
