const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole, requireLocationAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Helper: convert array of objects to CSV
function toCSV(data, columns) {
  const header = columns.map((c) => c.label).join(',');
  const rows = data.map((row) =>
    columns.map((c) => {
      let val = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      if (val === null || val === undefined) val = '';
      // Escape CSV values
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val}"`;
      }
      return val;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

// Export inventory
router.get('/:locationId/export/inventory', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { locationId: req.params.locationId, isActive: true },
      include: { supplier: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    const columns = [
      { label: 'Name', accessor: 'name' },
      { label: 'Category', accessor: 'category' },
      { label: 'Current Stock', accessor: 'currentStock' },
      { label: 'Min Stock', accessor: 'minStock' },
      { label: 'Max Stock', accessor: 'maxStock' },
      { label: 'Unit', accessor: 'unit' },
      { label: 'Cost Per Unit', accessor: 'costPerUnit' },
      { label: 'Supplier', accessor: (r) => r.supplier?.name || '' },
      { label: 'Status', accessor: (r) => r.currentStock <= r.minStock ? 'LOW STOCK' : 'OK' },
    ];

    const csv = toCSV(items, columns);
    req.audit('export', 'inventory', null, { count: items.length });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=inventory-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export inventory error:', err);
    res.status(500).json({ error: 'Failed to export inventory' });
  }
});

// Export claims
router.get('/:locationId/export/claims', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const claims = await prisma.damageClaim.findMany({
      where: { locationId: req.params.locationId },
      include: {
        reportedBy: { select: { firstName: true, lastName: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const columns = [
      { label: 'Date', accessor: (r) => new Date(r.createdAt).toLocaleDateString() },
      { label: 'Damage Type', accessor: 'damageType' },
      { label: 'Description', accessor: 'description' },
      { label: 'Vehicle', accessor: (r) => [r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(' ') },
      { label: 'License Plate', accessor: 'licensePlate' },
      { label: 'Reported By', accessor: (r) => `${r.reportedBy.firstName} ${r.reportedBy.lastName}` },
      { label: 'Customer', accessor: (r) => r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : '' },
      { label: 'Status', accessor: 'status' },
      { label: 'Estimated Cost', accessor: (r) => r.estimatedCost ? `$${r.estimatedCost.toFixed(2)}` : '' },
      { label: 'Resolution', accessor: 'resolution' },
    ];

    const csv = toCSV(claims, columns);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=claims-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export claims error:', err);
    res.status(500).json({ error: 'Failed to export claims' });
  }
});

// Export team / users
router.get('/:locationId/export/team', authenticate, requireLocationAccess, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const userLocations = await prisma.userLocation.findMany({
      where: { locationId: req.params.locationId },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
        },
      },
    });

    const columns = [
      { label: 'First Name', accessor: (r) => r.user.firstName },
      { label: 'Last Name', accessor: (r) => r.user.lastName },
      { label: 'Email', accessor: (r) => r.user.email },
      { label: 'Phone', accessor: (r) => r.user.phone || '' },
      { label: 'Role', accessor: (r) => r.user.role },
      { label: 'Active', accessor: (r) => r.user.isActive ? 'Yes' : 'No' },
      { label: 'Joined', accessor: (r) => new Date(r.user.createdAt).toLocaleDateString() },
    ];

    const csv = toCSV(userLocations, columns);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=team-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export team error:', err);
    res.status(500).json({ error: 'Failed to export team' });
  }
});

// Export equipment
router.get('/:locationId/export/equipment', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const equipment = await prisma.equipment.findMany({
      where: { locationId: req.params.locationId },
      include: {
        maintenanceLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });

    const columns = [
      { label: 'Name', accessor: 'name' },
      { label: 'Category', accessor: 'category' },
      { label: 'Status', accessor: 'status' },
      { label: 'Serial Number', accessor: 'serialNumber' },
      { label: 'Manufacturer', accessor: 'manufacturer' },
      { label: 'Model', accessor: 'model' },
      { label: 'Install Date', accessor: (r) => r.installDate ? new Date(r.installDate).toLocaleDateString() : '' },
      { label: 'Last Maintenance', accessor: (r) => r.maintenanceLogs[0] ? new Date(r.maintenanceLogs[0].createdAt).toLocaleDateString() : 'Never' },
    ];

    const csv = toCSV(equipment, columns);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=equipment-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export equipment error:', err);
    res.status(500).json({ error: 'Failed to export equipment' });
  }
});

// Export customers
router.get('/export/customers', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { tenantId: req.user.tenantId },
      include: {
        vehicles: true,
        _count: { select: { visits: true } },
      },
      orderBy: { lastName: 'asc' },
    });

    const columns = [
      { label: 'First Name', accessor: 'firstName' },
      { label: 'Last Name', accessor: 'lastName' },
      { label: 'Email', accessor: 'email' },
      { label: 'Phone', accessor: 'phone' },
      { label: 'Membership', accessor: 'membershipType' },
      { label: 'Vehicles', accessor: (r) => r.vehicles.map((v) => `${v.year || ''} ${v.make} ${v.model}`.trim()).join('; ') },
      { label: 'Total Visits', accessor: (r) => r._count.visits },
      { label: 'Member Since', accessor: (r) => new Date(r.createdAt).toLocaleDateString() },
    ];

    const csv = toCSV(customers, columns);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=customers-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export customers error:', err);
    res.status(500).json({ error: 'Failed to export customers' });
  }
});

// Export tasks
router.get('/:locationId/export/tasks', authenticate, requireLocationAccess, async (req, res) => {
  try {
    const tasks = await prisma.aITask.findMany({
      where: { locationId: req.params.locationId },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const columns = [
      { label: 'Title', accessor: 'title' },
      { label: 'Priority', accessor: 'priority' },
      { label: 'Category', accessor: 'category' },
      { label: 'Status', accessor: 'status' },
      { label: 'Source', accessor: 'source' },
      { label: 'Assigned To', accessor: (r) => r.assignedTo ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}` : '' },
      { label: 'Created By', accessor: (r) => r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : 'System' },
      { label: 'Due', accessor: (r) => r.dueBy ? new Date(r.dueBy).toLocaleDateString() : '' },
      { label: 'Created', accessor: (r) => new Date(r.createdAt).toLocaleDateString() },
    ];

    const csv = toCSV(tasks, columns);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=tasks-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export tasks error:', err);
    res.status(500).json({ error: 'Failed to export tasks' });
  }
});

module.exports = router;
