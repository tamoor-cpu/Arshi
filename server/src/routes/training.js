const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateTrainingModule } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// List training modules (tenant-scoped)
router.get('/', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    const where = { tenantId: req.user.tenantId, isActive: true };
    if (category) where.category = category;

    const modules = await prisma.trainingModule.findMany({
      where,
      include: {
        completions: {
          where: { userId: req.user.id },
          take: 1,
        },
        _count: {
          select: { completions: true },
        },
      },
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });

    // Add user status to each module
    const enriched = modules.map((mod) => ({
      ...mod,
      userStatus: mod.completions[0]?.status || 'not_started',
      userScore: mod.completions[0]?.score || null,
      completions: undefined,
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Fetch training modules error:', err);
    res.status(500).json({ error: 'Failed to fetch training modules' });
  }
});

// Create training module
router.post('/', authenticate, requireRole('REGIONAL_ADMIN'), validateTrainingModule, async (req, res) => {
  try {
    const { title, description, category, content, contentUrl, mediaUrls, durationMinutes, isRequired, sequence } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required' });
    }

    const mod = await prisma.trainingModule.create({
      data: {
        tenantId: req.user.tenantId,
        title,
        description: description || null,
        category,
        content: content || null,
        contentUrl: contentUrl || null,
        mediaUrls: JSON.stringify(mediaUrls || []),
        durationMinutes: durationMinutes || null,
        isRequired: isRequired || false,
        sequence: sequence || 0,
      },
    });

    res.status(201).json(mod);
  } catch (err) {
    console.error('Create training module error:', err);
    res.status(500).json({ error: 'Failed to create training module' });
  }
});

// Get current user's training progress (MUST be before /:id route)
router.get('/my/progress', authenticate, async (req, res) => {
  try {
    const modules = await prisma.trainingModule.findMany({
      where: { tenantId: req.user.tenantId, isActive: true },
      include: {
        completions: {
          where: { userId: req.user.id },
        },
      },
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    });

    const total = modules.length;
    const completed = modules.filter((m) => m.completions[0]?.status === 'completed').length;
    const required = modules.filter((m) => m.isRequired);
    const requiredCompleted = required.filter((m) => m.completions[0]?.status === 'completed').length;

    res.json({
      total,
      completed,
      required: required.length,
      requiredCompleted,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  } catch (err) {
    console.error('Fetch training progress error:', err);
    res.status(500).json({ error: 'Failed to fetch training progress' });
  }
});

// Update training module
router.patch('/:id', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const { title, description, category, content, contentUrl, mediaUrls, durationMinutes, isRequired, isActive, sequence } = req.body;

    const mod = await prisma.trainingModule.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(content !== undefined && { content }),
        ...(contentUrl !== undefined && { contentUrl }),
        ...(mediaUrls !== undefined && { mediaUrls: JSON.stringify(mediaUrls) }),
        ...(durationMinutes !== undefined && { durationMinutes }),
        ...(isRequired !== undefined && { isRequired }),
        ...(isActive !== undefined && { isActive }),
        ...(sequence !== undefined && { sequence }),
      },
    });

    res.json(mod);
  } catch (err) {
    console.error('Update training module error:', err);
    res.status(500).json({ error: 'Failed to update training module' });
  }
});

// Get module detail with all completions
router.get('/:id', authenticate, async (req, res) => {
  try {
    const mod = await prisma.trainingModule.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: {
        completions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!mod) {
      return res.status(404).json({ error: 'Training module not found' });
    }

    res.json(mod);
  } catch (err) {
    console.error('Fetch training module error:', err);
    res.status(500).json({ error: 'Failed to fetch training module' });
  }
});

// Start training
router.post('/:id/start', authenticate, async (req, res) => {
  try {
    // Check if already started
    const existing = await prisma.trainingCompletion.findUnique({
      where: {
        moduleId_userId: { moduleId: req.params.id, userId: req.user.id },
      },
    });

    if (existing) {
      return res.json(existing);
    }

    const completion = await prisma.trainingCompletion.create({
      data: {
        moduleId: req.params.id,
        userId: req.user.id,
      },
    });

    res.status(201).json(completion);
  } catch (err) {
    console.error('Start training error:', err);
    res.status(500).json({ error: 'Failed to start training' });
  }
});

// Complete training
router.patch('/:id/complete', authenticate, async (req, res) => {
  try {
    const { score } = req.body;

    const completion = await prisma.trainingCompletion.update({
      where: {
        moduleId_userId: { moduleId: req.params.id, userId: req.user.id },
      },
      data: {
        status: score !== undefined && score < 70 ? 'failed' : 'completed',
        completedAt: new Date(),
        score: score || null,
      },
    });

    res.json(completion);
  } catch (err) {
    console.error('Complete training error:', err);
    res.status(500).json({ error: 'Failed to complete training' });
  }
});

module.exports = router;
