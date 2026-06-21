const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Global search across all modules
router.get('/', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const tenantId = req.user.tenantId;
    const query = q.toLowerCase();

    // Search across all modules in parallel
    const [equipment, inventory, customers, tasks, claims, training, suppliers, team] = await Promise.all([
      // Equipment
      prisma.equipment.findMany({
        where: {
          location: { tenantId },
          OR: [
            { name: { contains: query } },
            { category: { contains: query } },
            { serialNumber: { contains: query } },
            { manufacturer: { contains: query } },
          ],
        },
        select: { id: true, name: true, category: true, status: true, locationId: true },
        take: 5,
      }),
      // Inventory
      prisma.inventoryItem.findMany({
        where: {
          location: { tenantId },
          OR: [
            { name: { contains: query } },
            { category: { contains: query } },
          ],
        },
        select: { id: true, name: true, category: true, currentStock: true, unit: true, locationId: true },
        take: 5,
      }),
      // Customers
      prisma.customer.findMany({
        where: {
          tenantId,
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, membershipType: true, email: true },
        take: 5,
      }),
      // Tasks
      prisma.aITask.findMany({
        where: {
          location: { tenantId },
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { category: { contains: query } },
          ],
        },
        select: { id: true, title: true, priority: true, status: true, category: true, locationId: true },
        take: 5,
      }),
      // Claims
      prisma.damageClaim.findMany({
        where: {
          location: { tenantId },
          OR: [
            { description: { contains: query } },
            { vehicleMake: { contains: query } },
            { vehicleModel: { contains: query } },
            { licensePlate: { contains: query } },
            { damageType: { contains: query } },
          ],
        },
        select: { id: true, damageType: true, status: true, vehicleMake: true, vehicleModel: true, locationId: true },
        take: 5,
      }),
      // Training
      prisma.trainingModule.findMany({
        where: {
          tenantId,
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { category: { contains: query } },
          ],
        },
        select: { id: true, title: true, category: true, isRequired: true },
        take: 5,
      }),
      // Suppliers
      prisma.supplier.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: query } },
            { contactEmail: { contains: query } },
          ],
        },
        select: { id: true, name: true, contactEmail: true },
        take: 5,
      }),
      // Team members
      prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, role: true, email: true },
        take: 5,
      }),
    ]);

    // Format results into unified structure
    const results = [];

    equipment.forEach((e) => results.push({
      type: 'equipment', id: e.id, title: e.name,
      subtitle: `${e.category} · ${e.status}`, path: '/equipment',
    }));
    inventory.forEach((i) => results.push({
      type: 'inventory', id: i.id, title: i.name,
      subtitle: `${i.currentStock} ${i.unit} · ${i.category}`, path: '/inventory',
    }));
    customers.forEach((c) => results.push({
      type: 'customer', id: c.id, title: `${c.firstName} ${c.lastName}`,
      subtitle: `${c.membershipType} member${c.email ? ` · ${c.email}` : ''}`, path: '/customers',
    }));
    tasks.forEach((t) => results.push({
      type: 'task', id: t.id, title: t.title,
      subtitle: `${t.priority} · ${t.status} · ${t.category}`, path: '/tasks',
    }));
    claims.forEach((c) => results.push({
      type: 'claim', id: c.id,
      title: `${c.damageType} - ${c.vehicleMake || ''} ${c.vehicleModel || ''}`.trim(),
      subtitle: c.status, path: '/claims',
    }));
    training.forEach((t) => results.push({
      type: 'training', id: t.id, title: t.title,
      subtitle: `${t.category}${t.isRequired ? ' · Required' : ''}`, path: '/training',
    }));
    suppliers.forEach((s) => results.push({
      type: 'supplier', id: s.id, title: s.name,
      subtitle: s.contactEmail || 'No email', path: '/suppliers',
    }));
    team.forEach((u) => results.push({
      type: 'team', id: u.id, title: `${u.firstName} ${u.lastName}`,
      subtitle: `${u.role.replace('_', ' ')} · ${u.email}`, path: '/team',
    }));

    res.json({ results, query: q });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
