const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// GET /webhooks — list endpoints
router.get('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(webhooks.map((w) => ({
      ...w,
      events: JSON.parse(w.events || '[]'),
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

// POST /webhooks — create (auto-generates signingSecret)
router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { url, events, description } = req.body;

    if (!url) return res.status(400).json({ error: 'URL is required' });

    const signingSecret = 'whsec_' + crypto.randomBytes(24).toString('hex');

    const webhook = await prisma.webhookEndpoint.create({
      data: {
        tenantId: req.user.tenantId,
        url,
        events: JSON.stringify(events || ['*']),
        signingSecret,
        description: description || '',
      },
    });

    req.audit('create', 'webhook', webhook.id, { url });

    res.status(201).json({
      ...webhook,
      events: JSON.parse(webhook.events),
    });
  } catch (err) {
    console.error('Webhook create error:', err);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// PATCH /webhooks/:id — update
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { url, events, isActive, description } = req.body;

    const webhook = await prisma.webhookEndpoint.updateMany({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      data: {
        ...(url && { url }),
        ...(events && { events: JSON.stringify(events) }),
        ...(isActive !== undefined && { isActive }),
        ...(description !== undefined && { description }),
      },
    });

    if (webhook.count === 0) return res.status(404).json({ error: 'Webhook not found' });

    req.audit('update', 'webhook', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// DELETE /webhooks/:id — delete + cascade deliveries
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    // Verify ownership
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!existing) return res.status(404).json({ error: 'Webhook not found' });

    // Delete cascades to deliveries via schema
    await prisma.webhookEndpoint.delete({ where: { id: req.params.id } });

    req.audit('delete', 'webhook', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// POST /webhooks/:id/test — send test ping
router.post('/:id/test', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });

    if (!endpoint) return res.status(404).json({ error: 'Webhook not found' });

    const body = JSON.stringify({
      event: 'ping',
      payload: { message: 'Test webhook from WashOps' },
      timestamp: new Date().toISOString(),
    });

    const signature = crypto
      .createHmac('sha256', endpoint.signingSecret)
      .update(body)
      .digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WashOps-Signature': `sha256=${signature}`,
        'X-WashOps-Event': 'ping',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseBody = await response.text().catch(() => '');

    res.json({
      success: response.ok,
      statusCode: response.status,
      responseBody: responseBody.slice(0, 500),
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET /webhooks/:id/deliveries — delivery history
router.get('/:id/deliveries', authenticate, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { page = 1, limit = 20 } = req.query;

    // Verify ownership
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!endpoint) return res.status(404).json({ error: 'Webhook not found' });

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookEndpointId: req.params.id },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    const total = await prisma.webhookDelivery.count({
      where: { webhookEndpointId: req.params.id },
    });

    res.json({
      data: deliveries,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
});

module.exports = router;
