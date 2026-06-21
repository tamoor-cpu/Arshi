const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');
const { maybeAutoReorder } = require('../services/autoReorder');

const router = express.Router();
const prisma = new PrismaClient();

// ==================== CHEMICALS ====================

// List chemicals for a location
router.get('/:locationId/chemicals', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const chemicals = await prisma.chemical.findMany({
      where: { locationId: req.params.locationId },
      include: { sdsEntry: { select: { id: true, chemicalName: true, signalWord: true, fileUrl: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(chemicals);
  } catch (err) {
    console.error('List chemicals error:', err);
    res.status(500).json({ error: 'Failed to load chemicals' });
  }
});

// Create chemical
router.post('/:locationId/chemicals', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, type, tankCapacity, currentLevel, dilutionRatio, supplier, costPerGallon, reorderPoint, sdsEntryId, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const chemical = await prisma.chemical.create({
      data: {
        locationId: req.params.locationId,
        name,
        type: type || 'other',
        tankCapacity: tankCapacity != null ? parseFloat(tankCapacity) : null,
        currentLevel: currentLevel != null ? parseFloat(currentLevel) : 0,
        dilutionRatio: dilutionRatio || null,
        supplier: supplier || null,
        costPerGallon: costPerGallon != null ? parseFloat(costPerGallon) : null,
        reorderPoint: reorderPoint != null ? parseFloat(reorderPoint) : null,
        sdsEntryId: sdsEntryId || null,
        notes: notes || null,
      },
    });
    req.audit('create', 'chemical', chemical.id, { name });
    res.status(201).json(chemical);
  } catch (err) {
    console.error('Create chemical error:', err);
    res.status(500).json({ error: 'Failed to create chemical' });
  }
});

// Update chemical (incl. tank level adjustments)
router.patch('/:locationId/chemicals/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, type, tankCapacity, currentLevel, dilutionRatio, supplier, costPerGallon, reorderPoint, sdsEntryId, notes, refill } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (tankCapacity !== undefined) data.tankCapacity = tankCapacity != null ? parseFloat(tankCapacity) : null;
    if (currentLevel !== undefined) data.currentLevel = parseFloat(currentLevel) || 0;
    if (dilutionRatio !== undefined) data.dilutionRatio = dilutionRatio || null;
    if (supplier !== undefined) data.supplier = supplier || null;
    if (costPerGallon !== undefined) data.costPerGallon = costPerGallon != null ? parseFloat(costPerGallon) : null;
    if (reorderPoint !== undefined) data.reorderPoint = reorderPoint != null ? parseFloat(reorderPoint) : null;
    if (sdsEntryId !== undefined) data.sdsEntryId = sdsEntryId || null;
    if (notes !== undefined) data.notes = notes || null;
    if (refill) { data.lastRefilledAt = new Date(); }

    const chemical = await prisma.chemical.update({ where: { id: req.params.id }, data });
    req.audit('update', 'chemical', chemical.id);

    // Auto-reorder when the tank drops to/below its reorder point
    if (chemical.reorderPoint != null && chemical.currentLevel <= chemical.reorderPoint) {
      const refillQty = chemical.tankCapacity ? Math.ceil(chemical.tankCapacity - chemical.currentLevel) : 1;
      maybeAutoReorder(prisma, {
        locationId: req.params.locationId,
        itemName: chemical.name,
        supplier: chemical.supplier,
        qty: refillQty,
        unit: 'gal',
        costPerUnit: chemical.costPerGallon,
      });
    }

    res.json(chemical);
  } catch (err) {
    console.error('Update chemical error:', err);
    res.status(500).json({ error: 'Failed to update chemical' });
  }
});

// Delete chemical
router.delete('/:locationId/chemicals/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.chemical.delete({ where: { id: req.params.id } });
    req.audit('delete', 'chemical', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete chemical' });
  }
});

// ==================== SDS LIBRARY ====================

// List SDS entries
router.get('/:locationId/sds', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { includeArchived } = req.query;
    const entries = await prisma.sDSEntry.findMany({
      where: { locationId: req.params.locationId, ...(includeArchived === 'true' ? {} : { archived: false }) },
      orderBy: { chemicalName: 'asc' },
    });
    res.json(entries.map((e) => ({ ...e, ppe: safeParse(e.ppe) })));
  } catch (err) {
    console.error('List SDS error:', err);
    res.status(500).json({ error: 'Failed to load SDS library' });
  }
});

// Chemicals missing an SDS (for the "Action Required" banner)
router.get('/:locationId/sds/missing', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const missing = await prisma.chemical.findMany({
      where: { locationId: req.params.locationId, sdsEntryId: null },
      select: { id: true, name: true, supplier: true },
      orderBy: { name: 'asc' },
    });
    res.json(missing);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load missing SDS list' });
  }
});

// Create SDS entry
router.post('/:locationId/sds', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { chemicalName, manufacturer, fileUrl, hazardClass, signalWord, ppe } = req.body;
    if (!chemicalName) return res.status(400).json({ error: 'Chemical name is required' });

    const entry = await prisma.sDSEntry.create({
      data: {
        locationId: req.params.locationId,
        chemicalName,
        manufacturer: manufacturer || null,
        fileUrl: fileUrl || null,
        hazardClass: hazardClass || null,
        signalWord: signalWord || null,
        ppe: JSON.stringify(Array.isArray(ppe) ? ppe : []),
      },
    });
    req.audit('create', 'sds_entry', entry.id, { chemicalName });
    res.status(201).json({ ...entry, ppe: safeParse(entry.ppe) });
  } catch (err) {
    console.error('Create SDS error:', err);
    res.status(500).json({ error: 'Failed to create SDS entry' });
  }
});

// Update / archive SDS entry
router.patch('/:locationId/sds/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { chemicalName, manufacturer, fileUrl, hazardClass, signalWord, ppe, archived } = req.body;
    const data = {};
    if (chemicalName !== undefined) data.chemicalName = chemicalName;
    if (manufacturer !== undefined) data.manufacturer = manufacturer || null;
    if (fileUrl !== undefined) data.fileUrl = fileUrl || null;
    if (hazardClass !== undefined) data.hazardClass = hazardClass || null;
    if (signalWord !== undefined) data.signalWord = signalWord || null;
    if (ppe !== undefined) data.ppe = JSON.stringify(Array.isArray(ppe) ? ppe : []);
    if (archived !== undefined) data.archived = !!archived;

    const entry = await prisma.sDSEntry.update({ where: { id: req.params.id }, data });
    res.json({ ...entry, ppe: safeParse(entry.ppe) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update SDS entry' });
  }
});

router.delete('/:locationId/sds/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.sDSEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete SDS entry' });
  }
});

function safeParse(s) {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

module.exports = router;
