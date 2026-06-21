const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');
const { generateSchedule, applySchedule } = require('../services/autoScheduler');

const router = express.Router();
const prisma = new PrismaClient();

// List shifts at location
router.get('/:locationId/shifts', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      where: { locationId: req.params.locationId, isActive: true },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// Create shift template
router.post('/:locationId/shifts', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, startTime, endTime, daysOfWeek, color, minStaff, maxStaff, breakMinutes } = req.body;

    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: 'Name, start time, and end time are required' });
    }

    const shift = await prisma.shift.create({
      data: {
        locationId: req.params.locationId,
        name,
        startTime,
        endTime,
        daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek.join(',') : (daysOfWeek || '1,2,3,4,5,6,0'),
        color: color || '#3B82F6',
        ...(minStaff != null && { minStaff: parseInt(minStaff) }),
        ...(maxStaff != null && { maxStaff: parseInt(maxStaff) }),
        ...(breakMinutes != null && { breakMinutes: parseInt(breakMinutes) }),
      },
    });

    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

// Update shift
router.patch('/:locationId/shifts/:shiftId', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, startTime, endTime, daysOfWeek, color, isActive, minStaff, maxStaff, breakMinutes } = req.body;

    const shift = await prisma.shift.update({
      where: { id: req.params.shiftId },
      data: {
        ...(name && { name }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(daysOfWeek && { daysOfWeek }),
        ...(color && { color }),
        ...(isActive !== undefined && { isActive }),
        ...(minStaff != null && { minStaff: parseInt(minStaff) }),
        ...(maxStaff != null && { maxStaff: parseInt(maxStaff) }),
        ...(breakMinutes != null && { breakMinutes: parseInt(breakMinutes) }),
      },
    });

    res.json(shift);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

// Assign employee to shift
router.post('/:locationId/shifts/:shiftId/assign', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { userId, date } = req.body;

    if (!userId || !date) {
      return res.status(400).json({ error: 'User ID and date are required' });
    }

    const assignment = await prisma.shiftAssignment.create({
      data: {
        shiftId: req.params.shiftId,
        userId,
        date: new Date(date),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        shift: true,
      },
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`location:${req.params.locationId}`).emit('shift-assigned', assignment);

    res.status(201).json(assignment);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'User already assigned to this shift on this date' });
    }
    res.status(500).json({ error: 'Failed to assign shift' });
  }
});

// Get assignments for a date range
router.get('/:locationId/assignments', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {
      shift: { locationId: req.params.locationId },
    };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        shift: true,
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } },
      },
      orderBy: { date: 'asc' },
    });

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Delete assignment
router.delete('/:locationId/assignments/:assignmentId', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.shiftAssignment.delete({ where: { id: req.params.assignmentId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// GET /:locationId/shifts/labor-summary — projected labor costs
router.get('/:locationId/shifts/labor-summary', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        shift: { locationId: req.params.locationId },
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      include: {
        shift: true,
        user: { select: { id: true, firstName: true, lastName: true, hourlyRate: true } },
      },
    });

    let totalCost = 0;
    const byShift = {};
    const byEmployee = {};

    for (const a of assignments) {
      const rate = a.user.hourlyRate || 0;
      // Calculate hours from shift times (HH:MM format)
      const [sh, sm] = (a.shift.startTime || '09:00').split(':').map(Number);
      const [eh, em] = (a.shift.endTime || '17:00').split(':').map(Number);
      let hours = (eh + em / 60) - (sh + sm / 60);
      if (hours < 0) hours += 24; // overnight shift
      hours -= (a.shift.breakMinutes || 0) / 60;

      const cost = hours * rate;
      totalCost += cost;

      const shiftKey = a.shift.id;
      if (!byShift[shiftKey]) {
        byShift[shiftKey] = { shiftName: a.shift.name, hours: 0, cost: 0, assignmentCount: 0 };
      }
      byShift[shiftKey].hours += hours;
      byShift[shiftKey].cost += cost;
      byShift[shiftKey].assignmentCount += 1;

      const empKey = a.user.id;
      if (!byEmployee[empKey]) {
        byEmployee[empKey] = { name: `${a.user.firstName} ${a.user.lastName}`, rate, hours: 0, cost: 0 };
      }
      byEmployee[empKey].hours += hours;
      byEmployee[empKey].cost += cost;
    }

    res.json({
      totalCost: Math.round(totalCost * 100) / 100,
      totalAssignments: assignments.length,
      byShift: Object.values(byShift),
      byEmployee: Object.values(byEmployee),
    });
  } catch (err) {
    console.error('Labor summary error:', err);
    res.status(500).json({ error: 'Failed to compute labor summary' });
  }
});

// POST /:locationId/shifts/auto-schedule/preview — generate schedule preview
router.post('/:locationId/shifts/auto-schedule/preview', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { weekStartDate } = req.body;
    if (!weekStartDate) {
      return res.status(400).json({ error: 'weekStartDate is required' });
    }

    const result = await generateSchedule(prisma, {
      locationId: req.params.locationId,
      weekStartDate,
    });

    res.json(result);
  } catch (err) {
    console.error('Auto-schedule preview error:', err);
    res.status(500).json({ error: 'Failed to generate schedule preview' });
  }
});

// POST /:locationId/shifts/auto-schedule/apply — apply generated schedule
router.post('/:locationId/shifts/auto-schedule/apply', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { assignments } = req.body;
    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({ error: 'assignments array is required' });
    }

    const io = req.app.get('io');
    const result = await applySchedule(prisma, {
      locationId: req.params.locationId,
      assignments,
      io,
    });

    req.audit('create', 'auto_schedule', null, { created: result.created, total: result.total });
    res.json(result);
  } catch (err) {
    console.error('Auto-schedule apply error:', err);
    res.status(500).json({ error: 'Failed to apply schedule' });
  }
});

module.exports = router;
