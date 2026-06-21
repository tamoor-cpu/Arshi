const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');
const { validateInventoryItem, validateUsageLog } = require('../middleware/validate');
const { notifyLocationManagers } = require('../services/notify');
const { maybeAutoReorder } = require('../services/autoReorder');

const router = express.Router();
const prisma = new PrismaClient();

// List inventory items
router.get('/:locationId/inventory', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { category, lowStock } = req.query;
    const where = { locationId: req.params.locationId, isActive: true };
    if (category) where.category = category;

    let items = await prisma.inventoryItem.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Filter low stock items if requested
    if (lowStock === 'true') {
      items = items.filter((item) => item.currentStock <= item.minStock);
    }

    res.json(items);
  } catch (err) {
    console.error('Fetch inventory error:', err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Add inventory item
router.post('/:locationId/inventory', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), validateInventoryItem, async (req, res) => {
  try {
    const { name, category, unit, currentStock, minStock, maxStock, costPerUnit, supplierId } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        locationId: req.params.locationId,
        name,
        category,
        unit: unit || 'each',
        currentStock: currentStock || 0,
        minStock: minStock || 0,
        maxStock: maxStock || null,
        costPerUnit: costPerUnit || null,
        supplierId: supplierId || null,
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });
    req.audit('create', 'inventory', item.id, { name, category });

    res.status(201).json(item);
  } catch (err) {
    console.error('Create inventory item error:', err);
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
});

// Update inventory item
router.patch('/:locationId/inventory/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, category, unit, minStock, maxStock, costPerUnit, supplierId, isActive } = req.body;

    const item = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(unit !== undefined && { unit }),
        ...(minStock !== undefined && { minStock }),
        ...(maxStock !== undefined && { maxStock }),
        ...(costPerUnit !== undefined && { costPerUnit }),
        ...(supplierId !== undefined && { supplierId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        supplier: { select: { id: true, name: true } },
      },
    });

    res.json(item);
  } catch (err) {
    console.error('Update inventory item error:', err);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// Log usage / restock (updates currentStock)
router.post('/:locationId/inventory/:id/usage', authenticate, requireLocationAccess, validateUsageLog, async (req, res) => {
  try {
    const { quantity, type, notes } = req.body;

    if (quantity === undefined || !type) {
      return res.status(400).json({ error: 'Quantity and type are required' });
    }

    // Create the usage log and update stock in a transaction
    const [log, item] = await prisma.$transaction([
      prisma.inventoryUsageLog.create({
        data: {
          itemId: req.params.id,
          userId: req.user.id,
          quantity,
          type,
          notes: notes || null,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.inventoryItem.update({
        where: { id: req.params.id },
        data: {
          currentStock: { increment: quantity }, // negative quantity = usage
        },
      }),
    ]);

    // Check for low stock alert
    if (item.currentStock <= item.minStock) {
      await prisma.systemAlert.create({
        data: {
          locationId: req.params.locationId,
          alertType: 'chemical',
          severity: item.currentStock <= 0 ? 'critical' : 'high',
          title: `Low Stock: ${item.name}`,
          message: `${item.name} is at ${item.currentStock} ${item.unit} (minimum: ${item.minStock})`,
        },
      });

      const io = req.app.get('io');
      io.to(`location:${req.params.locationId}`).emit('low-stock-alert', { item, currentStock: item.currentStock });

      // Notify managers about low stock
      notifyLocationManagers({
        prisma, io, locationId: req.params.locationId,
        type: 'inventory',
        title: `Low Stock: ${item.name}`,
        message: `${item.name} is at ${item.currentStock} ${item.unit} (minimum: ${item.minStock}).`,
        entityType: 'inventory', entityId: item.id,
      });

      // Auto-generate a reorder purchase order
      const reorderQty = item.maxStock ? Math.ceil(item.maxStock - item.currentStock) : Math.max(1, Math.ceil(item.minStock));
      maybeAutoReorder(prisma, {
        locationId: req.params.locationId,
        itemName: item.name,
        qty: reorderQty,
        unit: item.unit,
        costPerUnit: item.costPerUnit,
      });
    }

    req.audit('create', 'inventory_usage', log.id, { itemId: req.params.id, type, quantity });

    res.status(201).json({ log, currentStock: item.currentStock });
  } catch (err) {
    console.error('Log usage error:', err);
    res.status(500).json({ error: 'Failed to log usage' });
  }
});

// Bulk restock multiple items
router.post('/:locationId/inventory/bulk/restock', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { items } = req.body; // [{ itemId, quantity, notes }]
    if (!items?.length) return res.status(400).json({ error: 'Items array required' });

    const operations = [];
    for (const { itemId, quantity, notes } of items) {
      if (!itemId || !quantity || quantity <= 0) continue;
      operations.push(
        prisma.inventoryUsageLog.create({
          data: { itemId, userId: req.user.id, quantity, type: 'restock', notes: notes || 'Bulk restock' },
        }),
        prisma.inventoryItem.update({
          where: { id: itemId },
          data: { currentStock: { increment: quantity } },
        })
      );
    }

    await prisma.$transaction(operations);

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('inventory-bulk-restocked', { count: items.length });
    req.audit('create', 'inventory_usage', null, { action: 'bulk_restock', itemCount: items.length });

    res.json({ restocked: items.filter(i => i.quantity > 0).length });
  } catch (err) {
    console.error('Bulk restock error:', err);
    res.status(500).json({ error: 'Failed to bulk restock' });
  }
});

// Cycle count — SET each item's currentStock to the physically counted value (not an increment)
router.post('/:locationId/inventory/cycle-count', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { counts } = req.body; // [{ itemId, countedQuantity, notes }]
    if (!counts?.length) return res.status(400).json({ error: 'Counts array required' });

    // Load current stock so we can log the delta as an adjustment
    const ids = counts.map((c) => c.itemId).filter(Boolean);
    const existing = await prisma.inventoryItem.findMany({
      where: { id: { in: ids }, locationId: req.params.locationId },
      select: { id: true, currentStock: true },
    });
    const stockById = Object.fromEntries(existing.map((i) => [i.id, i.currentStock]));

    const operations = [];
    let counted = 0;
    for (const { itemId, countedQuantity, notes } of counts) {
      if (!itemId || countedQuantity == null || countedQuantity === '') continue;
      if (!(itemId in stockById)) continue;
      const target = parseFloat(countedQuantity);
      if (Number.isNaN(target)) continue;
      const delta = target - stockById[itemId];
      counted += 1;
      operations.push(
        prisma.inventoryUsageLog.create({
          data: {
            itemId,
            userId: req.user.id,
            quantity: delta, // signed adjustment from counted value
            type: 'adjustment',
            notes: notes || `Cycle count: set to ${target}`,
          },
        }),
        prisma.inventoryItem.update({
          where: { id: itemId },
          data: { currentStock: target }, // SET to absolute counted value
        })
      );
    }

    if (operations.length === 0) return res.status(400).json({ error: 'No valid counts provided' });

    await prisma.$transaction(operations);

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('inventory-cycle-counted', { count: counted });
    req.audit('update', 'inventory_usage', null, { action: 'cycle_count', itemCount: counted });

    res.json({ counted });
  } catch (err) {
    console.error('Cycle count error:', err);
    res.status(500).json({ error: 'Failed to record cycle count' });
  }
});

// Get usage history for item
router.get('/:locationId/inventory/:id/history', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const logs = await prisma.inventoryUsageLog.findMany({
      where: { itemId: req.params.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(logs);
  } catch (err) {
    console.error('Fetch usage history error:', err);
    res.status(500).json({ error: 'Failed to fetch usage history' });
  }
});

module.exports = router;
