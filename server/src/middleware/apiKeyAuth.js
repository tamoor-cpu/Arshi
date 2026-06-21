const crypto = require('crypto');

/**
 * API Key authentication middleware.
 * Checks X-API-Key header, hashes it, and looks up in ApiKey table.
 * Falls through if no header present (allowing JWT auth to handle it).
 */
async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  // No API key header — skip to next auth method
  if (!apiKey) return next();

  // Validate format
  if (!apiKey.startsWith('wops_') || apiKey.length !== 37) {
    return res.status(401).json({ error: 'Invalid API key format' });
  }

  try {
    const prisma = req.app.get('prisma');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const record = await prisma.apiKey.findFirst({
      where: { keyHash, isActive: true },
    });

    if (!record) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    // Check expiration
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'API key has expired' });
    }

    // Update last used timestamp (fire-and-forget)
    prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    // Attach API key info to request
    req.apiKey = record;
    req.tenantId = record.tenantId;

    // Load a synthetic user-like object for permission checks
    // API keys operate at tenant level with their configured permissions
    req.user = {
      id: record.createdById,
      tenantId: record.tenantId,
      role: 'SUPER_ADMIN', // API keys have full access within their permissions
      isActive: true,
      userLocations: [],
    };

    next();
  } catch (err) {
    console.error('API key auth error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = { apiKeyAuth };
