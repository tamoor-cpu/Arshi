const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get messages for location
router.get('/:locationId/messages', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { type, limit, before } = req.query;
    const where = { locationId: req.params.locationId };
    if (type) where.messageType = type;
    if (before) where.createdAt = { lt: new Date(before) };

    const messages = await prisma.message.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit) || 50,
    });

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
router.post('/:locationId/messages', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { messageText, messageType, threadId } = req.body;

    if (!messageText || !messageText.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Only managers+ can send announcements
    if (messageType === 'announcement' && !['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only managers can send announcements' });
    }

    const message = await prisma.message.create({
      data: {
        locationId: req.params.locationId,
        userId: req.user.id,
        messageText: messageText.trim(),
        messageType: messageType || 'chat',
        threadId,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('new-message', message);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get announcements
router.get('/:locationId/announcements', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const announcements = await prisma.message.findMany({
      where: {
        locationId: req.params.locationId,
        messageType: 'announcement',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

module.exports = router;
