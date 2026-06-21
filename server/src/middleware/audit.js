const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { dispatchWebhook } = require('../services/webhook');

// Log an audit event - fire-and-forget (doesn't block the request)
function logAudit({ tenantId, locationId, userId, action, entity, entityId, details, ipAddress }) {
  prisma.auditLog.create({
    data: {
      tenantId,
      locationId: locationId || null,
      userId,
      action,
      entity,
      entityId: entityId || null,
      details: details ? JSON.stringify(details) : null,
      ipAddress: ipAddress || null,
    },
  }).then(() => {
    // Dispatch webhook after audit log is created
    if (tenantId) {
      dispatchWebhook(prisma, tenantId, `${entity}.${action}`, {
        action, entity, entityId, details, locationId, userId,
      });
    }
  }).catch((err) => {
    console.error('Audit log error:', err.message);
  });
}

// Express middleware helper - attaches audit helper to req
function auditMiddleware(req, res, next) {
  req.audit = (action, entity, entityId, details) => {
    if (!req.user) return;
    logAudit({
      tenantId: req.user.tenantId,
      locationId: req.params.locationId || null,
      userId: req.user.id,
      action,
      entity,
      entityId,
      details,
      ipAddress: req.ip || req.connection?.remoteAddress,
    });
  };
  next();
}

module.exports = { logAudit, auditMiddleware };
