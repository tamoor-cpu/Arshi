const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');
const { validateEquipment, validateEquipmentUpdate, validateMaintenance } = require('../middleware/validate');
const { notifyLocationManagers } = require('../services/notify');

const router = express.Router();
const prisma = new PrismaClient();

// List equipment at location
router.get('/:locationId/equipment', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { category, status } = req.query;
    const where = { locationId: req.params.locationId };
    if (category) where.category = category;
    if (status) where.status = status;

    const equipment = await prisma.equipment.findMany({
      where,
      include: {
        maintenanceLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            performedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(equipment);
  } catch (err) {
    console.error('Fetch equipment error:', err);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Add equipment
router.post('/:locationId/equipment', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), validateEquipment, async (req, res) => {
  try {
    const { name, category, area, serialNumber, manufacturer, model, installDate, purchaseDate, purchaseCost, notes } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const equipment = await prisma.equipment.create({
      data: {
        locationId: req.params.locationId,
        name,
        category,
        area: area || 'other',
        serialNumber: serialNumber || null,
        manufacturer: manufacturer || null,
        model: model || null,
        installDate: installDate ? new Date(installDate) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchaseCost: purchaseCost != null && purchaseCost !== '' ? parseFloat(purchaseCost) : null,
        notes: notes || null,
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('equipment-added', equipment);
    req.audit('create', 'equipment', equipment.id, { name, category });

    res.status(201).json(equipment);
  } catch (err) {
    console.error('Create equipment error:', err);
    res.status(500).json({ error: 'Failed to add equipment' });
  }
});

// Update equipment
router.patch('/:locationId/equipment/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), validateEquipmentUpdate, async (req, res) => {
  try {
    const { name, category, area, serialNumber, manufacturer, model, installDate, purchaseDate, purchaseCost, status, notes } = req.body;

    const equipment = await prisma.equipment.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(area !== undefined && { area }),
        ...(serialNumber !== undefined && { serialNumber }),
        ...(manufacturer !== undefined && { manufacturer }),
        ...(model !== undefined && { model }),
        ...(installDate !== undefined && { installDate: installDate ? new Date(installDate) : null }),
        ...(purchaseDate !== undefined && { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }),
        ...(purchaseCost !== undefined && { purchaseCost: purchaseCost !== '' && purchaseCost != null ? parseFloat(purchaseCost) : null }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('equipment-updated', equipment);
    req.audit('update', 'equipment', req.params.id, { status, name });

    // Notify managers on critical status changes
    if (status === 'out_of_service' || status === 'needs_maintenance') {
      notifyLocationManagers({
        prisma, io, locationId: req.params.locationId,
        type: 'equipment',
        title: `Equipment ${status === 'out_of_service' ? 'Out of Service' : 'Needs Maintenance'}: ${equipment.name}`,
        message: `${equipment.name} status changed to ${status.replace(/_/g, ' ')}.`,
        entityType: 'equipment', entityId: equipment.id,
      });
    }

    res.json(equipment);
  } catch (err) {
    console.error('Update equipment error:', err);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// Get maintenance logs for equipment (filterable by category)
router.get('/:locationId/equipment/:id/maintenance', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const where = { equipmentId: req.params.id };
    if (req.query.category) where.category = req.query.category;

    const logs = await prisma.maintenanceLog.findMany({
      where,
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(logs);
  } catch (err) {
    console.error('Fetch maintenance logs error:', err);
    res.status(500).json({ error: 'Failed to fetch maintenance logs' });
  }
});

// Location-wide maintenance logs (preventive + inspection)
router.get('/:locationId/maintenance', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { status } = req.query;
    const where = {
      equipment: { locationId: req.params.locationId },
      category: 'maintenance',
    };
    if (status) where.status = status;

    const logs = await prisma.maintenanceLog.findMany({
      where,
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        equipment: { select: { id: true, name: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(logs);
  } catch (err) {
    console.error('Fetch maintenance logs error:', err);
    res.status(500).json({ error: 'Failed to fetch maintenance logs' });
  }
});

// Location-wide repair logs (repair + emergency)
router.get('/:locationId/repairs', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { status } = req.query;
    const where = {
      equipment: { locationId: req.params.locationId },
      category: 'repair',
    };
    if (status) where.status = status;

    const logs = await prisma.maintenanceLog.findMany({
      where,
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        equipment: { select: { id: true, name: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(logs);
  } catch (err) {
    console.error('Fetch repair logs error:', err);
    res.status(500).json({ error: 'Failed to fetch repair logs' });
  }
});

// Log maintenance
router.post('/:locationId/equipment/:id/maintenance', authenticate, requireLocationAccess, validateMaintenance, async (req, res) => {
  try {
    const { type, description, cost, partsUsed, scheduledDate, notes, mediaUrls } = req.body;

    if (!type || !description) {
      return res.status(400).json({ error: 'Type and description are required' });
    }

    // Auto-derive category from type
    const derivedCategory = ['repair', 'emergency'].includes(type) ? 'repair' : 'maintenance';

    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId: req.params.id,
        performedById: req.user.id,
        type,
        category: derivedCategory,
        description,
        cost: cost || null,
        partsUsed: JSON.stringify(partsUsed || []),
        mediaUrls: JSON.stringify(mediaUrls || []),
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        notes: notes || null,
      },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        equipment: { select: { id: true, name: true, category: true } },
      },
    });

    // If logging a repair or emergency, update equipment status
    if (['repair', 'emergency'].includes(type)) {
      await prisma.equipment.update({
        where: { id: req.params.id },
        data: { status: 'needs_maintenance' },
      });
    }

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('maintenance-logged', log);
    req.audit('create', 'maintenance', log.id, { type, equipmentId: req.params.id });

    res.status(201).json(log);
  } catch (err) {
    console.error('Log maintenance error:', err);
    res.status(500).json({ error: 'Failed to log maintenance' });
  }
});

// Update maintenance log status
router.patch('/:locationId/maintenance/:logId', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { status, notes } = req.body;

    const log = await prisma.maintenanceLog.update({
      where: { id: req.params.logId },
      data: {
        ...(status !== undefined && { status }),
        ...(status === 'completed' && { completedAt: new Date() }),
        ...(notes !== undefined && { notes }),
      },
    });

    // If maintenance completed, set equipment back to operational
    if (status === 'completed') {
      await prisma.equipment.update({
        where: { id: log.equipmentId },
        data: { status: 'operational' },
      });
    }

    res.json(log);
  } catch (err) {
    console.error('Update maintenance log error:', err);
    res.status(500).json({ error: 'Failed to update maintenance log' });
  }
});

// ==================== EQUIPMENT FILE (detail) ====================

// Full equipment file — info + maintenance + work orders + replacement parts (real-time)
router.get('/:locationId/equipment/:id/detail', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const equipment = await prisma.equipment.findFirst({
      where: { id: req.params.id, locationId: req.params.locationId },
      include: {
        maintenanceLogs: {
          include: { performedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        workOrders: {
          include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        partLinks: {
          include: {
            part: { include: { inventoryItem: { select: { id: true, name: true, currentStock: true, minStock: true, unit: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });

    const parts = equipment.partLinks.map((l) => ({
      linkId: l.id,
      quantityRequired: l.quantityRequired,
      notes: l.notes,
      ...l.part,
      inStock: l.part.inventoryItem ? l.part.inventoryItem.currentStock : null,
      inventoryUnit: l.part.inventoryItem ? l.part.inventoryItem.unit : null,
      inventoryLow: l.part.inventoryItem ? l.part.inventoryItem.currentStock <= l.part.inventoryItem.minStock : false,
    }));

    res.json({ ...equipment, partLinks: undefined, parts });
  } catch (err) {
    console.error('Equipment detail error:', err);
    res.status(500).json({ error: 'Failed to load equipment file' });
  }
});

// ==================== REPLACEMENT PARTS ====================

// All parts in the location catalog (for linking an existing part to equipment)
router.get('/:locationId/parts', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const parts = await prisma.part.findMany({
      where: { locationId: req.params.locationId },
      include: {
        inventoryItem: { select: { id: true, name: true, currentStock: true, unit: true } },
        equipmentLinks: { include: { equipment: { select: { id: true, name: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(parts.map((p) => ({ ...p, usedByCount: p.equipmentLinks.length, usedBy: p.equipmentLinks.map((l) => l.equipment) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load parts catalog' });
  }
});

// Add a replacement part to a piece of equipment.
// Either link an existing part (partId) or create a new one (name + fields).
router.post('/:locationId/equipment/:id/parts', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { partId, name, partNumber, manufacturer, specs, orderUrl, unitCost, inventoryItemId, quantityRequired, notes } = req.body;
    let part;

    if (partId) {
      part = await prisma.part.findFirst({ where: { id: partId, locationId: req.params.locationId } });
      if (!part) return res.status(404).json({ error: 'Part not found' });
    } else {
      if (!name) return res.status(400).json({ error: 'Part name is required' });
      part = await prisma.part.create({
        data: {
          locationId: req.params.locationId,
          name,
          partNumber: partNumber || null,
          manufacturer: manufacturer || null,
          specs: specs || null,
          orderUrl: orderUrl || null,
          unitCost: unitCost != null && unitCost !== '' ? parseFloat(unitCost) : null,
          inventoryItemId: inventoryItemId || null,
        },
      });
    }

    // Link to equipment (idempotent on the unique pair)
    const link = await prisma.equipmentPart.upsert({
      where: { equipmentId_partId: { equipmentId: req.params.id, partId: part.id } },
      update: { quantityRequired: quantityRequired != null ? parseInt(quantityRequired) || 1 : 1, notes: notes || null },
      create: { equipmentId: req.params.id, partId: part.id, quantityRequired: quantityRequired != null ? parseInt(quantityRequired) || 1 : 1, notes: notes || null },
    });
    req.audit('create', 'equipment_part', link.id, { equipmentId: req.params.id, partName: part.name });
    res.status(201).json({ link, part });
  } catch (err) {
    console.error('Add part error:', err);
    res.status(500).json({ error: 'Failed to add part' });
  }
});

// Update an existing part's catalog details
router.patch('/:locationId/parts/:partId', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, partNumber, manufacturer, specs, orderUrl, unitCost, inventoryItemId } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (partNumber !== undefined) data.partNumber = partNumber || null;
    if (manufacturer !== undefined) data.manufacturer = manufacturer || null;
    if (specs !== undefined) data.specs = specs || null;
    if (orderUrl !== undefined) data.orderUrl = orderUrl || null;
    if (unitCost !== undefined) data.unitCost = unitCost !== '' && unitCost != null ? parseFloat(unitCost) : null;
    if (inventoryItemId !== undefined) data.inventoryItemId = inventoryItemId || null;
    const part = await prisma.part.update({ where: { id: req.params.partId }, data });
    res.json(part);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update part' });
  }
});

// Unlink a part from a piece of equipment (keeps the part in the catalog)
router.delete('/:locationId/equipment/:id/parts/:linkId', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.equipmentPart.delete({ where: { id: req.params.linkId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove part' });
  }
});

module.exports = router;
