const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');
const { validateClaim, validateClaimUpdate } = require('../middleware/validate');
const { notifyLocationManagers } = require('../services/notify');

const router = express.Router();
const prisma = new PrismaClient();

// List damage claims
router.get('/:locationId/claims', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { status, damageType, complaintType, severity } = req.query;
    const where = { locationId: req.params.locationId };
    if (status) where.status = status;
    if (damageType) where.damageType = damageType;
    if (complaintType) where.complaintType = complaintType;
    if (severity) where.severity = severity;

    const claims = await prisma.damageClaim.findMany({
      where,
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(claims);
  } catch (err) {
    console.error('Fetch claims error:', err);
    res.status(500).json({ error: 'Failed to fetch damage claims' });
  }
});

// File a damage claim
router.post('/:locationId/claims', authenticate, requireLocationAccess, validateClaim, async (req, res) => {
  try {
    const {
      customerId, vehicleMake, vehicleModel, vehicleYear, vehicleColor,
      licensePlate, description, damageType, photoUrls, estimatedCost,
      complaintType, severity, zone, locationBay, customerName, customerPhone,
      incidentAt, assignedToId,
    } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const claim = await prisma.damageClaim.create({
      data: {
        locationId: req.params.locationId,
        reportedById: req.user.id,
        customerId: customerId || null,
        complaintType: complaintType || 'unsatisfied',
        severity: severity || 'medium',
        zone: zone || null,
        locationBay: locationBay || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        incidentAt: incidentAt ? new Date(incidentAt) : null,
        assignedToId: assignedToId || null,
        vehicleMake: vehicleMake || null,
        vehicleModel: vehicleModel || null,
        vehicleYear: vehicleYear || null,
        vehicleColor: vehicleColor || null,
        licensePlate: licensePlate || null,
        description,
        damageType: damageType || 'other',
        photoUrls: JSON.stringify(photoUrls || []),
        estimatedCost: estimatedCost || null,
        status: assignedToId ? 'investigating' : 'reported',
      },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // The client submits the category as `complaintType`; use it for alert titles.
    const claimLabel = claim.complaintType || complaintType || 'other';

    // Create alert for new complaint
    await prisma.systemAlert.create({
      data: {
        locationId: req.params.locationId,
        alertType: 'equipment',
        severity: 'high',
        title: `Complaint Filed: ${claimLabel}`,
        message: description.substring(0, 200),
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('new-claim', claim);
    req.audit('create', 'claim', claim.id, { complaintType: claimLabel, description: description.substring(0, 100) });

    // Notify managers about new complaint
    notifyLocationManagers({
      prisma, io, locationId: req.params.locationId,
      type: 'claim', title: `New Complaint: ${claimLabel}`,
      message: description.substring(0, 200),
      entityType: 'claim', entityId: claim.id,
    });

    res.status(201).json(claim);
  } catch (err) {
    console.error('File claim error:', err);
    res.status(500).json({ error: 'Failed to file damage claim' });
  }
});

// Get claim detail
router.get('/:locationId/claims/:id', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const claim = await prisma.damageClaim.findFirst({
      where: { id: req.params.id, locationId: req.params.locationId },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        customer: {
          include: { vehicles: true },
        },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json(claim);
  } catch (err) {
    console.error('Fetch claim error:', err);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

// Update claim status / resolution
router.patch('/:locationId/claims/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), validateClaimUpdate, async (req, res) => {
  try {
    const { status, resolution, estimatedCost, assignedToId, severity } = req.body;

    const claim = await prisma.damageClaim.update({
      where: { id: req.params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(resolution !== undefined && { resolution }),
        ...(estimatedCost !== undefined && { estimatedCost }),
        ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
        ...(severity !== undefined && { severity }),
        ...(status === 'resolved' && { resolvedAt: new Date() }),
      },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('claim-updated', claim);
    req.audit('update', 'claim', req.params.id, { status });

    res.json(claim);
  } catch (err) {
    console.error('Update claim error:', err);
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

// Add photos to an existing claim
router.patch('/:locationId/claims/:id/photos', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { photoUrls } = req.body;
    if (!photoUrls || !Array.isArray(photoUrls)) {
      return res.status(400).json({ error: 'photoUrls array is required' });
    }

    const existing = await prisma.damageClaim.findFirst({
      where: { id: req.params.id, locationId: req.params.locationId },
    });
    if (!existing) return res.status(404).json({ error: 'Claim not found' });

    const currentPhotos = JSON.parse(existing.photoUrls || '[]');
    const merged = [...currentPhotos, ...photoUrls];

    const claim = await prisma.damageClaim.update({
      where: { id: req.params.id },
      data: { photoUrls: JSON.stringify(merged) },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(claim);
  } catch (err) {
    console.error('Add photos error:', err);
    res.status(500).json({ error: 'Failed to add photos' });
  }
});

module.exports = router;
