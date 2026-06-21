const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// GET /api/v1/notifications — list user's notifications (paginated)
router.get('/', authenticate, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { page = 1, limit = 30, isRead } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId: req.user.id };
    if (isRead === 'true') where.isRead = true;
    if (isRead === 'false') where.isRead = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      data: notifications,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error('Notifications list error:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// GET /api/v1/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

module.exports = router;
