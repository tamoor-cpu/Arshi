const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireLocationAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get recent activity feed for a location
router.get('/:locationId/activity', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const locationId = req.params.locationId;
    const tenantId = req.user.tenantId;
    const since = new Date();
    since.setHours(since.getHours() - 24); // Last 24 hours

    // Fetch recent events in parallel
    const [clockEvents, completedChecklists, maintenanceLogs, usageLogs, claims, tasks, messages] = await Promise.all([
      // Clock ins/outs
      prisma.clockEvent.findMany({
        where: { locationId, timestamp: { gte: since } },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
      // Completed checklists
      prisma.completedChecklist.findMany({
        where: { locationId, startedAt: { gte: since } },
        include: {
          template: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
      // Maintenance activity
      prisma.maintenanceLog.findMany({
        where: { equipment: { locationId }, createdAt: { gte: since } },
        include: {
          equipment: { select: { name: true } },
          performedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Inventory usage
      prisma.inventoryUsageLog.findMany({
        where: { item: { locationId }, createdAt: { gte: since } },
        include: {
          item: { select: { name: true, unit: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // New claims
      prisma.damageClaim.findMany({
        where: { locationId, createdAt: { gte: since } },
        include: { reportedBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Task updates
      prisma.aITask.findMany({
        where: { locationId, updatedAt: { gte: since } },
        include: {
          assignedTo: { select: { firstName: true, lastName: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      // Messages
      prisma.message.findMany({
        where: { locationId, createdAt: { gte: since } },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Merge into unified activity feed
    const activities = [];

    clockEvents.forEach((e) => {
      activities.push({
        type: e.eventType === 'clock_in' ? 'clock_in' : 'clock_out',
        actor: `${e.user.firstName} ${e.user.lastName}`,
        description: e.eventType === 'clock_in' ? 'clocked in' : 'clocked out',
        timestamp: e.timestamp,
      });
    });

    completedChecklists.forEach((c) => {
      activities.push({
        type: 'checklist',
        actor: `${c.user.firstName} ${c.user.lastName}`,
        description: `${c.status === 'completed' ? 'completed' : 'started'} "${c.template.name}"`,
        timestamp: c.completedAt || c.startedAt,
      });
    });

    maintenanceLogs.forEach((m) => {
      activities.push({
        type: 'maintenance',
        actor: `${m.performedBy.firstName} ${m.performedBy.lastName}`,
        description: `logged ${m.type} maintenance on ${m.equipment.name}`,
        timestamp: m.createdAt,
      });
    });

    usageLogs.forEach((u) => {
      const action = u.quantity > 0 ? 'restocked' : 'used';
      activities.push({
        type: 'inventory',
        actor: `${u.user.firstName} ${u.user.lastName}`,
        description: `${action} ${Math.abs(u.quantity)} ${u.item.unit} of ${u.item.name}`,
        timestamp: u.createdAt,
      });
    });

    claims.forEach((c) => {
      activities.push({
        type: 'claim',
        actor: `${c.reportedBy.firstName} ${c.reportedBy.lastName}`,
        description: `filed a ${c.damageType} damage claim`,
        timestamp: c.createdAt,
      });
    });

    tasks.forEach((t) => {
      if (t.status === 'completed') {
        activities.push({
          type: 'task_complete',
          actor: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : 'System',
          description: `completed task "${t.title}"`,
          timestamp: t.completedAt || t.updatedAt,
        });
      } else if (t.source === 'ai_generated') {
        activities.push({
          type: 'task_ai',
          actor: 'AI Task Engine',
          description: `generated task "${t.title}"`,
          timestamp: t.createdAt,
        });
      }
    });

    messages.filter((m) => m.messageType === 'announcement').forEach((m) => {
      activities.push({
        type: 'announcement',
        actor: `${m.user.firstName} ${m.user.lastName}`,
        description: `posted an announcement`,
        timestamp: m.createdAt,
      });
    });

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(activities.slice(0, 30));
  } catch (err) {
    console.error('Activity feed error:', err);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

module.exports = router;
