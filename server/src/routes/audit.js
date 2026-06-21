const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get audit logs (admin only, tenant-scoped)
router.get('/', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, entity, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { tenantId: req.user.tenantId };
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Resolve user names for the logs
    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const userMap = {};
    users.forEach((u) => { userMap[u.id] = u; });

    const enrichedLogs = logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
      user: userMap[log.userId] || { firstName: 'Unknown', lastName: 'User' },
    }));

    res.json({
      logs: enrichedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Fetch audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
