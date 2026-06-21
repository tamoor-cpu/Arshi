const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireLocationAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

// Clock in
router.post('/:locationId/clock-in', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    const locationId = req.params.locationId;

    // Check if already clocked in
    const lastEvent = await prisma.clockEvent.findFirst({
      where: { userId: req.user.id, locationId },
      orderBy: { timestamp: 'desc' },
    });

    if (lastEvent && lastEvent.eventType === 'clock_in') {
      return res.status(400).json({ error: 'Already clocked in. Please clock out first.' });
    }

    // Verify geofence
    let isWithinGeofence = true;
    if (latitude && longitude && req.location.latitude && req.location.longitude) {
      const distance = calculateDistance(
        latitude, longitude,
        req.location.latitude, req.location.longitude
      );
      isWithinGeofence = distance <= (req.location.geofenceRadius || 150);
    }

    const clockEvent = await prisma.clockEvent.create({
      data: {
        userId: req.user.id,
        locationId,
        eventType: 'clock_in',
        latitude,
        longitude,
        accuracy,
        isWithinGeofence,
      },
    });

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`location:${locationId}`).emit('clock-event', {
      ...clockEvent,
      user: { id: req.user.id, firstName: req.user.firstName, lastName: req.user.lastName },
    });

    res.status(201).json({
      ...clockEvent,
      withinGeofence: isWithinGeofence,
      message: isWithinGeofence ? 'Clocked in successfully' : 'Clocked in (outside geofence)',
    });
  } catch (err) {
    console.error('Clock in error:', err);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// Clock out
router.post('/:locationId/clock-out', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    const locationId = req.params.locationId;

    // Check if clocked in
    const lastEvent = await prisma.clockEvent.findFirst({
      where: { userId: req.user.id, locationId },
      orderBy: { timestamp: 'desc' },
    });

    if (!lastEvent || lastEvent.eventType === 'clock_out') {
      return res.status(400).json({ error: 'Not clocked in.' });
    }

    let isWithinGeofence = true;
    if (latitude && longitude && req.location.latitude && req.location.longitude) {
      const distance = calculateDistance(
        latitude, longitude,
        req.location.latitude, req.location.longitude
      );
      isWithinGeofence = distance <= (req.location.geofenceRadius || 150);
    }

    const clockEvent = await prisma.clockEvent.create({
      data: {
        userId: req.user.id,
        locationId,
        eventType: 'clock_out',
        latitude,
        longitude,
        accuracy,
        isWithinGeofence,
      },
    });

    // Calculate hours worked
    const clockInTime = lastEvent.timestamp;
    const clockOutTime = clockEvent.timestamp;
    const hoursWorked = ((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2);

    const io = req.app.get('io');
    io.to(`location:${locationId}`).emit('clock-event', {
      ...clockEvent,
      user: { id: req.user.id, firstName: req.user.firstName, lastName: req.user.lastName },
    });

    res.status(201).json({
      ...clockEvent,
      hoursWorked: parseFloat(hoursWorked),
      message: `Clocked out. ${hoursWorked} hours worked.`,
    });
  } catch (err) {
    console.error('Clock out error:', err);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

// Get clock events for location (today by default)
router.get('/:locationId/clock-events', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { startDate, endDate, userId, open } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Determine which user we are scoping to (employees are locked to themselves).
    const scopeUserId = req.user.role === 'EMPLOYEE' ? req.user.id : userId;

    // ?open=true returns the user's most recent OPEN (no matching clock-out)
    // event regardless of date. Used by ClockInButton so an overnight clock-in
    // from a previous day still shows as "clocked in".
    if (open === 'true') {
      const latest = await prisma.clockEvent.findFirst({
        where: {
          locationId: req.params.locationId,
          ...(scopeUserId && { userId: scopeUserId }),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { timestamp: 'desc' },
      });

      // Only return it if it is an open clock-in; otherwise the user is clocked out.
      return res.json(latest && latest.eventType === 'clock_in' ? [latest] : []);
    }

    const where = {
      locationId: req.params.locationId,
      timestamp: {
        gte: startDate ? new Date(startDate) : today,
        lt: endDate ? new Date(endDate) : tomorrow,
      },
    };

    if (scopeUserId) where.userId = scopeUserId;

    const events = await prisma.clockEvent.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { timestamp: 'desc' },
    });

    // When viewing the default (today) window scoped to a single user, an open
    // clock-in from a previous day would be missed entirely. Ensure that user's
    // latest event is reflected at the front so callers that read events[0]
    // (e.g. ClockInButton) get the correct clock state across midnight.
    // ClockInButton sends no userId, so fall back to the requesting user.
    const midnightUserId = scopeUserId || req.user.id;
    if (!startDate && !endDate && midnightUserId) {
      const latest = await prisma.clockEvent.findFirst({
        where: {
          locationId: req.params.locationId,
          userId: midnightUserId,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { timestamp: 'desc' },
      });

      if (latest && (events.length === 0 || events[0].id !== latest.id)) {
        return res.json([latest, ...events]);
      }
    }

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clock events' });
  }
});

// Get who's currently on-site
router.get('/:locationId/on-site', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = await prisma.clockEvent.findMany({
      where: {
        locationId: req.params.locationId,
        timestamp: { gte: today },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Build on-site list: last event per user must be clock_in
    const userLastEvent = {};
    events.forEach((e) => {
      userLastEvent[e.userId] = e;
    });

    const onSite = Object.values(userLastEvent)
      .filter((e) => e.eventType === 'clock_in')
      .map((e) => ({
        ...e.user,
        clockedInAt: e.timestamp,
        isWithinGeofence: e.isWithinGeofence,
      }));

    res.json(onSite);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch on-site users' });
  }
});

module.exports = router;
