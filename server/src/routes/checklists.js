const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// List checklist templates
router.get('/:locationId/checklists/templates', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const templates = await prisma.checklistTemplate.findMany({
      where: {
        tenantId: req.tenantId,
        OR: [
          { locationId: req.params.locationId },
          { locationId: null }, // tenant-wide templates
        ],
        isActive: true,
      },
      include: {
        tasks: { orderBy: { sequence: 'asc' } },
        _count: { select: { completedChecklists: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create checklist template
router.post('/:locationId/checklists/templates', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, description, type, tasks, isGlobal } = req.body;

    if (!name || !type || !tasks || tasks.length === 0) {
      return res.status(400).json({ error: 'Name, type, and at least one task are required' });
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        tenantId: req.tenantId,
        locationId: isGlobal ? null : req.params.locationId,
        name,
        description,
        type,
        tasks: {
          create: tasks.map((task, idx) => ({
            sequence: idx + 1,
            title: task.title,
            description: task.description,
            requiresPhoto: task.requiresPhoto || false,
            estimatedMinutes: task.estimatedMinutes,
            section: task.section,
          })),
        },
      },
      include: { tasks: { orderBy: { sequence: 'asc' } } },
    });

    res.status(201).json(template);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update checklist template
router.patch('/:locationId/checklists/templates/:templateId', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, description, type, isActive } = req.body;

    const template = await prisma.checklistTemplate.update({
      where: { id: req.params.templateId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(type && { type }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { tasks: { orderBy: { sequence: 'asc' } } },
    });

    res.json(template);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Start a checklist
router.post('/:locationId/checklists/start', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    // Check for existing in-progress checklist of same template today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await prisma.completedChecklist.findFirst({
      where: {
        templateId,
        locationId: req.params.locationId,
        status: 'in_progress',
        startedAt: { gte: today, lt: tomorrow },
      },
    });

    if (existing) {
      // Return existing in-progress checklist
      const withResults = await prisma.completedChecklist.findUnique({
        where: { id: existing.id },
        include: {
          template: { include: { tasks: { orderBy: { sequence: 'asc' } } } },
          taskResults: true,
        },
      });
      return res.json(withResults);
    }

    // Get template tasks
    const template = await prisma.checklistTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: { orderBy: { sequence: 'asc' } } },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Create completed checklist with task results
    const completed = await prisma.completedChecklist.create({
      data: {
        templateId,
        locationId: req.params.locationId,
        userId: req.user.id,
        taskResults: {
          create: template.tasks.map((task) => ({
            taskId: task.id,
            userId: req.user.id,
            status: 'pending',
          })),
        },
      },
      include: {
        template: { include: { tasks: { orderBy: { sequence: 'asc' } } } },
        taskResults: true,
      },
    });

    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('checklist-started', {
      checklistId: completed.id,
      templateName: template.name,
      user: { id: req.user.id, firstName: req.user.firstName, lastName: req.user.lastName },
    });

    res.status(201).json(completed);
  } catch (err) {
    console.error('Start checklist error:', err);
    res.status(500).json({ error: 'Failed to start checklist' });
  }
});

// Complete a task in a checklist
router.patch('/:locationId/checklists/:checklistId/tasks/:taskId', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { status, notes, photoUrl } = req.body;

    const result = await prisma.checklistTaskResult.update({
      where: {
        completedChecklistId_taskId: {
          completedChecklistId: req.params.checklistId,
          taskId: req.params.taskId,
        },
      },
      data: {
        status: status || 'passed',
        notes,
        photoUrl,
        completedAt: new Date(),
        userId: req.user.id,
      },
    });

    // Check if all tasks are done
    const allResults = await prisma.checklistTaskResult.findMany({
      where: { completedChecklistId: req.params.checklistId },
    });

    const allDone = allResults.every((r) => r.status !== 'pending');

    if (allDone) {
      await prisma.completedChecklist.update({
        where: { id: req.params.checklistId },
        data: { status: 'completed', completedAt: new Date() },
      });

      const io = req.app.get('io');
      io.to(`location:${req.params.locationId}`).emit('checklist-completed', {
        checklistId: req.params.checklistId,
        user: { id: req.user.id, firstName: req.user.firstName, lastName: req.user.lastName },
      });
    }

    res.json({ ...result, checklistComplete: allDone });
  } catch (err) {
    console.error('Complete task error:', err);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Get completed checklists (history)
router.get('/:locationId/checklists/completed', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { startDate, endDate, templateId, status } = req.query;

    const where = { locationId: req.params.locationId };
    if (templateId) where.templateId = templateId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = new Date(startDate);
      if (endDate) where.startedAt.lte = new Date(endDate);
    }

    const checklists = await prisma.completedChecklist.findMany({
      where,
      include: {
        template: { select: { id: true, name: true, type: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
        taskResults: {
          include: { task: { select: { title: true, requiresPhoto: true } } },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    res.json(checklists);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch checklists' });
  }
});

// Get a single completed checklist by id
router.get('/:locationId/checklists/completed/:checklistId', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const checklist = await prisma.completedChecklist.findFirst({
      where: {
        id: req.params.checklistId,
        locationId: req.params.locationId,
      },
      include: {
        template: { include: { tasks: { orderBy: { sequence: 'asc' } } } },
        user: { select: { id: true, firstName: true, lastName: true } },
        taskResults: {
          include: { task: { select: { title: true, requiresPhoto: true } } },
        },
      },
    });

    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    res.json(checklist);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

module.exports = router;
