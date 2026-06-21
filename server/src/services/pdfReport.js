/**
 * PDF Report Generation Service using pdfkit.
 * Generates 4 report types: operations_summary, inventory, equipment_health, training_compliance.
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const REPORTS_DIR = path.join(__dirname, '../../reports');
const BRAND_COLOR = [30, 58, 95]; // wash-900
const ACCENT_COLOR = [59, 130, 246]; // blue-500

// ─── Helpers ────────────────────────────────────────────

function drawHeader(doc, { title, locationName, dateRange, timestamp }) {
  doc.fontSize(22).fillColor(rgbStr(BRAND_COLOR)).text('WashOps', 50, 40);
  doc.fontSize(8).fillColor('#94a3b8').text('Operations Platform', 50, 65);
  doc.moveTo(50, 82).lineTo(545, 82).strokeColor('#e2e8f0').stroke();

  doc.fontSize(16).fillColor(rgbStr(BRAND_COLOR)).text(title, 50, 95);
  const meta = [];
  if (locationName) meta.push(locationName);
  if (dateRange) meta.push(`${fmtDate(dateRange.start)} — ${fmtDate(dateRange.end)}`);
  meta.push(`Generated: ${timestamp || new Date().toLocaleString()}`);
  doc.fontSize(9).fillColor('#64748b').text(meta.join('  |  '), 50, 118);
  doc.moveDown(2);
  return 145;
}

function drawMetrics(doc, metrics, y) {
  const boxW = 120;
  const gap = 10;
  const startX = 50;
  metrics.forEach((m, i) => {
    const x = startX + i * (boxW + gap);
    doc.save();
    doc.roundedRect(x, y, boxW, 55, 6).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(18).fillColor(rgbStr(ACCENT_COLOR)).text(String(m.value), x + 10, y + 8, { width: boxW - 20, align: 'center' });
    doc.fontSize(7).fillColor('#64748b').text(m.label, x + 10, y + 32, { width: boxW - 20, align: 'center' });
    doc.restore();
  });
  return y + 70;
}

function drawTable(doc, { headers, rows, colWidths, startY }) {
  const startX = 50;
  let y = startY;
  const rowH = 20;
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  doc.save();
  doc.rect(startX, y, totalW, rowH).fill('#f1f5f9');
  let x = startX;
  headers.forEach((h, i) => {
    doc.fontSize(8).fillColor('#334155').text(h, x + 5, y + 5, { width: colWidths[i] - 10, ellipsis: true });
    x += colWidths[i];
  });
  doc.restore();
  y += rowH;

  // Data rows
  rows.forEach((row, ri) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    if (ri % 2 === 0) {
      doc.save().rect(startX, y, totalW, rowH).fill('#fafafa').restore();
    }
    x = startX;
    row.forEach((cell, ci) => {
      doc.fontSize(8).fillColor('#475569').text(String(cell ?? ''), x + 5, y + 5, { width: colWidths[ci] - 10, ellipsis: true });
      x += colWidths[ci];
    });
    y += rowH;
  });

  doc.moveTo(startX, y).lineTo(startX + totalW, y).strokeColor('#e2e8f0').stroke();
  return y + 10;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function rgbStr(arr) { return `rgb(${arr[0]},${arr[1]},${arr[2]})`; }

// ─── Report Renderers ───────────────────────────────────

async function renderOperationsSummary(doc, { prisma, tenantId, locationId, locations, dateRange }) {
  const locs = locationId ? [{ id: locationId }] : locations;
  const locName = locationId
    ? (await prisma.location.findUnique({ where: { id: locationId } }))?.name || 'Unknown'
    : 'All Locations';

  let y = drawHeader(doc, { title: 'Operations Summary Report', locationName: locName, dateRange });

  // Aggregate across all target locations
  let totalCars = 0, totalClaims = 0, totalTasks = 0, totalChecklists = 0;
  for (const loc of locs) {
    const [cars, claims, tasks, checklists] = await Promise.all([
      prisma.tunnelCycle.count({ where: { locationId: loc.id, status: 'completed', startTime: { gte: dateRange.start, lt: dateRange.end } } }),
      prisma.damageClaim.count({ where: { locationId: loc.id, createdAt: { gte: dateRange.start, lt: dateRange.end } } }),
      prisma.aITask.count({ where: { locationId: loc.id, createdAt: { gte: dateRange.start, lt: dateRange.end } } }),
      prisma.completedChecklist.count({ where: { locationId: loc.id, status: 'completed', startedAt: { gte: dateRange.start, lt: dateRange.end } } }),
    ]);
    totalCars += cars; totalClaims += claims; totalTasks += tasks; totalChecklists += checklists;
  }

  y = drawMetrics(doc, [
    { value: totalCars, label: 'Cars Washed' },
    { value: `$${(totalCars * 15).toLocaleString()}`, label: 'Est. Revenue' },
    { value: totalChecklists, label: 'Checklists Done' },
    { value: totalClaims, label: 'Claims Filed' },
  ], y);

  // Daily breakdown
  doc.fontSize(12).fillColor(rgbStr(BRAND_COLOR)).text('Daily Car Count', 50, y);
  y += 20;
  const rows = [];
  for (let d = new Date(dateRange.start); d < dateRange.end; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
    let dayCars = 0;
    for (const loc of locs) {
      dayCars += await prisma.tunnelCycle.count({ where: { locationId: loc.id, status: 'completed', startTime: { gte: dayStart, lt: dayEnd } } });
    }
    rows.push([fmtDate(dayStart), dayCars, `$${(dayCars * 15).toLocaleString()}`]);
  }
  y = drawTable(doc, { headers: ['Date', 'Cars', 'Revenue'], rows, colWidths: [200, 140, 155], startY: y });
}

async function renderInventory(doc, { prisma, locationId, locations, dateRange }) {
  const locs = locationId ? [{ id: locationId }] : locations;
  const locName = locationId
    ? (await prisma.location.findUnique({ where: { id: locationId } }))?.name || 'Unknown'
    : 'All Locations';

  let y = drawHeader(doc, { title: 'Inventory Report', locationName: locName, dateRange });

  let allItems = [];
  for (const loc of locs) {
    const items = await prisma.inventoryItem.findMany({ where: { locationId: loc.id, isActive: true }, include: { location: { select: { name: true } } } });
    allItems = allItems.concat(items);
  }

  const lowStock = allItems.filter(i => i.currentStock <= i.minStock);
  const totalValue = allItems.reduce((s, i) => s + (i.currentStock * (i.costPerUnit || 0)), 0);

  y = drawMetrics(doc, [
    { value: allItems.length, label: 'Total Items' },
    { value: lowStock.length, label: 'Low Stock Items' },
    { value: `$${totalValue.toFixed(0)}`, label: 'Total Value' },
  ], y);

  doc.fontSize(12).fillColor(rgbStr(BRAND_COLOR)).text('Inventory Details', 50, y); y += 20;
  const rows = allItems.map(i => [
    i.name, i.category, `${i.currentStock} ${i.unit}`, `${i.minStock} ${i.unit}`,
    i.currentStock <= i.minStock ? 'LOW' : 'OK',
  ]);
  y = drawTable(doc, { headers: ['Item', 'Category', 'Stock', 'Min', 'Status'], rows, colWidths: [150, 80, 90, 90, 85], startY: y });
}

async function renderEquipmentHealth(doc, { prisma, locationId, locations, dateRange }) {
  const locs = locationId ? [{ id: locationId }] : locations;
  const locName = locationId
    ? (await prisma.location.findUnique({ where: { id: locationId } }))?.name || 'Unknown'
    : 'All Locations';

  let y = drawHeader(doc, { title: 'Equipment Health Report', locationName: locName, dateRange });

  let allEquipment = [];
  for (const loc of locs) {
    const eq = await prisma.equipment.findMany({ where: { locationId: loc.id }, include: { location: { select: { name: true } } } });
    allEquipment = allEquipment.concat(eq);
  }

  const operational = allEquipment.filter(e => e.status === 'operational').length;
  const needsMaint = allEquipment.filter(e => e.status === 'needs_maintenance').length;
  const oos = allEquipment.filter(e => e.status === 'out_of_service').length;

  // Maintenance cost
  const maintLogs = await prisma.maintenanceLog.findMany({
    where: { equipment: { locationId: locationId || undefined }, createdAt: { gte: dateRange.start, lt: dateRange.end }, cost: { not: null } },
  });
  const totalCost = maintLogs.reduce((s, l) => s + (l.cost || 0), 0);

  y = drawMetrics(doc, [
    { value: allEquipment.length, label: 'Total Equipment' },
    { value: operational, label: 'Operational' },
    { value: needsMaint + oos, label: 'Needs Attention' },
    { value: `$${totalCost.toFixed(0)}`, label: 'Maint. Cost' },
  ], y);

  doc.fontSize(12).fillColor(rgbStr(BRAND_COLOR)).text('Equipment Status', 50, y); y += 20;
  const rows = allEquipment.map(e => [e.name, e.category, e.status.replace(/_/g, ' '), e.manufacturer || '-', e.serialNumber || '-']);
  y = drawTable(doc, { headers: ['Name', 'Category', 'Status', 'Manufacturer', 'Serial'], rows, colWidths: [130, 80, 100, 100, 85], startY: y });
}

async function renderTrainingCompliance(doc, { prisma, tenantId, locationId, locations, dateRange }) {
  const locs = locationId ? [{ id: locationId }] : locations;
  const locName = locationId
    ? (await prisma.location.findUnique({ where: { id: locationId } }))?.name || 'Unknown'
    : 'All Locations';

  let y = drawHeader(doc, { title: 'Training Compliance Report', locationName: locName, dateRange });

  const modules = await prisma.trainingModule.findMany({
    where: { tenantId, isActive: true },
    include: { completions: { where: { status: 'completed' } } },
  });

  let totalTeam = 0;
  for (const loc of locs) {
    totalTeam += await prisma.userLocation.count({ where: { locationId: loc.id } });
  }

  const requiredModules = modules.filter(m => m.isRequired);
  const overallCompliance = requiredModules.length > 0 && totalTeam > 0
    ? Math.round(requiredModules.reduce((s, m) => s + m.completions.length, 0) / (requiredModules.length * totalTeam) * 100)
    : 100;

  y = drawMetrics(doc, [
    { value: modules.length, label: 'Total Modules' },
    { value: requiredModules.length, label: 'Required' },
    { value: totalTeam, label: 'Team Size' },
    { value: `${overallCompliance}%`, label: 'Compliance' },
  ], y);

  doc.fontSize(12).fillColor(rgbStr(BRAND_COLOR)).text('Module Completion', 50, y); y += 20;
  const rows = modules.map(m => [
    m.title, m.category, m.isRequired ? 'Yes' : 'No',
    `${m.completions.length}/${totalTeam}`,
    totalTeam > 0 ? `${Math.round(m.completions.length / totalTeam * 100)}%` : 'N/A',
  ]);
  y = drawTable(doc, { headers: ['Module', 'Category', 'Required', 'Completed', 'Rate'], rows, colWidths: [160, 90, 70, 85, 90], startY: y });
}

// ─── Main Entry Point ───────────────────────────────────

const RENDERERS = {
  operations_summary: renderOperationsSummary,
  inventory: renderInventory,
  equipment_health: renderEquipmentHealth,
  training_compliance: renderTrainingCompliance,
};

async function generateReport({ prisma, reportType, tenantId, locationId, dateRange }) {
  if (!RENDERERS[reportType]) throw new Error(`Unknown report type: ${reportType}`);

  // Default date range: last 7 days
  if (!dateRange) {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = new Date(); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
    dateRange = { start, end };
  } else {
    dateRange = { start: new Date(dateRange.start), end: new Date(dateRange.end) };
  }

  // Get locations for multi-location reports
  const locations = locationId
    ? []
    : await prisma.location.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true } });

  const filename = `${reportType}-${uuidv4().slice(0, 8)}.pdf`;
  const filePath = path.join(REPORTS_DIR, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    RENDERERS[reportType](doc, { prisma, tenantId, locationId, locations, dateRange })
      .then(() => {
        // Footer on all pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(7).fillColor('#94a3b8').text(
            `WashOps Report  •  Page ${i + 1} of ${pages.count}`,
            50, 780, { align: 'center', width: 495 }
          );
        }
        doc.end();
      })
      .catch(reject);

    stream.on('finish', () => {
      const stats = fs.statSync(filePath);
      resolve({ filePath: filename, fileSize: stats.size });
    });
    stream.on('error', reject);
  });
}

module.exports = { generateReport };
