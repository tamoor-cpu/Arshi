/**
 * Notification service — creates a persistent notification and emits a real-time socket event.
 *
 * Usage in routes:
 *   const { notify } = require('../services/notify');
 *   await notify({ prisma, io, userId, locationId, type, title, message, entityType, entityId });
 */

async function notify({ prisma, io, userId, locationId, type, title, message, entityType, entityId }) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, locationId, type, title, message, entityType, entityId },
    });
    // Emit to the user's personal socket room
    if (io) {
      io.to(`user:${userId}`).emit('notification', notification);
    }
    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null; // fire-and-forget — don't break the calling route
  }
}

/**
 * Notify all managers at a location.
 */
async function notifyLocationManagers({ prisma, io, locationId, type, title, message, entityType, entityId }) {
  try {
    const managerRoles = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'];
    const userLocations = await prisma.userLocation.findMany({
      where: { locationId },
      include: { user: { select: { id: true, role: true } } },
    });
    const managers = userLocations.filter((ul) => managerRoles.includes(ul.user.role));
    const results = await Promise.all(
      managers.map((m) =>
        notify({ prisma, io, userId: m.user.id, locationId, type, title, message, entityType, entityId })
      )
    );
    return results.filter(Boolean);
  } catch (err) {
    console.error('Failed to notify location managers:', err);
    return [];
  }
}

module.exports = { notify, notifyLocationManagers };
