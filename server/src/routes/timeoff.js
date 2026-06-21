const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');
const { notify, notifyLocationManagers } = require('../services/notify');

// POST /:locationId/time-off — submit request
router.post('/:locationId/time-off', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { startDate, endDate, type, reason } = req.body;

    if (!startDate || !endDate || !type) {
      return res.status(400).json({ error: 'Start date, end date, and type are required' });
    }

    const validTypes = ['vacation', 'sick', 'personal'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    const request = await prisma.timeOffRequest.create({
      data: {
        userId: req.user.id,
        locationId: req.params.locationId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type,
        reason: reason || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify managers
    const io = req.app.get('io');
    await notifyLocationManagers({
      prisma, io,
      locationId: req.params.locationId,
      type: 'time_off_request',
      title: 'Time Off Request',
      message: `${req.user.firstName} ${req.user.lastName} requested ${type} time off (${startDate} – ${endDate})`,
      entityType: 'time_off',
      entityId: request.id,
    });

    io.to(`location:${req.params.locationId}`).emit('time-off-updated', request);
    req.audit('create', 'time_off', request.id, { type, startDate, endDate });

    res.status(201).json(request);
  } catch (err) {
    console.error('Time-off create error:', err);
    res.status(500).json({ error: 'Failed to create time-off request' });
  }
});

// GET /:locationId/time-off — list requests
router.get('/:locationId/time-off', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { status, userId, startDate, endDate } = req.query;

    const where = { locationId: req.params.locationId };

    // Non-managers can only see their own
    if (!['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(req.user.role)) {
      where.userId = req.user.id;
    } else if (userId) {
      where.userId = userId;
    }

    if (status) where.status = status;

    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.endDate = { lte: new Date(endDate) };
    }

    const requests = await prisma.timeOffRequest.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (err) {
    console.error('Time-off list error:', err);
    res.status(500).json({ error: 'Failed to fetch time-off requests' });
  }
});

// PATCH /:locationId/time-off/:id — update own pending request
router.patch('/:locationId/time-off/:id', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const existing = await prisma.timeOffRequest.findFirst({
      where: { id: req.params.id, userId: req.user.id, status: 'pending' },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    const { startDate, endDate, type, reason } = req.body;
    const updated = await prisma.timeOffRequest.update({
      where: { id: req.params.id },
      data: {
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(type && { type }),
        ...(reason !== undefined && { reason }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update time-off request' });
  }
});

// DELETE /:locationId/time-off/:id — cancel own pending request
router.delete('/:locationId/time-off/:id', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const existing = await prisma.timeOffRequest.findFirst({
      where: { id: req.params.id, userId: req.user.id, status: 'pending' },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    await prisma.timeOffRequest.delete({ where: { id: req.params.id } });
    req.audit('delete', 'time_off', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel time-off request' });
  }
});

// POST /:locationId/time-off/:id/approve — SITE_MANAGER+
router.post('/:locationId/time-off/:id/approve', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const io = req.app.get('io');
    const { reviewNotes } = req.body;

    const existing = await prisma.timeOffRequest.findFirst({
      where: { id: req.params.id, locationId: req.params.locationId, status: 'pending' },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedById: req.user.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await notify({
      prisma, io,
      userId: existing.userId,
      locationId: req.params.locationId,
      type: 'time_off_approved',
      title: 'Time Off Approved',
      message: `Your ${existing.type} time-off request has been approved by ${req.user.firstName} ${req.user.lastName}`,
      entityType: 'time_off',
      entityId: existing.id,
    });

    io.to(`location:${req.params.locationId}`).emit('time-off-updated', updated);
    req.audit('approve', 'time_off', req.params.id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// POST /:locationId/time-off/:id/deny — SITE_MANAGER+
router.post('/:locationId/time-off/:id/deny', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const io = req.app.get('io');
    const { reviewNotes } = req.body;

    const existing = await prisma.timeOffRequest.findFirst({
      where: { id: req.params.id, locationId: req.params.locationId, status: 'pending' },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id: req.params.id },
      data: {
        status: 'denied',
        approvedById: req.user.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await notify({
      prisma, io,
      userId: existing.userId,
      locationId: req.params.locationId,
      type: 'time_off_denied',
      title: 'Time Off Denied',
      message: `Your ${existing.type} time-off request was denied${reviewNotes ? ': ' + reviewNotes : ''}`,
      entityType: 'time_off',
      entityId: existing.id,
    });

    io.to(`location:${req.params.locationId}`).emit('time-off-updated', updated);
    req.audit('deny', 'time_off', req.params.id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to deny request' });
  }
});

// GET /:locationId/time-off/calendar — who's off per day for date range
router.get('/:locationId/time-off/calendar', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const approved = await prisma.timeOffRequest.findMany({
      where: {
        locationId: req.params.locationId,
        status: 'approved',
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    res.json(approved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch time-off calendar' });
  }
});

module.exports = router;
