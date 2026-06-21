const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ==================== GAUGES ====================

router.get('/:locationId/gauges', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const gauges = await prisma.gauge.findMany({
      where: { locationId: req.params.locationId },
      orderBy: { name: 'asc' },
    });
    res.json(gauges);
  } catch (err) {
    console.error('List gauges error:', err);
    res.status(500).json({ error: 'Failed to load gauges' });
  }
});

router.post('/:locationId/gauges', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, category, unit, targetMin, targetMax } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const gauge = await prisma.gauge.create({
      data: {
        locationId: req.params.locationId,
        name,
        category: category || 'pressure',
        unit: unit || '',
        targetMin: targetMin != null && targetMin !== '' ? parseFloat(targetMin) : null,
        targetMax: targetMax != null && targetMax !== '' ? parseFloat(targetMax) : null,
      },
    });
    req.audit('create', 'gauge', gauge.id, { name });
    res.status(201).json(gauge);
  } catch (err) {
    console.error('Create gauge error:', err);
    res.status(500).json({ error: 'Failed to create gauge' });
  }
});

router.patch('/:locationId/gauges/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, category, unit, targetMin, targetMax } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (unit !== undefined) data.unit = unit;
    if (targetMin !== undefined) data.targetMin = targetMin !== '' && targetMin != null ? parseFloat(targetMin) : null;
    if (targetMax !== undefined) data.targetMax = targetMax !== '' && targetMax != null ? parseFloat(targetMax) : null;
    const gauge = await prisma.gauge.update({ where: { id: req.params.id }, data });
    res.json(gauge);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update gauge' });
  }
});

router.delete('/:locationId/gauges/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.gauge.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete gauge' });
  }
});

// Log a reading (any user) — updates the gauge's last value
router.post('/:locationId/gauges/:id/readings', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { value, notes } = req.body;
    if (value == null || value === '') return res.status(400).json({ error: 'Value is required' });
    const v = parseFloat(value);
    const reading = await prisma.gaugeReading.create({
      data: { gaugeId: req.params.id, value: v, recordedById: req.user.id, notes: notes || null },
    });
    await prisma.gauge.update({ where: { id: req.params.id }, data: { lastValue: v, lastReadingAt: new Date() } });
    req.audit('create', 'gauge_reading', reading.id, { value: v });
    res.status(201).json(reading);
  } catch (err) {
    console.error('Log reading error:', err);
    res.status(500).json({ error: 'Failed to log reading' });
  }
});

router.get('/:locationId/gauges/:id/readings', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const readings = await prisma.gaugeReading.findMany({
      where: { gaugeId: req.params.id },
      include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(readings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load readings' });
  }
});

// ==================== SOPs ====================

router.get('/:locationId/sops', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const sops = await prisma.sOP.findMany({
      where: { locationId: req.params.locationId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(sops);
  } catch (err) {
    console.error('List SOPs error:', err);
    res.status(500).json({ error: 'Failed to load SOPs' });
  }
});

router.post('/:locationId/sops', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { title, category, content, published } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const sop = await prisma.sOP.create({
      data: {
        locationId: req.params.locationId,
        title,
        category: category || 'operations',
        content: content || '',
        published: published !== false,
        createdById: req.user.id,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    req.audit('create', 'sop', sop.id, { title });
    res.status(201).json(sop);
  } catch (err) {
    console.error('Create SOP error:', err);
    res.status(500).json({ error: 'Failed to create SOP' });
  }
});

router.patch('/:locationId/sops/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { title, category, content, published } = req.body;
    const existing = await prisma.sOP.findUnique({ where: { id: req.params.id } });
    const data = {};
    if (title !== undefined) data.title = title;
    if (category !== undefined) data.category = category;
    if (content !== undefined) { data.content = content; if (existing) data.version = existing.version + 1; }
    if (published !== undefined) data.published = !!published;
    const sop = await prisma.sOP.update({
      where: { id: req.params.id }, data,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(sop);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update SOP' });
  }
});

router.delete('/:locationId/sops/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.sOP.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete SOP' });
  }
});

module.exports = router;
