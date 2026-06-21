const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateCustomer, validateVehicle, validateVisit } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();

// List customers (tenant-scoped, paginated)
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, membership, page = 1, limit = 25 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { tenantId: req.user.tenantId };

    if (membership && membership !== 'all') {
      where.membershipType = membership;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          vehicles: true,
          _count: { select: { visits: true, damageClaims: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Fetch customers error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Add customer
router.post('/', authenticate, validateCustomer, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, membershipType, membershipStart, membershipEnd, notes } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId: req.user.tenantId,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        membershipType: membershipType || 'none',
        membershipStart: membershipStart ? new Date(membershipStart) : null,
        membershipEnd: membershipEnd ? new Date(membershipEnd) : null,
        notes: notes || null,
      },
      include: {
        vehicles: true,
        _count: { select: { visits: true, damageClaims: true } },
      },
    });

    req.audit('create', 'customer', customer.id, { firstName, lastName, membershipType });

    res.status(201).json(customer);
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Failed to add customer' });
  }
});

// Get customer detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: {
        vehicles: true,
        visits: {
          include: {
            location: { select: { id: true, name: true } },
          },
          orderBy: { visitDate: 'desc' },
          take: 20,
        },
        damageClaims: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (err) {
    console.error('Fetch customer error:', err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Update customer
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, membershipType, membershipStart, membershipEnd, notes } = req.body;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(membershipType !== undefined && { membershipType }),
        ...(membershipStart !== undefined && { membershipStart: membershipStart ? new Date(membershipStart) : null }),
        ...(membershipEnd !== undefined && { membershipEnd: membershipEnd ? new Date(membershipEnd) : null }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        vehicles: true,
        _count: { select: { visits: true, damageClaims: true } },
      },
    });

    res.json(customer);
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Add vehicle to customer
router.post('/:id/vehicles', authenticate, validateVehicle, async (req, res) => {
  try {
    const { make, model, year, color, licensePlate } = req.body;

    if (!make || !model) {
      return res.status(400).json({ error: 'Make and model are required' });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        customerId: req.params.id,
        make,
        model,
        year: year || null,
        color: color || null,
        licensePlate: licensePlate || null,
      },
    });

    res.status(201).json(vehicle);
  } catch (err) {
    console.error('Add vehicle error:', err);
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

// Delete vehicle
router.delete('/:id/vehicles/:vehicleId', authenticate, async (req, res) => {
  try {
    await prisma.vehicle.delete({
      where: { id: req.params.vehicleId },
    });

    res.json({ message: 'Vehicle removed' });
  } catch (err) {
    console.error('Delete vehicle error:', err);
    res.status(500).json({ error: 'Failed to remove vehicle' });
  }
});

// Log customer visit (location-scoped)
router.post('/:id/visits', authenticate, validateVisit, async (req, res) => {
  try {
    const { locationId, washType, amount, notes } = req.body;

    if (!locationId) {
      return res.status(400).json({ error: 'Location ID is required' });
    }

    const visit = await prisma.customerVisit.create({
      data: {
        customerId: req.params.id,
        locationId,
        washType: washType || null,
        amount: amount || null,
        notes: notes || null,
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(visit);
  } catch (err) {
    console.error('Log visit error:', err);
    res.status(500).json({ error: 'Failed to log visit' });
  }
});

module.exports = router;
