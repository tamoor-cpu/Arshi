const express = require('express');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateReport } = require('../services/pdfReport');
const { sendReportEmail } = require('../services/email');
const { scheduleReport, unscheduleReport, rescheduleReport, runReport } = require('../services/scheduler');

const router = express.Router();
const prisma = new PrismaClient();

const VALID_TYPES = ['operations_summary', 'inventory', 'equipment_health', 'training_compliance'];
const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly', 'manual'];

// List scheduled reports for the tenant
router.get('/', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { locationId } = req.query;
    const where = { tenantId: req.user.tenantId };
    if (locationId) where.locationId = locationId;

    const reports = await prisma.scheduledReport.findMany({
      where,
      include: { runs: { orderBy: { generatedAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(reports);
  } catch (err) {
    console.error('List reports error:', err);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// Create a scheduled report
router.post('/', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, reportType, frequency, cronExpression, recipients, locationId, config } = req.body;

    if (!name || !reportType) return res.status(400).json({ error: 'Name and report type required' });
    if (!VALID_TYPES.includes(reportType)) return res.status(400).json({ error: 'Invalid report type' });
    if (frequency && !VALID_FREQUENCIES.includes(frequency)) return res.status(400).json({ error: 'Invalid frequency' });

    const report = await prisma.scheduledReport.create({
      data: {
        tenantId: req.user.tenantId,
        createdById: req.user.id,
        name,
        reportType,
        frequency: frequency || 'manual',
        cronExpression: cronExpression || null,
        recipients: JSON.stringify(recipients || []),
        locationId: locationId || null,
        config: JSON.stringify(config || {}),
      },
    });

    // Register cron job if applicable
    if (report.cronExpression && report.frequency !== 'manual') {
      scheduleReport(prisma, report);
    }

    req.audit('create', 'report', report.id, { name, reportType, frequency });
    res.status(201).json(report);
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// Update a scheduled report
router.patch('/:id', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { name, frequency, cronExpression, recipients, locationId, config, isActive } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (frequency !== undefined) data.frequency = frequency;
    if (cronExpression !== undefined) data.cronExpression = cronExpression;
    if (recipients !== undefined) data.recipients = JSON.stringify(recipients);
    if (locationId !== undefined) data.locationId = locationId;
    if (config !== undefined) data.config = JSON.stringify(config);
    if (isActive !== undefined) data.isActive = isActive;

    const report = await prisma.scheduledReport.update({
      where: { id: req.params.id },
      data,
    });

    // Reschedule cron job
    rescheduleReport(prisma, report);
    res.json(report);
  } catch (err) {
    console.error('Update report error:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// Delete a scheduled report
router.delete('/:id', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    unscheduleReport(req.params.id);
    await prisma.scheduledReport.delete({ where: { id: req.params.id } });
    req.audit('delete', 'report', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete report error:', err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Manually trigger report generation
router.post('/:id/generate', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const report = await prisma.scheduledReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Create run record
    let run = await prisma.reportRun.create({
      data: { scheduledReportId: report.id, status: 'generating' },
    });

    const config = JSON.parse(report.config || '{}');
    const result = await generateReport({
      prisma,
      reportType: report.reportType,
      tenantId: report.tenantId,
      locationId: report.locationId,
      dateRange: config.dateRange || null,
    });

    run = await prisma.reportRun.update({
      where: { id: run.id },
      data: { status: 'completed', filePath: result.filePath, fileSize: result.fileSize },
    });

    await prisma.scheduledReport.update({
      where: { id: report.id },
      data: { lastRunAt: new Date() },
    });

    req.audit('create', 'report_run', run.id, { reportType: report.reportType });
    res.json(run);
  } catch (err) {
    console.error('Generate report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// List report run history
router.get('/:id/runs', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [runs, total] = await Promise.all([
      prisma.reportRun.findMany({
        where: { scheduledReportId: req.params.id },
        orderBy: { generatedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.reportRun.count({ where: { scheduledReportId: req.params.id } }),
    ]);

    res.json({ data: runs, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    console.error('List runs error:', err);
    res.status(500).json({ error: 'Failed to list runs' });
  }
});

// Download a generated report PDF
router.get('/runs/:runId/download', authenticate, async (req, res) => {
  try {
    const run = await prisma.reportRun.findUnique({
      where: { id: req.params.runId },
      include: { scheduledReport: true },
    });
    if (!run || !run.filePath) return res.status(404).json({ error: 'Report file not found' });

    const fullPath = path.join(__dirname, '../../reports', run.filePath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File missing from disk' });

    const filename = `${run.scheduledReport.name.replace(/\s+/g, '-').toLowerCase()}-${run.generatedAt.toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('Download report error:', err);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

module.exports = router;
