/**
 * Cron Scheduler Service — manages in-process cron jobs for recurring reports.
 * On startup, loads all active ScheduledReports and registers cron tasks.
 */
const cron = require('node-cron');
const { generateReport } = require('./pdfReport');
const { sendReportEmail } = require('./email');
const { retryPendingWebhooks } = require('./webhook');
const { runPredictiveMaintenance, runAnomalyDetection } = require('./aiHeuristics');

// In-memory map: reportId → cron.ScheduledTask
const jobs = new Map();

async function initScheduler(prisma) {
  try {
    const reports = await prisma.scheduledReport.findMany({
      where: { isActive: true, cronExpression: { not: null } },
    });

    for (const report of reports) {
      scheduleReport(prisma, report);
    }

    console.log(`[Scheduler] Loaded ${reports.length} scheduled report(s)`);

    // Webhook retry cron — every minute
    cron.schedule('* * * * *', () => retryPendingWebhooks(prisma));
    console.log('[Scheduler] Webhook retry cron registered');

    // AI Heuristics — daily at 6:00 AM
    cron.schedule('0 6 * * *', async () => {
      console.log('[AI] Running predictive maintenance...');
      await runPredictiveMaintenance(prisma, null).catch((e) => console.error('[AI] Maintenance error:', e.message));
    });

    // Anomaly detection — daily at 6:30 AM
    cron.schedule('30 6 * * *', async () => {
      console.log('[AI] Running anomaly detection...');
      await runAnomalyDetection(prisma, null).catch((e) => console.error('[AI] Anomaly error:', e.message));
    });
    console.log('[Scheduler] AI heuristic crons registered');
  } catch (err) {
    console.error('[Scheduler] Init error:', err.message);
  }
}

function scheduleReport(prisma, report) {
  if (!report.cronExpression || !cron.validate(report.cronExpression)) {
    console.warn(`[Scheduler] Invalid cron for report ${report.id}: ${report.cronExpression}`);
    return;
  }

  // Cancel existing job if any
  unscheduleReport(report.id);

  const task = cron.schedule(report.cronExpression, async () => {
    await runReport(prisma, report);
  });

  jobs.set(report.id, task);
  console.log(`[Scheduler] Scheduled report "${report.name}" (${report.cronExpression})`);
}

function unscheduleReport(reportId) {
  const existing = jobs.get(reportId);
  if (existing) {
    existing.stop();
    jobs.delete(reportId);
  }
}

function rescheduleReport(prisma, report) {
  unscheduleReport(report.id);
  if (report.isActive && report.cronExpression) {
    scheduleReport(prisma, report);
  }
}

async function runReport(prisma, report) {
  let run;
  try {
    // Create pending run
    run = await prisma.reportRun.create({
      data: { scheduledReportId: report.id, status: 'generating' },
    });

    // Generate PDF
    const config = JSON.parse(report.config || '{}');
    const result = await generateReport({
      prisma,
      reportType: report.reportType,
      tenantId: report.tenantId,
      locationId: report.locationId,
      dateRange: config.dateRange || null,
    });

    // Update run as completed
    await prisma.reportRun.update({
      where: { id: run.id },
      data: { status: 'completed', filePath: result.filePath, fileSize: result.fileSize },
    });

    // Send email if recipients configured
    const recipients = JSON.parse(report.recipients || '[]');
    if (recipients.length > 0) {
      const path = require('path');
      const fullPath = path.join(__dirname, '../../reports', result.filePath);
      const emailResult = await sendReportEmail({
        to: recipients,
        subject: `WashOps Report: ${report.name}`,
        html: `<h2>WashOps Report</h2><p>Your scheduled report <strong>${report.name}</strong> has been generated.</p><p>Please find the PDF attached.</p>`,
        attachmentPath: fullPath,
        filename: `${report.name.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      });

      if (emailResult) {
        await prisma.reportRun.update({
          where: { id: run.id },
          data: { emailSentAt: new Date() },
        });
      }
    }

    // Update last/next run times
    await prisma.scheduledReport.update({
      where: { id: report.id },
      data: { lastRunAt: new Date() },
    });

    console.log(`[Scheduler] Report "${report.name}" generated successfully`);
  } catch (err) {
    console.error(`[Scheduler] Report "${report.name}" failed:`, err.message);
    if (run) {
      await prisma.reportRun.update({
        where: { id: run.id },
        data: { status: 'failed', errorMessage: err.message },
      }).catch(() => {});
    }
  }
}

module.exports = { initScheduler, scheduleReport, unscheduleReport, rescheduleReport, runReport };
