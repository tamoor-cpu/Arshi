const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateOnboarding } = require('../services/onboarding');
const { createToken } = require('../services/authTokens');
const { sendInviteEmail } = require('../services/email');

const router = express.Router();
const prisma = new PrismaClient();

// List users in tenant
router.get('/', authenticate, async (req, res) => {
  try {
    const { locationId, role, search, includeArchived } = req.query;
    let where = { tenantId: req.tenantId, isActive: true };
    if (includeArchived !== 'true') where.archived = false;

    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    let users = await prisma.user.findMany({
      where,
      include: {
        userLocations: { include: { location: { select: { id: true, name: true } } } },
      },
      orderBy: { firstName: 'asc' },
    });

    if (locationId) {
      users = users.filter((u) => u.userLocations.some((ul) => ul.locationId === locationId));
    }

    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        phone: u.phone,
        avatarUrl: u.avatarUrl,
        position: u.position,
        hireDate: u.hireDate,
        archived: u.archived,
        onboardingCompletedAt: u.onboardingCompletedAt,
        locations: u.userLocations.map((ul) => ({
          id: ul.location.id,
          name: ul.location.name,
          isPrimary: ul.isPrimary,
        })),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create/invite user
router.post('/', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role, locationId, position, hireDate, hourlyRate } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // If no password is supplied, the user is invited by email to set their own.
    const willInvite = !password;
    const passwordHash = await bcrypt.hash(password || crypto.randomBytes(24).toString('hex'), 12);
    const newRole = role || 'EMPLOYEE';

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId: req.tenantId,
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: newRole,
          position: position || null,
          hireDate: hireDate ? new Date(hireDate) : null,
          hourlyRate: hourlyRate != null && hourlyRate !== '' ? parseFloat(hourlyRate) : null,
        },
      });

      if (locationId) {
        await tx.userLocation.create({
          data: { userId: newUser.id, locationId, isPrimary: true },
        });
      }

      // New hires get an onboarding checklist they must complete on first login.
      await generateOnboarding(tx, newUser.id);

      return newUser;
    });

    // Email the new user an invite to set their own password.
    if (willInvite) {
      try {
        const raw = await createToken(prisma, user.id, 'invite', 72); // 3 days
        await sendInviteEmail(user, raw);
      } catch (e) {
        console.error('Invite email failed:', e.message);
      }
    }

    req.audit('create', 'user', user.id, { email, role: newRole, invited: willInvite });

    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      invited: willInvite,
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Resend an invite (set-password) email to a user.
router.post('/:id/invite', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const raw = await createToken(prisma, user.id, 'invite', 72);
    await sendInviteEmail(user, raw);
    res.json({ ok: true });
  } catch (err) {
    console.error('Resend invite error:', err);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// Get user details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        userLocations: { include: { location: { select: { id: true, name: true } } } },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      locations: user.userLocations.map((ul) => ({
        id: ul.location.id,
        name: ul.location.name,
        isPrimary: ul.isPrimary,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user
router.patch('/:id', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const { firstName, lastName, phone, role, isActive, position, hireDate, hourlyRate } = req.body;

    const updated = await prisma.user.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(position !== undefined && { position: position || null }),
        ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
        ...(hourlyRate !== undefined && { hourlyRate: hourlyRate !== '' && hourlyRate != null ? parseFloat(hourlyRate) : null }),
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Assign user to location
router.post('/:id/locations', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const { locationId, isPrimary } = req.body;

    const assignment = await prisma.userLocation.create({
      data: {
        userId: req.params.id,
        locationId,
        isPrimary: isPrimary || false,
      },
    });

    res.status(201).json(assignment);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'User already assigned to this location' });
    }
    res.status(500).json({ error: 'Failed to assign location' });
  }
});

// Remove user from location
router.delete('/:id/locations/:locationId', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    await prisma.userLocation.deleteMany({
      where: {
        userId: req.params.id,
        locationId: req.params.locationId,
      },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove location assignment' });
  }
});

// ==================== ARCHIVE / REACTIVATE ====================

router.post('/:id/archive', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.user.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { archived: true, archivedAt: new Date(), isActive: true },
    });
    req.audit('archive', 'user', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to archive employee' }); }
});

router.post('/:id/unarchive', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.user.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { archived: false, archivedAt: null },
    });
    req.audit('unarchive', 'user', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to reactivate employee' }); }
});

// ==================== EMPLOYEE FILE ====================

// Full employee file: profile, onboarding, documents, trainings, quizzes,
// write-ups, schedule, and clock-in/out history.
router.get('/:id/file', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        userLocations: { include: { location: { select: { id: true, name: true } } } },
        onboardingTasks: { orderBy: { sortOrder: 'asc' } },
        employeeDocuments: { orderBy: { createdAt: 'desc' } },
        signedDocuments: { orderBy: { signedAt: 'desc' } },
        writeUpsReceived: { include: { issuedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
        trainingCompletions: { include: { module: { select: { id: true, title: true, category: true, isRequired: true } } } },
        shiftAssignments: { include: { shift: true }, orderBy: { date: 'desc' }, take: 30 },
        clockEvents: { orderBy: { timestamp: 'desc' }, take: 50 },
      },
    });
    if (!user) return res.status(404).json({ error: 'Employee not found' });

    // All training modules in the tenant, to show incomplete vs complete.
    const modules = await prisma.trainingModule.findMany({
      where: { tenantId: req.tenantId, isActive: true },
      select: { id: true, title: true, category: true, isRequired: true },
      orderBy: { sequence: 'asc' },
    });
    const completionByModule = {};
    user.trainingCompletions.forEach((c) => { completionByModule[c.moduleId] = c; });
    const trainings = modules.map((m) => {
      const c = completionByModule[m.id];
      return { ...m, status: c ? c.status : 'not_started', score: c?.score ?? null, completedAt: c?.completedAt ?? null };
    });

    const { passwordHash, ...safe } = user;
    res.json({ ...safe, trainings });
  } catch (err) {
    console.error('Employee file error:', err);
    res.status(500).json({ error: 'Failed to load employee file' });
  }
});

router.post('/:id/documents', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { category, name, fileUrl, status, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Document name is required' });
    const doc = await prisma.employeeDocument.create({
      data: {
        userId: req.params.id,
        category: category || 'other',
        name,
        fileUrl: fileUrl || null,
        status: status || 'pending',
        signedAt: status === 'signed' ? new Date() : null,
        notes: notes || null,
        uploadedById: req.user.id,
      },
    });
    res.status(201).json(doc);
  } catch (err) { res.status(500).json({ error: 'Failed to add document' }); }
});

router.delete('/:id/documents/:docId', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try { await prisma.employeeDocument.delete({ where: { id: req.params.docId } }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete document' }); }
});

router.post('/:id/writeups', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { type, title, description, locationId } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Title and description are required' });
    const wu = await prisma.writeUp.create({
      data: {
        userId: req.params.id,
        locationId: locationId || null,
        type: type || 'written',
        title,
        description,
        issuedById: req.user.id,
      },
      include: { issuedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    req.audit('create', 'writeup', wu.id, { userId: req.params.id, type: wu.type });
    res.status(201).json(wu);
  } catch (err) { res.status(500).json({ error: 'Failed to add write-up' }); }
});

router.delete('/:id/writeups/:wuId', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try { await prisma.writeUp.delete({ where: { id: req.params.wuId } }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete write-up' }); }
});

// ==================== MY ONBOARDING (employee self-service) ====================

router.get('/me/onboarding', authenticate, async (req, res) => {
  try {
    const tasks = await prisma.onboardingTask.findMany({
      where: { userId: req.user.id },
      orderBy: { sortOrder: 'asc' },
    });
    // Resolve the training step from real training completions.
    const modules = await prisma.trainingModule.findMany({
      where: { tenantId: req.tenantId, isActive: true, isRequired: true },
      select: { id: true },
    });
    const completions = await prisma.trainingCompletion.findMany({
      where: { userId: req.user.id, status: 'completed' },
      select: { moduleId: true },
    });
    const completedSet = new Set(completions.map((c) => c.moduleId));
    const requiredTrainingDone = modules.length === 0 || modules.every((m) => completedSet.has(m.id));

    const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { onboardingCompletedAt: true } });
    res.json({
      tasks,
      requiredTrainingCount: modules.length,
      requiredTrainingDone,
      onboardingCompletedAt: me?.onboardingCompletedAt || null,
    });
  } catch (err) {
    console.error('Get onboarding error:', err);
    res.status(500).json({ error: 'Failed to load onboarding' });
  }
});

router.post('/me/onboarding/:taskId/complete', authenticate, async (req, res) => {
  try {
    const task = await prisma.onboardingTask.findFirst({ where: { id: req.params.taskId, userId: req.user.id } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const updated = await prisma.onboardingTask.update({
      where: { id: task.id },
      data: { status: 'completed', completedAt: new Date(), data: req.body?.data ? JSON.stringify(req.body.data) : task.data },
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Failed to complete task' }); }
});

// Finalize onboarding — only allowed when every required task is done.
router.post('/me/onboarding/complete', authenticate, async (req, res) => {
  try {
    const pending = await prisma.onboardingTask.count({ where: { userId: req.user.id, required: true, status: 'pending' } });
    if (pending > 0) return res.status(400).json({ error: 'Complete all required steps first' });
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { onboardingCompletedAt: new Date() },
    });
    req.audit('complete', 'onboarding', req.user.id);
    res.json({ success: true, onboardingCompletedAt: user.onboardingCompletedAt });
  } catch (err) { res.status(500).json({ error: 'Failed to finalize onboarding' }); }
});

module.exports = router;
