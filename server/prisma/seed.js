const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚗 Seeding WashOps database...\n');

  const passwordHash = await bcrypt.hash('password123', 12);

  // ============================================================
  // TENANT & LOCATIONS
  // ============================================================
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Splash Express Car Wash',
      slug: 'splash-express',
      subscriptionTier: 'pro',
    },
  });

  const mainLocation = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Street Location',
      address: '1234 Main St',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201',
      latitude: 32.7767,
      longitude: -96.797,
      geofenceRadius: 150,
    },
  });

  const secondLocation = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      name: 'Oak Lawn Location',
      address: '5678 Oak Lawn Ave',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75219',
      latitude: 32.8121,
      longitude: -96.8107,
      geofenceRadius: 150,
    },
  });

  // ============================================================
  // USERS
  // ============================================================
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@splashexpress.com',
      passwordHash,
      firstName: 'Tamoor',
      lastName: 'Khan',
      role: 'SUPER_ADMIN',
      phone: '(214) 555-0100',
    },
  });

  const regional = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'regional@splashexpress.com',
      passwordHash,
      firstName: 'David',
      lastName: 'Chen',
      role: 'REGIONAL_ADMIN',
      phone: '(214) 555-0099',
    },
  });

  const manager = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'manager@splashexpress.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: 'SITE_MANAGER',
      phone: '(214) 555-0101',
    },
  });

  const manager2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'manager2@splashexpress.com',
      passwordHash,
      firstName: 'Marcus',
      lastName: 'Brown',
      role: 'SITE_MANAGER',
      phone: '(214) 555-0110',
    },
  });

  const employee1 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'carlos@splashexpress.com',
      passwordHash,
      firstName: 'Carlos',
      lastName: 'Martinez',
      role: 'EMPLOYEE',
      phone: '(214) 555-0102',
    },
  });

  const employee2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'jenny@splashexpress.com',
      passwordHash,
      firstName: 'Jenny',
      lastName: 'Williams',
      role: 'EMPLOYEE',
      phone: '(214) 555-0103',
    },
  });

  const employee3 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'mike@splashexpress.com',
      passwordHash,
      firstName: 'Mike',
      lastName: 'Davis',
      role: 'EMPLOYEE',
      phone: '(214) 555-0104',
    },
  });

  const employee4 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'aisha@splashexpress.com',
      passwordHash,
      firstName: 'Aisha',
      lastName: 'Patel',
      role: 'EMPLOYEE',
      phone: '(214) 555-0105',
    },
  });

  const employee5 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'tom@splashexpress.com',
      passwordHash,
      firstName: 'Tom',
      lastName: 'Rodriguez',
      role: 'EMPLOYEE',
      phone: '(214) 555-0106',
    },
  });

  // Assign users to locations
  await prisma.userLocation.createMany({
    data: [
      { userId: admin.id, locationId: mainLocation.id, isPrimary: true },
      { userId: admin.id, locationId: secondLocation.id },
      { userId: regional.id, locationId: mainLocation.id, isPrimary: true },
      { userId: regional.id, locationId: secondLocation.id },
      { userId: manager.id, locationId: mainLocation.id, isPrimary: true },
      { userId: manager2.id, locationId: secondLocation.id, isPrimary: true },
      { userId: employee1.id, locationId: mainLocation.id, isPrimary: true },
      { userId: employee2.id, locationId: mainLocation.id, isPrimary: true },
      { userId: employee3.id, locationId: mainLocation.id, isPrimary: true },
      { userId: employee4.id, locationId: mainLocation.id, isPrimary: true },
      { userId: employee5.id, locationId: secondLocation.id, isPrimary: true },
    ],
  });
  console.log('✅ Users & locations created');

  // ============================================================
  // SHIFTS
  // ============================================================
  const morningShift = await prisma.shift.create({
    data: {
      locationId: mainLocation.id,
      name: 'Morning',
      startTime: '07:00',
      endTime: '15:00',
      daysOfWeek: '1,2,3,4,5,6,0',
      color: '#3B82F6',
    },
  });

  const afternoonShift = await prisma.shift.create({
    data: {
      locationId: mainLocation.id,
      name: 'Afternoon',
      startTime: '15:00',
      endTime: '21:00',
      daysOfWeek: '1,2,3,4,5,6,0',
      color: '#F59E0B',
    },
  });

  await prisma.shift.create({
    data: {
      locationId: secondLocation.id,
      name: 'Full Day',
      startTime: '08:00',
      endTime: '18:00',
      daysOfWeek: '1,2,3,4,5,6',
      color: '#10B981',
    },
  });
  console.log('✅ Shifts created');

  // ============================================================
  // CHECKLISTS
  // ============================================================
  await prisma.checklistTemplate.create({
    data: {
      tenantId: tenant.id,
      locationId: mainLocation.id,
      name: 'Morning Opening Checklist',
      description: 'Complete before first car enters tunnel',
      type: 'opening',
      tasks: {
        create: [
          { sequence: 1, title: 'Inspect tunnel entrance for debris', section: 'Tunnel', requiresPhoto: true, estimatedMinutes: 5 },
          { sequence: 2, title: 'Check conveyor belt tension & alignment', section: 'Tunnel', estimatedMinutes: 3 },
          { sequence: 3, title: 'Verify all nozzles spraying properly', section: 'Tunnel', requiresPhoto: true, estimatedMinutes: 5 },
          { sequence: 4, title: 'Check soap levels (pre-soak, tri-foam, clear coat)', section: 'Chemicals', requiresPhoto: true, estimatedMinutes: 5 },
          { sequence: 5, title: 'Verify drying blowers operational', section: 'Tunnel', estimatedMinutes: 2 },
          { sequence: 6, title: 'Empty trash cans at vacuum stations', section: 'Grounds', requiresPhoto: true, estimatedMinutes: 10 },
          { sequence: 7, title: 'Stock towels and supplies at detail area', section: 'Supplies', estimatedMinutes: 5 },
          { sequence: 8, title: 'Check vacuum stations - all operational', section: 'Grounds', requiresPhoto: true, estimatedMinutes: 5 },
          { sequence: 9, title: 'Turn on signage and entry system', section: 'Operations', estimatedMinutes: 2 },
          { sequence: 10, title: 'Verify POS terminal and pay stations', section: 'Operations', estimatedMinutes: 3 },
        ],
      },
    },
  });

  await prisma.checklistTemplate.create({
    data: {
      tenantId: tenant.id,
      locationId: mainLocation.id,
      name: 'Evening Closing Checklist',
      description: 'Complete after last car exits tunnel',
      type: 'closing',
      tasks: {
        create: [
          { sequence: 1, title: 'Run empty tunnel wash cycle', section: 'Tunnel', estimatedMinutes: 5 },
          { sequence: 2, title: 'Drain and clean sediment traps', section: 'Tunnel', requiresPhoto: true, estimatedMinutes: 15 },
          { sequence: 3, title: 'Check chemical levels for tomorrow', section: 'Chemicals', requiresPhoto: true, estimatedMinutes: 5 },
          { sequence: 4, title: 'Empty all trash receptacles', section: 'Grounds', requiresPhoto: true, estimatedMinutes: 10 },
          { sequence: 5, title: 'Lock vacuum coin boxes', section: 'Grounds', estimatedMinutes: 5 },
          { sequence: 6, title: 'Close POS and run end-of-day report', section: 'Operations', estimatedMinutes: 5 },
          { sequence: 7, title: 'Turn off signage and entry system', section: 'Operations', estimatedMinutes: 2 },
          { sequence: 8, title: 'Set alarm system', section: 'Security', estimatedMinutes: 2 },
        ],
      },
    },
  });

  await prisma.checklistTemplate.create({
    data: {
      tenantId: tenant.id,
      locationId: mainLocation.id,
      name: 'Chemical Level Check',
      description: 'Verify all chemical tanks and dispensing systems',
      type: 'chemical',
      tasks: {
        create: [
          { sequence: 1, title: 'Pre-soak tank level (min 25%)', section: 'Chemicals', requiresPhoto: true, estimatedMinutes: 2 },
          { sequence: 2, title: 'Tri-foam concentrate level', section: 'Chemicals', requiresPhoto: true, estimatedMinutes: 2 },
          { sequence: 3, title: 'Clear coat sealant level', section: 'Chemicals', requiresPhoto: true, estimatedMinutes: 2 },
          { sequence: 4, title: 'Wheel cleaner concentrate', section: 'Chemicals', requiresPhoto: true, estimatedMinutes: 2 },
          { sequence: 5, title: 'Spot-free rinse system (check TDS)', section: 'Chemicals', requiresPhoto: true, estimatedMinutes: 3 },
          { sequence: 6, title: 'Rain-X application system', section: 'Chemicals', estimatedMinutes: 2 },
        ],
      },
    },
  });
  console.log('✅ Checklists created');

  // ============================================================
  // TUNNEL CYCLES — 7 days of history for analytics
  // ============================================================
  const now = new Date();
  const washTypes = ['basic', 'premium', 'ultimate'];
  const washPrices = { basic: 12, premium: 20, ultimate: 30 };

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    day.setHours(7, 0, 0, 0);

    // Vary car counts: weekdays higher, weekends peak
    const dayOfWeek = day.getDay();
    const baseCars = dayOfWeek === 0 || dayOfWeek === 6 ? 65 : 45;
    const carCount = baseCars + Math.floor(Math.random() * 20);

    for (let i = 0; i < carCount; i++) {
      const startTime = new Date(day);
      startTime.setMinutes(startTime.getMinutes() + Math.floor(i * (780 / carCount))); // spread across 13 hours
      const endTime = new Date(startTime);
      endTime.setSeconds(endTime.getSeconds() + 150 + Math.floor(Math.random() * 60));

      await prisma.tunnelCycle.create({
        data: {
          locationId: mainLocation.id,
          startTime,
          endTime,
          cycleDuration: Math.floor((endTime - startTime) / 1000),
          status: 'completed',
        },
      });
    }
  }
  console.log('✅ Tunnel cycles (7-day history) created');

  // ============================================================
  // SYSTEM ALERTS
  // ============================================================
  await prisma.systemAlert.createMany({
    data: [
      {
        locationId: mainLocation.id,
        alertType: 'chemical',
        severity: 'high',
        title: 'Pre-soak tank low',
        message: 'Pre-soak concentrate is below 15%. Reorder recommended.',
      },
      {
        locationId: mainLocation.id,
        alertType: 'weather',
        severity: 'medium',
        title: 'Rain expected this afternoon',
        message: 'Light rain forecasted 2-5 PM. Expect lower volume.',
      },
      {
        locationId: mainLocation.id,
        alertType: 'staffing',
        severity: 'low',
        title: 'Short staffed tomorrow',
        message: 'Only 2 of 4 afternoon shift positions filled for tomorrow.',
      },
      {
        locationId: mainLocation.id,
        alertType: 'equipment',
        severity: 'high',
        title: 'Vacuum #3 abnormal noise',
        message: 'Vacuum station #3 reported with unusual grinding noise. Needs inspection.',
      },
      {
        locationId: mainLocation.id,
        alertType: 'maintenance',
        severity: 'medium',
        title: 'Conveyor belt inspection due',
        message: 'Monthly conveyor belt inspection is 3 days overdue.',
      },
    ],
  });
  console.log('✅ System alerts created');

  // ============================================================
  // MESSAGES
  // ============================================================
  await prisma.message.createMany({
    data: [
      {
        locationId: mainLocation.id,
        userId: manager.id,
        messageText: 'Good morning team! Remember we have the regional manager visiting today. Let\'s make it a great day!',
        messageType: 'announcement',
      },
      {
        locationId: mainLocation.id,
        userId: employee1.id,
        messageText: 'Opening checklist complete. All systems go!',
        messageType: 'chat',
      },
      {
        locationId: mainLocation.id,
        userId: employee2.id,
        messageText: 'Heads up - vacuum #3 is making a weird noise again',
        messageType: 'chat',
      },
      {
        locationId: mainLocation.id,
        userId: manager.id,
        messageText: 'Thanks Jenny. I\'ll submit a maintenance request for that.',
        messageType: 'chat',
      },
      {
        locationId: mainLocation.id,
        userId: employee3.id,
        messageText: 'Just restocked all towels at the detail area. We\'re running low on microfibers though.',
        messageType: 'chat',
      },
    ],
  });
  console.log('✅ Messages created');

  // ============================================================
  // SUPPLIERS
  // ============================================================
  const supplierChemical = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'BlueWave Chemical Supply',
      contactEmail: 'orders@bluewave.com',
      phone: '(800) 555-2200',
      website: 'https://bluewave-chemicals.com',
    },
  });

  const supplierParts = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'CarWash Pro Parts',
      contactEmail: 'sales@cwproparts.com',
      phone: '(800) 555-3300',
      website: 'https://carwashproparts.com',
    },
  });

  const supplierGeneral = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'CleanTech Distributors',
      contactEmail: 'info@cleantechdist.com',
      phone: '(800) 555-4400',
      website: 'https://cleantechdist.com',
    },
  });

  await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'Texas Industrial Supply',
      contactEmail: 'orders@txindustrial.com',
      phone: '(214) 555-5500',
    },
  });

  await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'AutoShine Products',
      contactEmail: 'wholesale@autoshine.com',
      phone: '(888) 555-6600',
      website: 'https://autoshine.com',
    },
  });
  console.log('✅ Suppliers created');

  // ============================================================
  // EQUIPMENT
  // ============================================================
  const conveyor = await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'Main Conveyor Belt System',
      category: 'conveyor',
      serialNumber: 'CONV-2023-001',
      manufacturer: 'MacNeil Wash Systems',
      model: 'Express 150',
      installDate: new Date('2023-03-15'),
      status: 'operational',
      notes: 'Annual belt replacement due in March',
    },
  });

  const highPressure = await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'High Pressure Pump #1',
      category: 'pump',
      serialNumber: 'HP-2023-101',
      manufacturer: 'Cat Pumps',
      model: 'CP-3520',
      installDate: new Date('2023-03-15'),
      status: 'operational',
    },
  });

  const dryerMain = await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'Main Tunnel Dryer',
      category: 'dryer',
      serialNumber: 'DRY-2023-201',
      manufacturer: 'Proto-Vest',
      model: 'Sahara 7500',
      installDate: new Date('2023-04-01'),
      status: 'operational',
    },
  });

  const vacuum3 = await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'Vacuum Station #3',
      category: 'vacuum',
      serialNumber: 'VAC-2023-303',
      manufacturer: 'JE Adams',
      model: 'Super VAC 9200',
      installDate: new Date('2023-05-10'),
      status: 'needs_maintenance',
      notes: 'Grinding noise reported. Scheduled for repair.',
    },
  });

  const chemSystem = await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'Chemical Dispensing System',
      category: 'chemical_system',
      serialNumber: 'CHEM-2023-401',
      manufacturer: 'Hydra-Flex',
      model: 'Accusystem 10',
      installDate: new Date('2023-03-15'),
      status: 'operational',
    },
  });

  await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'Vacuum Station #1',
      category: 'vacuum',
      serialNumber: 'VAC-2023-301',
      manufacturer: 'JE Adams',
      model: 'Super VAC 9200',
      installDate: new Date('2023-05-10'),
      status: 'operational',
    },
  });

  await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'Vacuum Station #2',
      category: 'vacuum',
      serialNumber: 'VAC-2023-302',
      manufacturer: 'JE Adams',
      model: 'Super VAC 9200',
      installDate: new Date('2023-05-10'),
      status: 'operational',
    },
  });

  const tunnelArch = await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'Foam Arch (Tri-Color)',
      category: 'tunnel',
      serialNumber: 'ARCH-2023-501',
      manufacturer: 'Belanger',
      model: 'FoamMaster 3C',
      installDate: new Date('2023-03-15'),
      status: 'operational',
    },
  });

  await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'Water Reclaim System',
      category: 'pump',
      serialNumber: 'RCL-2023-601',
      manufacturer: 'Con-Serv',
      model: 'RS-500',
      installDate: new Date('2023-06-01'),
      status: 'operational',
      notes: 'Filter change every 30 days',
    },
  });

  await prisma.equipment.create({
    data: {
      locationId: mainLocation.id,
      name: 'Entry Gate System',
      category: 'other',
      serialNumber: 'GATE-2023-701',
      manufacturer: 'DRB Systems',
      model: 'FastPass Pro',
      installDate: new Date('2023-03-15'),
      status: 'operational',
    },
  });
  console.log('✅ Equipment created');

  // ============================================================
  // MAINTENANCE LOGS
  // ============================================================
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await prisma.maintenanceLog.create({
    data: {
      equipmentId: conveyor.id,
      performedById: employee1.id,
      type: 'inspection',
      description: 'Monthly conveyor belt inspection. Tension within spec, no visible wear.',
      cost: 0,
      partsUsed: '[]',
      scheduledDate: new Date(now.getTime() - 14 * 86400000),
      completedAt: new Date(now.getTime() - 14 * 86400000),
      status: 'completed',
    },
  });

  await prisma.maintenanceLog.create({
    data: {
      equipmentId: highPressure.id,
      performedById: manager.id,
      type: 'preventive',
      description: 'Replaced pump seals and O-rings. Checked pressure output: 1200 PSI nominal.',
      cost: 185.50,
      partsUsed: JSON.stringify(['Seal kit (3 pack)', 'O-ring set']),
      scheduledDate: new Date(now.getTime() - 7 * 86400000),
      completedAt: new Date(now.getTime() - 7 * 86400000),
      status: 'completed',
    },
  });

  await prisma.maintenanceLog.create({
    data: {
      equipmentId: vacuum3.id,
      performedById: employee1.id,
      type: 'repair',
      description: 'Investigate grinding noise. Possible bearing failure in motor.',
      cost: null,
      partsUsed: '[]',
      scheduledDate: new Date(now.getTime() + 1 * 86400000),
      status: 'scheduled',
      notes: 'Ordered replacement motor bearings from CWP Parts',
    },
  });

  await prisma.maintenanceLog.create({
    data: {
      equipmentId: dryerMain.id,
      performedById: employee3.id,
      type: 'preventive',
      description: 'Cleaned dryer nozzles and replaced air filters. Output within spec.',
      cost: 95.00,
      partsUsed: JSON.stringify(['Air filter (2x)', 'Nozzle cleaning kit']),
      completedAt: new Date(now.getTime() - 21 * 86400000),
      status: 'completed',
    },
  });

  await prisma.maintenanceLog.create({
    data: {
      equipmentId: chemSystem.id,
      performedById: manager.id,
      type: 'inspection',
      description: 'Calibrated all chemical dispensing rates. Pre-soak running slightly lean, adjusted +5%.',
      cost: 0,
      completedAt: new Date(now.getTime() - 3 * 86400000),
      status: 'completed',
    },
  });

  await prisma.maintenanceLog.create({
    data: {
      equipmentId: tunnelArch.id,
      performedById: employee1.id,
      type: 'emergency',
      description: 'Foam nozzle #2 clogged during peak hours. Cleared blockage and tested.',
      cost: 0,
      completedAt: new Date(now.getTime() - 5 * 86400000),
      status: 'completed',
      notes: 'Need to monitor — second clog this month',
    },
  });
  console.log('✅ Maintenance logs created');

  // ============================================================
  // INVENTORY ITEMS
  // ============================================================
  const invPresoak = await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierChemical.id,
      name: 'Pre-Soak Concentrate',
      category: 'chemical',
      unit: 'gallons',
      currentStock: 12,
      minStock: 20,
      maxStock: 100,
      costPerUnit: 28.50,
    },
  });

  const invTrifoam = await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierChemical.id,
      name: 'Tri-Foam Polish',
      category: 'chemical',
      unit: 'gallons',
      currentStock: 35,
      minStock: 15,
      maxStock: 80,
      costPerUnit: 42.00,
    },
  });

  const invClearcoat = await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierChemical.id,
      name: 'Clear Coat Sealant',
      category: 'chemical',
      unit: 'gallons',
      currentStock: 8,
      minStock: 10,
      maxStock: 50,
      costPerUnit: 55.00,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierChemical.id,
      name: 'Wheel Cleaner Concentrate',
      category: 'chemical',
      unit: 'gallons',
      currentStock: 22,
      minStock: 10,
      maxStock: 60,
      costPerUnit: 35.00,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierChemical.id,
      name: 'Rain-X Protectant',
      category: 'chemical',
      unit: 'gallons',
      currentStock: 18,
      minStock: 8,
      maxStock: 40,
      costPerUnit: 65.00,
    },
  });

  const invTowels = await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierGeneral.id,
      name: 'Microfiber Towels',
      category: 'supply',
      unit: 'each',
      currentStock: 45,
      minStock: 50,
      maxStock: 200,
      costPerUnit: 2.50,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierGeneral.id,
      name: 'Trash Bags (55 gallon)',
      category: 'supply',
      unit: 'cases',
      currentStock: 8,
      minStock: 3,
      maxStock: 20,
      costPerUnit: 32.00,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierParts.id,
      name: 'Conveyor Belt Rollers',
      category: 'part',
      unit: 'each',
      currentStock: 4,
      minStock: 2,
      maxStock: 10,
      costPerUnit: 89.00,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierParts.id,
      name: 'Pump Seal Kits',
      category: 'part',
      unit: 'each',
      currentStock: 6,
      minStock: 3,
      maxStock: 15,
      costPerUnit: 45.00,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierGeneral.id,
      name: 'Air Freshener (New Car)',
      category: 'supply',
      unit: 'cases',
      currentStock: 12,
      minStock: 5,
      maxStock: 30,
      costPerUnit: 24.00,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierGeneral.id,
      name: 'Glass Cleaner',
      category: 'cleaning',
      unit: 'gallons',
      currentStock: 5,
      minStock: 4,
      maxStock: 20,
      costPerUnit: 12.00,
    },
  });

  await prisma.inventoryItem.create({
    data: {
      locationId: mainLocation.id,
      supplierId: supplierGeneral.id,
      name: 'Interior Degreaser',
      category: 'cleaning',
      unit: 'gallons',
      currentStock: 7,
      minStock: 3,
      maxStock: 15,
      costPerUnit: 18.50,
    },
  });
  console.log('✅ Inventory items created');

  // ============================================================
  // INVENTORY USAGE LOGS
  // ============================================================
  const usageLogs = [
    { itemId: invPresoak.id, userId: employee1.id, quantity: -5, type: 'usage', notes: 'Daily usage', createdAt: new Date(now.getTime() - 1 * 86400000) },
    { itemId: invPresoak.id, userId: employee2.id, quantity: -4, type: 'usage', notes: 'Daily usage', createdAt: new Date(now.getTime() - 2 * 86400000) },
    { itemId: invPresoak.id, userId: manager.id, quantity: 50, type: 'restock', notes: 'Shipment from BlueWave', createdAt: new Date(now.getTime() - 5 * 86400000) },
    { itemId: invTrifoam.id, userId: employee1.id, quantity: -3, type: 'usage', notes: 'Daily usage', createdAt: new Date(now.getTime() - 1 * 86400000) },
    { itemId: invTrifoam.id, userId: employee3.id, quantity: -2, type: 'usage', notes: null, createdAt: new Date(now.getTime() - 3 * 86400000) },
    { itemId: invClearcoat.id, userId: employee2.id, quantity: -2, type: 'usage', notes: 'Heavy usage today — lots of premium washes', createdAt: new Date(now.getTime() - 1 * 86400000) },
    { itemId: invTowels.id, userId: employee4.id, quantity: -15, type: 'usage', notes: 'Detail bay usage', createdAt: new Date(now.getTime() - 1 * 86400000) },
    { itemId: invTowels.id, userId: employee3.id, quantity: -10, type: 'waste', notes: 'Stained beyond cleaning', createdAt: new Date(now.getTime() - 3 * 86400000) },
  ];

  for (const log of usageLogs) {
    await prisma.inventoryUsageLog.create({ data: log });
  }
  console.log('✅ Inventory usage logs created');

  // ============================================================
  // CUSTOMERS
  // ============================================================
  const customer1 = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Robert',
      lastName: 'Thompson',
      email: 'robert.t@gmail.com',
      phone: '(214) 555-7001',
      membershipType: 'unlimited',
      membershipStart: new Date('2024-01-15'),
      membershipEnd: new Date('2025-01-15'),
      notes: 'VIP customer since 2024. Prefers ultimate wash.',
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Linda',
      lastName: 'Garcia',
      email: 'lgarcia@outlook.com',
      phone: '(214) 555-7002',
      membershipType: 'premium',
      membershipStart: new Date('2024-06-01'),
      membershipEnd: new Date('2025-06-01'),
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      firstName: 'James',
      lastName: 'Wilson',
      email: 'jwilson@yahoo.com',
      phone: '(214) 555-7003',
      membershipType: 'basic',
      membershipStart: new Date('2024-09-01'),
      membershipEnd: new Date('2025-09-01'),
    },
  });

  const customer4 = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Patricia',
      lastName: 'Lee',
      email: 'plee@icloud.com',
      phone: '(214) 555-7004',
      membershipType: 'unlimited',
      membershipStart: new Date('2024-03-10'),
      membershipEnd: new Date('2025-03-10'),
    },
  });

  const customer5 = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Michael',
      lastName: 'Anderson',
      phone: '(214) 555-7005',
      membershipType: 'none',
      notes: 'Walk-in regular, comes every Saturday',
    },
  });

  const customer6 = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Jennifer',
      lastName: 'Martinez',
      email: 'jen.martinez@gmail.com',
      phone: '(214) 555-7006',
      membershipType: 'premium',
      membershipStart: new Date('2024-11-01'),
      membershipEnd: new Date('2025-11-01'),
    },
  });

  const customer7 = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      firstName: 'William',
      lastName: 'Taylor',
      email: 'will.taylor@company.com',
      phone: '(214) 555-7007',
      membershipType: 'none',
    },
  });

  const customer8 = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Emily',
      lastName: 'Davis',
      email: 'emily.d@gmail.com',
      membershipType: 'basic',
      membershipStart: new Date('2025-01-15'),
      membershipEnd: new Date('2026-01-15'),
    },
  });
  console.log('✅ Customers created');

  // ============================================================
  // VEHICLES
  // ============================================================
  await prisma.vehicle.createMany({
    data: [
      { customerId: customer1.id, make: 'BMW', model: 'X5', year: '2023', color: 'Black', licensePlate: 'TX-BMX5-01' },
      { customerId: customer1.id, make: 'Mercedes', model: 'E-Class', year: '2022', color: 'Silver', licensePlate: 'TX-MBE-02' },
      { customerId: customer2.id, make: 'Toyota', model: 'Camry', year: '2024', color: 'White', licensePlate: 'TX-TCM-03' },
      { customerId: customer3.id, make: 'Ford', model: 'F-150', year: '2023', color: 'Blue', licensePlate: 'TX-FF1-04' },
      { customerId: customer4.id, make: 'Tesla', model: 'Model Y', year: '2024', color: 'Red', licensePlate: 'TX-TMY-05' },
      { customerId: customer4.id, make: 'Lexus', model: 'RX 350', year: '2023', color: 'Pearl White', licensePlate: 'TX-LRX-06' },
      { customerId: customer5.id, make: 'Chevrolet', model: 'Silverado', year: '2022', color: 'Gray', licensePlate: 'TX-CSV-07' },
      { customerId: customer6.id, make: 'Honda', model: 'CR-V', year: '2024', color: 'Green', licensePlate: 'TX-HCV-08' },
      { customerId: customer7.id, make: 'Audi', model: 'Q5', year: '2023', color: 'Black', licensePlate: 'TX-AQ5-09' },
      { customerId: customer8.id, make: 'Hyundai', model: 'Tucson', year: '2024', color: 'Blue', licensePlate: 'TX-HTU-10' },
    ],
  });
  console.log('✅ Vehicles created');

  // ============================================================
  // CUSTOMER VISITS
  // ============================================================
  const visitData = [
    { customerId: customer1.id, washType: 'ultimate', amount: 30.00, daysAgo: 1 },
    { customerId: customer1.id, washType: 'ultimate', amount: 30.00, daysAgo: 4 },
    { customerId: customer1.id, washType: 'ultimate', amount: 30.00, daysAgo: 8 },
    { customerId: customer2.id, washType: 'premium', amount: 20.00, daysAgo: 2 },
    { customerId: customer2.id, washType: 'premium', amount: 20.00, daysAgo: 7 },
    { customerId: customer3.id, washType: 'basic', amount: 12.00, daysAgo: 3 },
    { customerId: customer3.id, washType: 'premium', amount: 20.00, daysAgo: 10 },
    { customerId: customer4.id, washType: 'ultimate', amount: 30.00, daysAgo: 0 },
    { customerId: customer4.id, washType: 'ultimate', amount: 30.00, daysAgo: 3 },
    { customerId: customer4.id, washType: 'ultimate', amount: 30.00, daysAgo: 6 },
    { customerId: customer4.id, washType: 'ultimate', amount: 30.00, daysAgo: 10 },
    { customerId: customer5.id, washType: 'basic', amount: 12.00, daysAgo: 6 },
    { customerId: customer6.id, washType: 'premium', amount: 20.00, daysAgo: 1 },
    { customerId: customer6.id, washType: 'premium', amount: 20.00, daysAgo: 5 },
    { customerId: customer7.id, washType: 'basic', amount: 12.00, daysAgo: 9 },
    { customerId: customer8.id, washType: 'basic', amount: 12.00, daysAgo: 2 },
    { customerId: customer8.id, washType: 'premium', amount: 20.00, daysAgo: 8 },
  ];

  for (const v of visitData) {
    const visitDate = new Date(now);
    visitDate.setDate(visitDate.getDate() - v.daysAgo);
    await prisma.customerVisit.create({
      data: {
        customerId: v.customerId,
        locationId: mainLocation.id,
        washType: v.washType,
        amount: v.amount,
        visitDate,
      },
    });
  }
  console.log('✅ Customer visits created');

  // ============================================================
  // DAMAGE CLAIMS
  // ============================================================
  await prisma.damageClaim.create({
    data: {
      locationId: mainLocation.id,
      customerId: customer7.id,
      reportedById: manager.id,
      vehicleMake: 'Audi',
      vehicleModel: 'Q5',
      vehicleYear: '2023',
      vehicleColor: 'Black',
      licensePlate: 'TX-AQ5-09',
      description: 'Customer reports scratch on passenger side rear quarter panel after wash cycle. Alleges scratch was not there before entering tunnel.',
      damageType: 'scratch',
      status: 'investigating',
      estimatedCost: 450.00,
      createdAt: new Date(now.getTime() - 2 * 86400000),
    },
  });

  await prisma.damageClaim.create({
    data: {
      locationId: mainLocation.id,
      reportedById: employee2.id,
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      vehicleYear: '2020',
      vehicleColor: 'White',
      licensePlate: 'TX-TCR-99',
      description: 'Side mirror folded during tunnel cycle. Mirror housing cracked.',
      damageType: 'mirror',
      status: 'approved',
      estimatedCost: 280.00,
      resolution: 'Customer provided repair receipt. Reimbursement approved for $280.',
      createdAt: new Date(now.getTime() - 10 * 86400000),
    },
  });

  await prisma.damageClaim.create({
    data: {
      locationId: mainLocation.id,
      reportedById: employee1.id,
      vehicleMake: 'Honda',
      vehicleModel: 'Accord',
      vehicleYear: '2021',
      vehicleColor: 'Gray',
      description: 'Customer claims antenna broken off during wash. However, antenna appears to have been previously damaged.',
      damageType: 'antenna',
      status: 'denied',
      estimatedCost: 120.00,
      resolution: 'Pre-existing damage verified via entrance camera footage. Claim denied.',
      resolvedAt: new Date(now.getTime() - 5 * 86400000),
      createdAt: new Date(now.getTime() - 8 * 86400000),
    },
  });

  await prisma.damageClaim.create({
    data: {
      locationId: mainLocation.id,
      customerId: customer5.id,
      reportedById: manager.id,
      vehicleMake: 'Chevrolet',
      vehicleModel: 'Silverado',
      vehicleYear: '2022',
      vehicleColor: 'Gray',
      licensePlate: 'TX-CSV-07',
      description: 'Small dent noticed on tailgate after wash. Customer is a regular and noticed immediately.',
      damageType: 'dent',
      status: 'reported',
      createdAt: new Date(now.getTime() - 0.5 * 86400000),
    },
  });
  console.log('✅ Damage claims created');

  // ============================================================
  // TRAINING MODULES
  // ============================================================
  const trainingModules = await Promise.all([
    prisma.trainingModule.create({
      data: {
        tenantId: tenant.id,
        title: 'Safety First: Personal Protective Equipment',
        description: 'Learn about required PPE for all car wash operations including chemical handling, tunnel work, and equipment maintenance.',
        category: 'safety',
        durationMinutes: 30,
        isRequired: true,
        sequence: 1,
        content: '# PPE Requirements\n\nAll employees must wear appropriate PPE when working in the following areas...',
      },
    }),
    prisma.trainingModule.create({
      data: {
        tenantId: tenant.id,
        title: 'Chemical Handling & MSDS',
        description: 'Proper chemical handling procedures, storage requirements, and emergency protocols for all wash chemicals.',
        category: 'chemical',
        durationMinutes: 45,
        isRequired: true,
        sequence: 2,
        content: '# Chemical Safety\n\nProper handling of car wash chemicals is critical for employee safety...',
      },
    }),
    prisma.trainingModule.create({
      data: {
        tenantId: tenant.id,
        title: 'Tunnel Equipment Operation',
        description: 'How to operate, monitor, and troubleshoot the tunnel wash system including conveyor, arches, and dryers.',
        category: 'equipment',
        durationMinutes: 60,
        isRequired: true,
        sequence: 3,
        content: '# Tunnel Operations\n\nThe tunnel wash system consists of several key components...',
      },
    }),
    prisma.trainingModule.create({
      data: {
        tenantId: tenant.id,
        title: 'Customer Service Excellence',
        description: 'Best practices for greeting customers, handling complaints, upselling services, and creating a positive experience.',
        category: 'customer_service',
        durationMinutes: 40,
        isRequired: true,
        sequence: 4,
        content: '# Customer Service\n\nEvery customer interaction is an opportunity to build loyalty...',
      },
    }),
    prisma.trainingModule.create({
      data: {
        tenantId: tenant.id,
        title: 'Damage Prevention & Claims',
        description: 'How to prevent vehicle damage, properly document incidents, and handle damage claims professionally.',
        category: 'operations',
        durationMinutes: 35,
        isRequired: false,
        sequence: 5,
        content: '# Damage Prevention\n\nPreventing vehicle damage starts before the car enters the tunnel...',
      },
    }),
    prisma.trainingModule.create({
      data: {
        tenantId: tenant.id,
        title: 'Vacuum Station Maintenance',
        description: 'Daily maintenance, troubleshooting, and repair procedures for vacuum stations.',
        category: 'equipment',
        durationMinutes: 25,
        isRequired: false,
        sequence: 6,
      },
    }),
    prisma.trainingModule.create({
      data: {
        tenantId: tenant.id,
        title: 'Emergency Procedures',
        description: 'Fire safety, chemical spill response, severe weather protocols, and first aid procedures.',
        category: 'safety',
        durationMinutes: 45,
        isRequired: true,
        sequence: 7,
        content: '# Emergency Procedures\n\nIn case of emergency, employee safety is the top priority...',
      },
    }),
    prisma.trainingModule.create({
      data: {
        tenantId: tenant.id,
        title: 'Point-of-Sale & Membership Systems',
        description: 'Operating the POS terminal, processing payments, managing memberships, and handling refunds.',
        category: 'operations',
        durationMinutes: 30,
        isRequired: false,
        sequence: 8,
      },
    }),
  ]);
  console.log('✅ Training modules created');

  // ============================================================
  // TRAINING COMPLETIONS
  // ============================================================
  // Manager and Carlos have completed most, Jenny in progress, Mike just started
  const completionsData = [
    // Manager — completed all required + some optional
    { moduleIdx: 0, userId: manager.id, status: 'completed', score: 95 },
    { moduleIdx: 1, userId: manager.id, status: 'completed', score: 92 },
    { moduleIdx: 2, userId: manager.id, status: 'completed', score: 88 },
    { moduleIdx: 3, userId: manager.id, status: 'completed', score: 97 },
    { moduleIdx: 4, userId: manager.id, status: 'completed', score: 90 },
    { moduleIdx: 6, userId: manager.id, status: 'completed', score: 94 },
    { moduleIdx: 7, userId: manager.id, status: 'completed', score: 85 },

    // Carlos — completed required
    { moduleIdx: 0, userId: employee1.id, status: 'completed', score: 88 },
    { moduleIdx: 1, userId: employee1.id, status: 'completed', score: 82 },
    { moduleIdx: 2, userId: employee1.id, status: 'completed', score: 90 },
    { moduleIdx: 3, userId: employee1.id, status: 'completed', score: 78 },
    { moduleIdx: 6, userId: employee1.id, status: 'completed', score: 85 },

    // Jenny — halfway through
    { moduleIdx: 0, userId: employee2.id, status: 'completed', score: 92 },
    { moduleIdx: 1, userId: employee2.id, status: 'completed', score: 85 },
    { moduleIdx: 2, userId: employee2.id, status: 'in_progress', score: null },

    // Mike — just started
    { moduleIdx: 0, userId: employee3.id, status: 'completed', score: 75 },
    { moduleIdx: 1, userId: employee3.id, status: 'in_progress', score: null },

    // Aisha — good progress
    { moduleIdx: 0, userId: employee4.id, status: 'completed', score: 94 },
    { moduleIdx: 1, userId: employee4.id, status: 'completed', score: 89 },
    { moduleIdx: 2, userId: employee4.id, status: 'completed', score: 86 },
    { moduleIdx: 3, userId: employee4.id, status: 'in_progress', score: null },
  ];

  for (const c of completionsData) {
    await prisma.trainingCompletion.create({
      data: {
        moduleId: trainingModules[c.moduleIdx].id,
        userId: c.userId,
        status: c.status,
        score: c.score,
        completedAt: c.status === 'completed' ? new Date(now.getTime() - Math.floor(Math.random() * 30) * 86400000) : null,
      },
    });
  }
  console.log('✅ Training completions created');

  // ============================================================
  // AI TASKS
  // ============================================================
  const dueToday = new Date(now);
  dueToday.setHours(17, 0, 0, 0);
  const dueTomorrow = new Date(now);
  dueTomorrow.setDate(dueTomorrow.getDate() + 1);
  dueTomorrow.setHours(12, 0, 0, 0);

  await prisma.aITask.createMany({
    data: [
      {
        locationId: mainLocation.id,
        assignedToId: employee1.id,
        createdById: manager.id,
        title: 'Reorder Pre-Soak Concentrate',
        description: 'Pre-soak stock is at 12 gallons, below minimum of 20. Place order with BlueWave Chemical for 50 gallons.',
        priority: 'high',
        category: 'chemical',
        source: 'ai_generated',
        status: 'assigned',
        dueBy: dueToday,
        aiReason: 'Auto-generated: Pre-Soak Concentrate stock (12) below minimum threshold (20)',
      },
      {
        locationId: mainLocation.id,
        assignedToId: employee2.id,
        createdById: null,
        title: 'Investigate Vacuum #3 grinding noise',
        description: 'Vacuum station #3 reported with abnormal grinding noise. Inspect motor bearings and vacuum head.',
        priority: 'high',
        category: 'maintenance',
        source: 'alert',
        status: 'in_progress',
        dueBy: dueToday,
        aiReason: 'Auto-generated from equipment alert: Vacuum #3 abnormal noise',
      },
      {
        locationId: mainLocation.id,
        assignedToId: employee3.id,
        createdById: manager.id,
        title: 'Restock microfiber towels',
        description: 'Microfiber towel count is 45, below minimum of 50. Order 100 towels from CleanTech.',
        priority: 'medium',
        category: 'chemical',
        source: 'ai_generated',
        status: 'pending',
        dueBy: dueTomorrow,
        aiReason: 'Auto-generated: Microfiber Towels stock (45) below minimum threshold (50)',
      },
      {
        locationId: mainLocation.id,
        assignedToId: employee4.id,
        createdById: manager.id,
        title: 'Restock Clear Coat Sealant',
        description: 'Clear coat sealant at 8 gallons, below minimum 10. Order from BlueWave.',
        priority: 'medium',
        category: 'chemical',
        source: 'ai_generated',
        status: 'assigned',
        dueBy: dueTomorrow,
        aiReason: 'Auto-generated: Clear Coat Sealant stock (8) below minimum threshold (10)',
      },
      {
        locationId: mainLocation.id,
        assignedToId: employee1.id,
        createdById: manager.id,
        title: 'Monthly conveyor belt inspection',
        description: 'Overdue monthly conveyor belt inspection. Check tension, alignment, roller condition, and belt wear.',
        priority: 'high',
        category: 'maintenance',
        source: 'ai_generated',
        status: 'pending',
        dueBy: dueToday,
        aiReason: 'Auto-generated from alert: Conveyor belt inspection is 3 days overdue',
      },
      {
        locationId: mainLocation.id,
        assignedToId: null,
        createdById: manager.id,
        title: 'Deep clean vacuum bays',
        description: 'All vacuum bays need deep cleaning. Wipe down units, empty debris traps, and clean surroundings.',
        priority: 'low',
        category: 'cleaning',
        source: 'manual',
        status: 'pending',
        dueBy: dueTomorrow,
      },
      {
        locationId: mainLocation.id,
        assignedToId: employee3.id,
        createdById: manager.id,
        title: 'Update signage at entrance',
        description: 'Replace faded pricing signs at tunnel entrance with new laminated versions.',
        priority: 'low',
        category: 'other',
        source: 'manual',
        status: 'assigned',
      },
      {
        locationId: mainLocation.id,
        assignedToId: employee2.id,
        createdById: manager.id,
        title: 'Train new customer on membership kiosk',
        description: 'Customer Patricia Lee had trouble with the self-service kiosk. Follow up to ensure she can use it.',
        priority: 'medium',
        category: 'customer',
        source: 'manual',
        status: 'completed',
        completedAt: new Date(now.getTime() - 1 * 86400000),
      },
      {
        locationId: mainLocation.id,
        assignedToId: employee1.id,
        createdById: null,
        title: 'Check foam arch nozzle #2',
        description: 'Nozzle #2 on tri-color foam arch clogged twice this month. Inspect and consider replacement.',
        priority: 'medium',
        category: 'maintenance',
        source: 'ai_generated',
        status: 'assigned',
        dueBy: dueTomorrow,
        aiReason: 'Auto-generated: Recurring maintenance issue detected on Foam Arch nozzle #2',
      },
    ],
  });
  console.log('✅ AI Tasks created');

  // ============================================================
  // INCIDENT REPORTS
  // ============================================================
  await prisma.incidentReport.createMany({
    data: [
      {
        locationId: mainLocation.id,
        reporterId: employee2.id,
        incidentType: 'equipment',
        title: 'Vacuum #3 motor grinding',
        description: 'Vacuum station #3 started making a grinding noise around 11 AM. Shut it down and placed an out-of-order sign.',
        photoUrls: '[]',
        status: 'investigating',
        createdAt: new Date(now.getTime() - 2 * 86400000),
      },
      {
        locationId: mainLocation.id,
        reporterId: employee1.id,
        incidentType: 'customer',
        title: 'Customer complaint about water spots',
        description: 'Customer in white Toyota complained about water spots after premium wash. Offered free re-wash, customer satisfied.',
        photoUrls: '[]',
        status: 'resolved',
        resolvedAt: new Date(now.getTime() - 4 * 86400000),
        createdAt: new Date(now.getTime() - 5 * 86400000),
      },
      {
        locationId: mainLocation.id,
        reporterId: manager.id,
        incidentType: 'safety',
        title: 'Wet floor slip hazard at exit',
        description: 'Water drainage backup at tunnel exit causing pooling. Added extra floor mats and cones. Need plumber for drain inspection.',
        photoUrls: '[]',
        status: 'open',
        createdAt: new Date(now.getTime() - 1 * 86400000),
      },
    ],
  });
  console.log('✅ Incident reports created');

  // ============================================================
  // DONE
  // ============================================================
  console.log('\n🎉 Seed complete!\n');
  console.log('Login credentials (all passwords: password123):');
  console.log('  Super Admin:    admin@splashexpress.com');
  console.log('  Regional Admin: regional@splashexpress.com');
  console.log('  Site Manager:   manager@splashexpress.com');
  console.log('  Site Manager 2: manager2@splashexpress.com');
  console.log('  Employee:       carlos@splashexpress.com');
  console.log('  Employee:       jenny@splashexpress.com');
  console.log('  Employee:       mike@splashexpress.com');
  console.log('  Employee:       aisha@splashexpress.com');
  console.log('  Employee:       tom@splashexpress.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
