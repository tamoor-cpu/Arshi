const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateSignedPdf, extractPdfFields } = require('../services/pdfSign');
const { notify } = require('../services/notify');

const router = express.Router();
const prisma = new PrismaClient();

const safeParse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

// ==================== TEMPLATES (owner-managed) ====================

router.get('/document-templates', authenticate, async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const templates = await prisma.documentTemplate.findMany({
      where: { tenantId: req.tenantId, ...(activeOnly === 'true' ? { active: true } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(templates.map((t) => ({ ...t, fields: safeParse(t.fields, []) })));
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Failed to load document templates' });
  }
});

// Read AcroForm fields from an uploaded PDF (so the owner sees what employees fill).
router.post('/document-templates/extract-fields', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const fields = await extractPdfFields(req.body.sourceFileUrl);
    res.json({ fields });
  } catch (err) { res.status(500).json({ error: 'Failed to read PDF fields' }); }
});

router.post('/document-templates', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const { name, type, category, sourceFileUrl, content, fields, requireSignature, assignOnOnboarding } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (type === 'fillable_form' && !sourceFileUrl) return res.status(400).json({ error: 'Upload a PDF for a fillable form' });

    const template = await prisma.documentTemplate.create({
      data: {
        tenantId: req.tenantId,
        name,
        type: type || 'policy',
        category: category || 'onboarding',
        sourceFileUrl: sourceFileUrl || null,
        content: content || null,
        fields: JSON.stringify(Array.isArray(fields) ? fields : []),
        requireSignature: requireSignature !== false,
        assignOnOnboarding: !!assignOnOnboarding,
        createdById: req.user.id,
      },
    });
    req.audit('create', 'document_template', template.id, { name, type });
    res.status(201).json({ ...template, fields: safeParse(template.fields, []) });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Revise a template — bumps the version so future signings reference the latest.
router.patch('/document-templates/:id', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    const { name, category, sourceFileUrl, content, fields, requireSignature, assignOnOnboarding, active } = req.body;
    const existing = await prisma.documentTemplate.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const contentChanged = (content !== undefined && content !== existing.content) ||
      (sourceFileUrl !== undefined && sourceFileUrl !== existing.sourceFileUrl) ||
      (fields !== undefined);

    const data = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (sourceFileUrl !== undefined) data.sourceFileUrl = sourceFileUrl || null;
    if (content !== undefined) data.content = content || null;
    if (fields !== undefined) data.fields = JSON.stringify(Array.isArray(fields) ? fields : []);
    if (requireSignature !== undefined) data.requireSignature = !!requireSignature;
    if (assignOnOnboarding !== undefined) data.assignOnOnboarding = !!assignOnOnboarding;
    if (active !== undefined) data.active = !!active;
    if (contentChanged) data.version = existing.version + 1;

    const template = await prisma.documentTemplate.update({ where: { id: req.params.id }, data });
    res.json({ ...template, fields: safeParse(template.fields, []) });
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/document-templates/:id', authenticate, requireRole('REGIONAL_ADMIN'), async (req, res) => {
  try {
    await prisma.documentTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete template' }); }
});

// ==================== SIGNING (employee) ====================

// Documents the current user still needs to sign (active templates with no signed record).
router.get('/document-templates/mine/pending', authenticate, async (req, res) => {
  try {
    const templates = await prisma.documentTemplate.findMany({ where: { tenantId: req.tenantId, active: true } });
    const signed = await prisma.signedDocument.findMany({ where: { userId: req.user.id }, select: { templateId: true, templateVersion: true } });
    const signedMap = {};
    signed.forEach((s) => { signedMap[s.templateId] = Math.max(signedMap[s.templateId] || 0, s.templateVersion); });
    const pending = templates.filter((t) => (signedMap[t.id] || 0) < t.version);
    res.json(pending.map((t) => ({ ...t, fields: safeParse(t.fields, []) })));
  } catch (err) { res.status(500).json({ error: 'Failed to load pending documents' }); }
});

// The current user's signed documents (for "My documents").
router.get('/document-templates/mine/signed', authenticate, async (req, res) => {
  try {
    const docs = await prisma.signedDocument.findMany({
      where: { userId: req.user.id },
      orderBy: { signedAt: 'desc' },
    });
    res.json(docs);
  } catch (err) { res.status(500).json({ error: 'Failed to load signed documents' }); }
});

// Employee signs a document — generates the final signed PDF into their file.
router.post('/document-templates/:id/sign', authenticate, async (req, res) => {
  try {
    const { fieldData, signatureDataUrl, userId } = req.body;
    // Managers may capture a signature for an employee in person (kiosk); default to self.
    let targetUserId = req.user.id;
    if (userId && userId !== req.user.id) {
      if (!['SUPER_ADMIN', 'REGIONAL_ADMIN', 'SITE_MANAGER'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Not allowed' });
      }
      targetUserId = userId;
    }
    const employee = await prisma.user.findFirst({ where: { id: targetUserId, tenantId: req.tenantId } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const template = await prisma.documentTemplate.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!template) return res.status(404).json({ error: 'Document not found' });

    if (template.requireSignature && !signatureDataUrl) {
      return res.status(400).json({ error: 'A signature is required' });
    }

    const signedPdfUrl = await generateSignedPdf({
      template: { ...template, fields: safeParse(template.fields, []) },
      fieldData: fieldData || {},
      signatureDataUrl,
      employee,
    });

    const signed = await prisma.signedDocument.create({
      data: {
        userId: targetUserId,
        templateId: template.id,
        templateName: template.name,
        templateVersion: template.version,
        type: template.type,
        category: template.category,
        fieldData: JSON.stringify(fieldData || {}),
        signatureUrl: signatureDataUrl || null,
        signedPdfUrl,
      },
    });

    // Surface it in the employee file's Documents tab too.
    await prisma.employeeDocument.create({
      data: {
        userId: targetUserId,
        category: template.category === 'policy' ? 'policy' : 'onboarding',
        name: template.name,
        fileUrl: signedPdfUrl,
        status: 'signed',
        signedAt: new Date(),
        uploadedById: req.user.id,
      },
    });

    req.audit('sign', 'document', signed.id, { template: template.name, userId: targetUserId });
    res.status(201).json(signed);
  } catch (err) {
    console.error('Sign document error:', err);
    res.status(500).json({ error: 'Failed to sign document' });
  }
});

// ==================== ACKNOWLEDGEMENT TRACKING (managers) ====================

// Summary counts per active template: how many employees are current / outdated / never.
router.get('/document-templates/acknowledgements/summary', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const [users, templates, signedDocs] = await Promise.all([
      prisma.user.findMany({ where: { tenantId: req.tenantId, archived: false }, select: { id: true } }),
      prisma.documentTemplate.findMany({ where: { tenantId: req.tenantId, active: true }, select: { id: true, version: true } }),
      prisma.signedDocument.findMany({ where: { user: { tenantId: req.tenantId, archived: false } }, select: { templateId: true, userId: true, templateVersion: true } }),
    ]);
    const total = users.length;
    const map = {}; // templateId -> userId -> max signed version
    for (const s of signedDocs) {
      if (!s.templateId) continue;
      map[s.templateId] = map[s.templateId] || {};
      map[s.templateId][s.userId] = Math.max(map[s.templateId][s.userId] || 0, s.templateVersion);
    }
    const summary = {};
    for (const t of templates) {
      let current = 0, outdated = 0;
      for (const v of Object.values(map[t.id] || {})) {
        if (v >= t.version) current++; else outdated++;
      }
      summary[t.id] = { total, current, outdated, never: Math.max(0, total - current - outdated) };
    }
    res.json(summary);
  } catch (err) {
    console.error('Ack summary error:', err);
    res.status(500).json({ error: 'Failed to load acknowledgement summary' });
  }
});

// Full roster for one policy: every active employee + their status vs the current version.
router.get('/document-templates/:id/acknowledgements', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const template = await prisma.documentTemplate.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!template) return res.status(404).json({ error: 'Policy not found' });

    const [users, signedDocs] = await Promise.all([
      prisma.user.findMany({ where: { tenantId: req.tenantId, archived: false }, select: { id: true, firstName: true, lastName: true, role: true, position: true } }),
      prisma.signedDocument.findMany({ where: { templateId: template.id }, orderBy: { signedAt: 'desc' } }),
    ]);

    const latest = {}; // userId -> most recent signed doc for this template
    for (const s of signedDocs) { if (!latest[s.userId]) latest[s.userId] = s; }

    const roster = users.map((u) => {
      const s = latest[u.id];
      let status = 'never';
      if (s) status = s.templateVersion >= template.version ? 'current' : 'outdated';
      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        position: u.position || (u.role ? u.role.replace('_', ' ') : ''),
        status,
        signedVersion: s ? s.templateVersion : null,
        signedAt: s ? s.signedAt : null,
        signedPdfUrl: s ? s.signedPdfUrl : null,
      };
    });

    const order = { never: 0, outdated: 1, current: 2 };
    roster.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
    const summary = roster.reduce((acc, r) => { acc[r.status]++; return acc; }, { current: 0, outdated: 0, never: 0 });

    res.json({ template: { id: template.id, name: template.name, version: template.version, category: template.category }, total: roster.length, summary, roster });
  } catch (err) {
    console.error('Ack roster error:', err);
    res.status(500).json({ error: 'Failed to load acknowledgements' });
  }
});

// Send a "please sign" reminder to employees who are outstanding on this policy.
// Body may include { userIds: [...] } to remind a specific subset; otherwise all outstanding.
router.post('/document-templates/:id/remind', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const template = await prisma.documentTemplate.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!template) return res.status(404).json({ error: 'Policy not found' });

    const [users, signedDocs] = await Promise.all([
      prisma.user.findMany({ where: { tenantId: req.tenantId, archived: false }, select: { id: true } }),
      prisma.signedDocument.findMany({ where: { templateId: template.id }, select: { userId: true, templateVersion: true } }),
    ]);
    const maxVer = {};
    for (const s of signedDocs) maxVer[s.userId] = Math.max(maxVer[s.userId] || 0, s.templateVersion);

    let outstanding = users.filter((u) => (maxVer[u.id] || 0) < template.version).map((u) => u.id);
    if (Array.isArray(req.body?.userIds) && req.body.userIds.length) {
      const set = new Set(req.body.userIds);
      outstanding = outstanding.filter((id) => set.has(id));
    }

    const io = req.app.get('io');
    await Promise.all(outstanding.map((userId) => notify({
      prisma, io, userId, locationId: null,
      type: 'system',
      title: 'Policy signature required',
      message: `Please review and sign "${template.name}" (v${template.version}) in the Company Handbook.`,
      entityType: 'policy', entityId: template.id,
    })));

    if (req.audit) req.audit('remind', 'document_template', template.id, { count: outstanding.length });
    res.json({ remindedCount: outstanding.length });
  } catch (err) {
    console.error('Remind error:', err);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

module.exports = router;
