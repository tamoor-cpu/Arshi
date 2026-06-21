const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateSupplier } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// List suppliers (tenant-scoped)
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    const where = { tenantId: req.user.tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactEmail: { contains: search } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: { select: { inventoryItems: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(suppliers);
  } catch (err) {
    console.error('Fetch suppliers error:', err);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Add supplier
router.post('/', authenticate, requireRole('SITE_MANAGER'), validateSupplier, async (req, res) => {
  try {
    const { name, contactEmail, phone, website } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        tenantId: req.user.tenantId,
        name,
        contactEmail: contactEmail || null,
        phone: phone || null,
        website: website || null,
      },
      include: {
        _count: { select: { inventoryItems: true } },
      },
    });

    res.status(201).json(supplier);
  } catch (err) {
    console.error('Create supplier error:', err);
    res.status(500).json({ error: 'Failed to add supplier' });
  }
});

// Update supplier
router.patch('/:id', authenticate, requireRole('SITE_MANAGER'), validateSupplier, async (req, res) => {
  try {
    const { name, contactEmail, phone, website } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(phone !== undefined && { phone }),
        ...(website !== undefined && { website }),
      },
      include: {
        _count: { select: { inventoryItems: true } },
      },
    });

    res.json(supplier);
  } catch (err) {
    console.error('Update supplier error:', err);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// Delete supplier
router.delete('/:id', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    // Unlink from inventory items first
    await prisma.inventoryItem.updateMany({
      where: { supplierId: req.params.id },
      data: { supplierId: null },
    });

    await prisma.supplier.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    console.error('Delete supplier error:', err);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

module.exports = router;
