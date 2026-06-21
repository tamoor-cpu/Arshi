/**
 * Auto-Scheduler Service
 * Generates fair shift assignments for a week based on:
 * - Shift templates (days of week, min/max staff)
 * - Employee availability (excluding approved time-off)
 * - Fairness: employees with fewer assignments get priority
 */

async function generateSchedule(prisma, { locationId, weekStartDate }) {
  const start = new Date(weekStartDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  // Fetch active shifts at this location
  const shifts = await prisma.shift.findMany({
    where: { locationId, isActive: true },
  });

  // Fetch employees assigned to this location
  const userLocations = await prisma.userLocation.findMany({
    where: { locationId },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, role: true, isActive: true, hourlyRate: true },
      },
    },
  });
  const employees = userLocations
    .filter((ul) => ul.user.isActive)
    .map((ul) => ul.user);

  // Fetch approved time-off overlapping this week
  const timeOff = await prisma.timeOffRequest.findMany({
    where: {
      locationId,
      status: 'approved',
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });

  // Build a set of userId+date combos that are on time-off
  const offDays = new Set();
  for (const to of timeOff) {
    const d = new Date(to.startDate);
    while (d <= to.endDate && d <= end) {
      if (d >= start) {
        offDays.add(`${to.userId}_${d.toISOString().split('T')[0]}`);
      }
      d.setDate(d.getDate() + 1);
    }
  }

  // Fetch existing assignments this week to count fairness
  const existing = await prisma.shiftAssignment.findMany({
    where: {
      shift: { locationId },
      date: { gte: start, lte: end },
    },
  });
  const existingSet = new Set(existing.map((a) => `${a.userId}_${a.shiftId}_${a.date.toISOString().split('T')[0]}`));

  // Count assignments per employee (across all time for fairness)
  const assignmentCounts = {};
  for (const emp of employees) {
    const count = await prisma.shiftAssignment.count({
      where: { userId: emp.id, shift: { locationId } },
    });
    assignmentCounts[emp.id] = count;
  }

  const assignments = [];
  const warnings = [];

  // For each day of the week
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(start);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

    // For each shift that runs on this day
    for (const shift of shifts) {
      const shiftDays = (shift.daysOfWeek || '1,2,3,4,5,6,0').split(',').map(Number);
      if (!shiftDays.includes(dayOfWeek)) continue;

      const minStaff = shift.minStaff || 1;
      const maxStaff = shift.maxStaff || minStaff;

      // Find available employees (not on time-off, not already assigned to this shift+date)
      const available = employees
        .filter((emp) => {
          if (offDays.has(`${emp.id}_${dateStr}`)) return false;
          if (existingSet.has(`${emp.id}_${shift.id}_${dateStr}`)) return false;
          return true;
        })
        // Sort by fewest assignments for fairness
        .sort((a, b) => (assignmentCounts[a.id] || 0) - (assignmentCounts[b.id] || 0));

      const toAssign = Math.min(maxStaff, available.length);

      if (toAssign < minStaff) {
        warnings.push({
          type: 'understaffed',
          date: dateStr,
          shiftId: shift.id,
          shiftName: shift.name,
          needed: minStaff,
          available: toAssign,
          message: `${shift.name} on ${dateStr}: need ${minStaff} staff, only ${toAssign} available`,
        });
      }

      for (let i = 0; i < toAssign; i++) {
        const emp = available[i];
        assignments.push({
          shiftId: shift.id,
          shiftName: shift.name,
          userId: emp.id,
          userName: `${emp.firstName} ${emp.lastName}`,
          date: dateStr,
          hourlyRate: emp.hourlyRate || 0,
        });
        // Update fairness counter
        assignmentCounts[emp.id] = (assignmentCounts[emp.id] || 0) + 1;
        // Mark as assigned so we don't double-assign
        existingSet.add(`${emp.id}_${shift.id}_${dateStr}`);
      }
    }
  }

  return { assignments, warnings, weekStart: start.toISOString().split('T')[0], weekEnd: end.toISOString().split('T')[0] };
}

async function applySchedule(prisma, { locationId, assignments, io }) {
  const created = [];

  for (const a of assignments) {
    try {
      const assignment = await prisma.shiftAssignment.create({
        data: {
          shiftId: a.shiftId,
          userId: a.userId,
          date: new Date(a.date),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          shift: true,
        },
      });
      created.push(assignment);
    } catch (err) {
      // Skip duplicates silently
      if (err.code !== 'P2002') {
        console.error('Auto-schedule assignment error:', err.message);
      }
    }
  }

  if (io) {
    io.to(`location:${locationId}`).emit('schedule-updated', { count: created.length });
  }

  return { created: created.length, total: assignments.length };
}

module.exports = { generateSchedule, applySchedule };
