const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api-keys — list (returns prefix, never full key)
router.get('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const keys = await prisma.apiKey.findMany({
      where: { tenantId: req.user.tenantId },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// POST /api-keys — generate new key (returns raw key ONE TIME)
router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { name, permissions, expiresAt } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Generate key: wops_ + 32 hex chars
    const rawKey = 'wops_' + crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.slice(0, 9) + '...';

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: req.user.tenantId,
        name,
        keyHash,
        prefix,
        permissions: permissions ? JSON.stringify(permissions) : '["*"]',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: req.user.id,
      },
    });

    req.audit('create', 'api_key', apiKey.id, { name });

    // Return the raw key ONE TIME — it won't be retrievable again
    res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      prefix: apiKey.prefix,
      permissions: JSON.parse(apiKey.permissions),
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      _warning: 'Save this key now — it will not be shown again',
    });
  } catch (err) {
    console.error('API key create error:', err);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// PATCH /api-keys/:id — update name/permissions/isActive
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { name, permissions, isActive } = req.body;

    const key = await prisma.apiKey.updateMany({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      data: {
        ...(name && { name }),
        ...(permissions && { permissions: JSON.stringify(permissions) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    if (key.count === 0) return res.status(404).json({ error: 'API key not found' });

    req.audit('update', 'api_key', req.params.id, { name, isActive });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// DELETE /api-keys/:id — revoke
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const key = await prisma.apiKey.updateMany({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      data: { isActive: false },
    });

    if (key.count === 0) return res.status(404).json({ error: 'API key not found' });

    req.audit('revoke', 'api_key', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

module.exports = router;
