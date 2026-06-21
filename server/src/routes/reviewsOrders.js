const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ==================== REVIEWS ====================

router.get('/:locationId/reviews', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { needsReply } = req.query;
    const where = { locationId: req.params.locationId };
    if (needsReply === 'true') where.replied = false;
    const reviews = await prisma.review.findMany({
      where,
      include: { repliedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { reviewedAt: 'desc' },
      take: 100,
    });
    res.json(reviews);
  } catch (err) {
    console.error('List reviews error:', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

router.post('/:locationId/reviews', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { customerName, rating, comment, source, reviewedAt } = req.body;
    const review = await prisma.review.create({
      data: {
        locationId: req.params.locationId,
        customerName: customerName || null,
        rating: Math.max(1, Math.min(5, parseInt(rating) || 5)),
        comment: comment || null,
        source: source || 'google',
        reviewedAt: reviewedAt ? new Date(reviewedAt) : new Date(),
      },
    });
    res.status(201).json(review);
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Reply to a review
router.patch('/:locationId/reviews/:id/reply', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { replyText } = req.body;
    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: { replied: true, replyText: replyText || null, repliedById: req.user.id },
      include: { repliedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    req.audit('reply', 'review', review.id);
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reply' });
  }
});

router.delete('/:locationId/reviews/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ==================== PURCHASE ORDERS ====================

router.get('/:locationId/orders', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const { status } = req.query;
    const where = { locationId: req.params.locationId };
    if (status) where.status = status;
    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(orders.map((o) => ({ ...o, items: safeParse(o.itemsJson) })));
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.post('/:locationId/orders', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { supplier, items, notes } = req.body;
    const list = Array.isArray(items) ? items : [];
    const totalCost = list.reduce((s, it) => s + (parseFloat(it.cost) || 0) * (parseFloat(it.qty) || 0), 0);
    const count = await prisma.purchaseOrder.count({ where: { locationId: req.params.locationId } });
    const order = await prisma.purchaseOrder.create({
      data: {
        locationId: req.params.locationId,
        poNumber: 'PO-' + String(1001 + count),
        supplier: supplier || null,
        itemsJson: JSON.stringify(list),
        totalCost,
        notes: notes || null,
        createdById: req.user.id,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    req.audit('create', 'purchase_order', order.id, { poNumber: order.poNumber });
    res.status(201).json({ ...order, items: list });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.patch('/:locationId/orders/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { status } = req.body;
    const data = {};
    if (status !== undefined) {
      data.status = status;
      if (status === 'ordered') data.orderedAt = new Date();
      if (status === 'received') data.receivedAt = new Date();
    }
    const order = await prisma.purchaseOrder.update({
      where: { id: req.params.id }, data,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({ ...order, items: safeParse(order.itemsJson) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

router.delete('/:locationId/orders/:id', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    await prisma.purchaseOrder.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

function safeParse(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }

module.exports = router;
