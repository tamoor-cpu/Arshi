const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// List locations accessible to user
router.get('/', authenticate, async (req, res) => {
  try {
    let where = { tenantId: req.tenantId };

    // Employees/managers only see assigned locations
    if (['EMPLOYEE', 'SITE_MANAGER'].includes(req.user.role)) {
      const locationIds = req.user.userLocations.map((ul) => ul.locationId);
      where.id = { in: locationIds };
    }

    const locations = await prisma.location.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Create location
router.post('/', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const { name, address, city, state, zipCode, latitude, longitude, geofenceRadius, timezone } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const location = await prisma.location.create({
      data: {
        tenantId: req.tenantId,
        name,
        address,
        city,
        state,
        zipCode,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        geofenceRadius: geofenceRadius || 150,
        timezone: timezone || 'America/Chicago',
      },
    });

    res.status(201).json(location);
  } catch (err) {
    console.error('Create location error:', err);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// Get location details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const location = await prisma.location.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        userLocations: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(location);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

// Update location
router.patch('/:id', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, address, city, state, zipCode, latitude, longitude, geofenceRadius, timezone } = req.body;

    const location = await prisma.location.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zipCode !== undefined && { zipCode }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(geofenceRadius && { geofenceRadius: parseInt(geofenceRadius) }),
        ...(timezone && { timezone }),
      },
    });

    if (location.count === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const updated = await prisma.location.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

module.exports = router;
