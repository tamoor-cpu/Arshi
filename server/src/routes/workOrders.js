const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');
const { notify, notifyLocationManagers } = require('../services/notify');

const router = express.Router();
const prisma = new PrismaClient();

const userSelect = { select: { id: true, firstName: true, lastName: true } };

// List work orders
router.get('/:locationId/work-orders', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { status, priority, assignedToId, search } = req.query;
    const where = { locationId: req.params.locationId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { ticketNumber: { contains: search } },
    ];
    const orders = await prisma.workOrder.findMany({
      where,
      include: { assignedTo: userSelect, createdBy: userSelect },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(orders.map((o) => ({ ...o, photoUrls: safeParse(o.photoUrls) })));
  } catch (err) {
    console.error('List work orders error:', err);
    res.status(500).json({ error: 'Failed to load work orders' });
  }
});

// Create work order
router.post('/:locationId/work-orders', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { title, description, equipmentId, equipmentName, zone, priority, assignedToId, photoUrls } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    // Resolve equipment name from id if linked to a specific piece of equipment
    let resolvedName = equipmentName || null;
    if (equipmentId) {
      const eq = await prisma.equipment.findFirst({ where: { id: equipmentId, locationId: req.params.locationId } });
      if (eq) resolvedName = eq.name;
    }

    const count = await prisma.workOrder.count({ where: { locationId: req.params.locationId } });
    const order = await prisma.workOrder.create({
      data: {
        locationId: req.params.locationId,
        ticketNumber: 'WO-' + String(1001 + count),
        title,
        description: description || null,
        equipmentId: equipmentId || null,
        equipmentName: resolvedName,
        zone: zone || null,
        priority: priority || 'normal',
        assignedToId: assignedToId || null,
        createdById: req.user.id,
        photoUrls: JSON.stringify(Array.isArray(photoUrls) ? photoUrls : []),
        status: assignedToId ? 'in_progress' : 'open',
        startedAt: assignedToId ? new Date() : null,
      },
      include: { assignedTo: userSelect, createdBy: userSelect },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('work-order-created', order);
    req.audit('create', 'work_order', order.id, { ticketNumber: order.ticketNumber, title });

    if (assignedToId) {
      notify({
        prisma, io, userId: assignedToId, locationId: req.params.locationId,
        type: 'work_order', title: `Work Order Assigned: ${order.ticketNumber}`,
        message: title, entityType: 'work_order', entityId: order.id,
      });
    } else {
      notifyLocationManagers({
        prisma, io, locationId: req.params.locationId,
        type: 'work_order', title: `New Work Order: ${order.ticketNumber}`,
        message: title, entityType: 'work_order', entityId: order.id,
      });
    }

    res.status(201).json({ ...order, photoUrls: safeParse(order.photoUrls) });
  } catch (err) {
    console.error('Create work order error:', err);
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

// Update / transition work order
router.patch('/:locationId/work-orders/:id', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { title, description, equipmentName, zone, priority, status, assignedToId, resolution } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (equipmentName !== undefined) data.equipmentName = equipmentName;
    if (zone !== undefined) data.zone = zone;
    if (priority !== undefined) data.priority = priority;
    if (resolution !== undefined) data.resolution = resolution;
    if (assignedToId !== undefined) {
      data.assignedToId = assignedToId || null;
      if (assignedToId) { data.status = 'in_progress'; data.startedAt = new Date(); }
    }
    if (status !== undefined) {
      data.status = status;
      if (status === 'in_progress' && !data.startedAt) data.startedAt = new Date();
      if (status === 'completed') data.completedAt = new Date();
      if (status === 'approved') data.approvedAt = new Date();
    }

    const order = await prisma.workOrder.update({
      where: { id: req.params.id }, data,
      include: { assignedTo: userSelect, createdBy: userSelect },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('work-order-updated', order);
    req.audit('update', 'work_order', order.id, { status: data.status });

    res.json({ ...order, photoUrls: safeParse(order.photoUrls) });
  } catch (err) {
    console.error('Update work order error:', err);
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

router.delete('/:locationId/work-orders/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.workOrder.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete work order' });
  }
});

function safeParse(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }

module.exports = router;
