const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// List incidents
router.get('/:locationId/incidents', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = { locationId: req.params.locationId };
    if (status) where.status = status;
    if (type) where.incidentType = type;

    const incidents = await prisma.incidentReport.findMany({
      where,
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Report incident
router.post('/:locationId/incidents', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { incidentType, title, description, photoUrls } = req.body;

    if (!incidentType || !title || !description) {
      return res.status(400).json({ error: 'Type, title, and description are required' });
    }

    const incident = await prisma.incidentReport.create({
      data: {
        locationId: req.params.locationId,
        reporterId: req.user.id,
        incidentType,
        title,
        description,
        photoUrls: JSON.stringify(photoUrls || []),
      },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('new-incident', incident);

    // Auto-create alert for critical incidents
    if (['damage', 'safety'].includes(incidentType)) {
      await prisma.systemAlert.create({
        data: {
          locationId: req.params.locationId,
          alertType: incidentType === 'damage' ? 'equipment' : 'maintenance',
          severity: 'high',
          title: `Incident: ${title}`,
          message: description.substring(0, 200),
        },
      });
    }

    res.status(201).json(incident);
  } catch (err) {
    res.status(500).json({ error: 'Failed to report incident' });
  }
});

// Update incident status
router.patch('/:locationId/incidents/:incidentId', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { status } = req.body;

    const incident = await prisma.incidentReport.update({
      where: { id: req.params.incidentId },
      data: {
        status,
        ...(status === 'resolved' && { resolvedAt: new Date() }),
      },
    });

    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

module.exports = router;
