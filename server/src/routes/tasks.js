const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');
const { validateTask, validateTaskUpdate } = require('../middleware/validate');
const { notify } = require('../services/notify');

const router = express.Router();
const prisma = new PrismaClient();

// List tasks (paginated)
router.get('/:locationId/tasks', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { status, priority, assignedToId, category, page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { locationId: req.params.locationId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;
    if (category) where.category = category;

    const [tasks, total] = await Promise.all([
      prisma.aITask.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [
          { status: 'asc' },
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: parseInt(limit),
      }),
      prisma.aITask.count({ where }),
    ]);

    res.json({
      data: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Fetch tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/:locationId/tasks', authenticate, requireLocationAccess, validateTask, async (req, res) => {
  try {
    const { title, description, priority, category, assignedToId, dueBy, source, aiReason,
            frequency, shiftPeriod, required, listName } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required' });
    }

    const task = await prisma.aITask.create({
      data: {
        locationId: req.params.locationId,
        createdById: req.user.id,
        title,
        description: description || null,
        priority: priority || 'medium',
        category,
        source: source || 'manual',
        assignedToId: assignedToId || null,
        dueBy: dueBy ? new Date(dueBy) : null,
        aiReason: aiReason || null,
        frequency: frequency || 'once',
        shiftPeriod: shiftPeriod || null,
        required: required ?? false,
        listName: listName || null,
        status: assignedToId ? 'assigned' : 'pending',
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('task-created', task);
    req.audit('create', 'task', task.id, { title, category, source: source || 'manual' });

    // Notify assignee if task is assigned
    if (assignedToId) {
      notify({
        prisma, io, userId: assignedToId, locationId: req.params.locationId,
        type: 'task', title: `Task Assigned: ${title}`,
        message: description ? description.substring(0, 200) : `You have been assigned a new ${category} task.`,
        entityType: 'task', entityId: task.id,
      });
    }

    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.patch('/:locationId/tasks/:id', authenticate, requireLocationAccess, validateTaskUpdate, async (req, res) => {
  try {
    const { status, assignedToId, priority, dueBy, description,
            title, frequency, shiftPeriod, required, listName } = req.body;

    const data = {};
    if (status !== undefined) data.status = status;
    if (assignedToId !== undefined) {
      data.assignedToId = assignedToId;
      if (assignedToId && !data.status) data.status = 'assigned';
    }
    if (priority !== undefined) data.priority = priority;
    if (dueBy !== undefined) data.dueBy = dueBy ? new Date(dueBy) : null;
    if (description !== undefined) data.description = description;
    if (title !== undefined) data.title = title;
    if (frequency !== undefined) data.frequency = frequency;
    if (shiftPeriod !== undefined) data.shiftPeriod = shiftPeriod;
    if (required !== undefined) data.required = required;
    if (listName !== undefined) data.listName = listName;
    if (status === 'completed') data.completedAt = new Date();

    const task = await prisma.aITask.update({
      where: { id: req.params.id },
      data,
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('task-updated', task);
    req.audit('update', 'task', req.params.id, { status, assignedToId });

    // Notify assignee when task is assigned to them
    if (assignedToId && assignedToId !== req.user.id) {
      notify({
        prisma, io, userId: assignedToId, locationId: req.params.locationId,
        type: 'task', title: `Task Assigned: ${task.title}`,
        message: `You have been assigned the task "${task.title}".`,
        entityType: 'task', entityId: task.id,
      });
    }

    res.json(task);
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Bulk assign tasks
router.patch('/:locationId/tasks/bulk/assign', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { taskIds, assignedToId } = req.body;
    if (!taskIds?.length || !assignedToId) return res.status(400).json({ error: 'taskIds and assignedToId are required' });

    await prisma.$transaction(
      taskIds.map((id) => prisma.aITask.update({ where: { id }, data: { assignedToId, status: 'assigned' } }))
    );

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('tasks-bulk-updated', { action: 'assign', count: taskIds.length });
    res.json({ updated: taskIds.length });
  } catch (err) {
    console.error('Bulk assign error:', err);
    res.status(500).json({ error: 'Failed to bulk assign' });
  }
});

// Bulk complete tasks
router.patch('/:locationId/tasks/bulk/complete', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!taskIds?.length) return res.status(400).json({ error: 'taskIds required' });

    await prisma.$transaction(
      taskIds.map((id) => prisma.aITask.update({ where: { id }, data: { status: 'completed', completedAt: new Date() } }))
    );

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('tasks-bulk-updated', { action: 'complete', count: taskIds.length });
    res.json({ updated: taskIds.length });
  } catch (err) {
    console.error('Bulk complete error:', err);
    res.status(500).json({ error: 'Failed to bulk complete' });
  }
});

// Bulk delete tasks
router.delete('/:locationId/tasks/bulk', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!taskIds?.length) return res.status(400).json({ error: 'taskIds required' });

    await prisma.aITask.deleteMany({ where: { id: { in: taskIds }, locationId: req.params.locationId } });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('tasks-bulk-updated', { action: 'delete', count: taskIds.length });
    res.json({ deleted: taskIds.length });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// AI-Generate tasks based on current conditions
router.post('/:locationId/tasks/generate', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const locationId = req.params.locationId;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const generatedTasks = [];

    // 1. Check for unacknowledged critical/high alerts
    const activeAlerts = await prisma.systemAlert.findMany({
      where: {
        locationId,
        acknowledgedAt: null,
        severity: { in: ['critical', 'high'] },
      },
    });

    for (const alert of activeAlerts) {
      generatedTasks.push({
        title: `Respond to alert: ${alert.title}`,
        description: alert.message,
        priority: alert.severity === 'critical' ? 'critical' : 'high',
        category: alert.alertType === 'chemical' ? 'chemical' : 'maintenance',
        source: 'ai_generated',
        aiReason: `Active ${alert.severity} alert since ${alert.createdAt.toISOString().split('T')[0]}`,
      });
    }

    // 2. Check for low inventory
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        locationId,
        isActive: true,
      },
    });

    for (const item of lowStockItems) {
      if (item.currentStock <= item.minStock) {
        generatedTasks.push({
          title: `Reorder: ${item.name}`,
          description: `Current stock: ${item.currentStock} ${item.unit}. Minimum: ${item.minStock} ${item.unit}`,
          priority: item.currentStock <= 0 ? 'critical' : 'high',
          category: 'chemical',
          source: 'ai_generated',
          aiReason: `Stock at ${item.currentStock}/${item.minStock} ${item.unit}`,
        });
      }
    }

    // 3. Check for equipment needing maintenance
    const needsMaint = await prisma.equipment.findMany({
      where: {
        locationId,
        status: { in: ['needs_maintenance', 'out_of_service'] },
      },
    });

    for (const eq of needsMaint) {
      generatedTasks.push({
        title: `Service equipment: ${eq.name}`,
        description: `${eq.name} is currently ${eq.status.replace('_', ' ')}. ${eq.notes || ''}`.trim(),
        priority: eq.status === 'out_of_service' ? 'critical' : 'high',
        category: 'maintenance',
        source: 'ai_generated',
        aiReason: `Equipment status: ${eq.status}`,
      });
    }

    // 4. Check for incomplete checklists from today
    const incompleteChecklists = await prisma.completedChecklist.findMany({
      where: {
        locationId,
        startedAt: { gte: todayStart },
        status: 'in_progress',
      },
      include: {
        template: { select: { name: true, type: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });

    for (const cl of incompleteChecklists) {
      generatedTasks.push({
        title: `Complete checklist: ${cl.template.name}`,
        description: `Started by ${cl.user.firstName} ${cl.user.lastName} but not yet completed`,
        priority: 'medium',
        category: 'cleaning',
        source: 'ai_generated',
        aiReason: `Checklist in progress since ${cl.startedAt.toISOString().split('T')[0]}`,
      });
    }

    // 5. Check for unresolved incidents
    const openIncidents = await prisma.incidentReport.findMany({
      where: {
        locationId,
        status: { in: ['open', 'investigating'] },
      },
    });

    for (const inc of openIncidents) {
      generatedTasks.push({
        title: `Resolve incident: ${inc.title}`,
        description: inc.description.substring(0, 200),
        priority: inc.incidentType === 'safety' ? 'critical' : 'high',
        category: inc.incidentType === 'equipment' ? 'maintenance' : 'other',
        source: 'ai_generated',
        aiReason: `Open ${inc.incidentType} incident since ${inc.createdAt.toISOString().split('T')[0]}`,
      });
    }

    // Create all generated tasks
    const createdTasks = [];
    for (const taskData of generatedTasks) {
      const task = await prisma.aITask.create({
        data: {
          locationId,
          createdById: req.user.id,
          ...taskData,
        },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      createdTasks.push(task);
    }

    const io = req.app.get('io');
    io.to(`location:${locationId}`).emit('tasks-generated', { count: createdTasks.length });

    res.status(201).json({
      generated: createdTasks.length,
      tasks: createdTasks,
    });
  } catch (err) {
    console.error('Generate tasks error:', err);
    res.status(500).json({ error: 'Failed to generate tasks' });
  }
});

module.exports = router;
