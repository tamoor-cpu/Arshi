const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Verify JWT and attach user to request, with API key fallback
const authenticate = async (req, res, next) => {
  try {
    // Check for API key first
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      if (!apiKey.startsWith('wops_') || apiKey.length !== 37) {
        return res.status(401).json({ error: 'Invalid API key format' });
      }
      const appPrisma = req.app.get('prisma') || prisma;
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const record = await appPrisma.apiKey.findFirst({ where: { keyHash, isActive: true } });
      if (!record) return res.status(401).json({ error: 'Invalid or revoked API key' });
      if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
        return res.status(401).json({ error: 'API key has expired' });
      }
      appPrisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      req.apiKey = record;
      req.tenantId = record.tenantId;
      req.user = { id: record.createdById, tenantId: record.tenantId, role: 'SUPER_ADMIN', isActive: true, userLocations: [] };
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: {
        userLocations: {
          include: { location: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Check if user has required role (hierarchical)
const ROLE_HIERARCHY = {
  SUPER_ADMIN: 4,
  REGIONAL_ADMIN: 3,
  SITE_MANAGER: 2,
  EMPLOYEE: 1,
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = Math.min(...roles.map((r) => ROLE_HIERARCHY[r] || 99));

    if (userLevel >= requiredLevel) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

// Verify user has access to the specified location
const requireLocationAccess = async (req, res, next) => {
  try {
    const locationId = req.params.locationId;
    if (!locationId) return next();

    // Super/Regional admins can access any location in their tenant
    if (['SUPER_ADMIN', 'REGIONAL_ADMIN'].includes(req.user.role)) {
      const location = await prisma.location.findFirst({
        where: { id: locationId, tenantId: req.user.tenantId },
      });
      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }
      req.location = location;
      return next();
    }

    // Managers and employees must be assigned to the location
    const userLocation = req.user.userLocations.find(
      (ul) => ul.locationId === locationId
    );

    if (!userLocation) {
      return res.status(403).json({ error: 'No access to this location' });
    }

    req.location = userLocation.location;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, requireRole, requireLocationAccess };
