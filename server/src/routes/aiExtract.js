const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const aiExtraction = require('../services/aiExtraction');

const router = express.Router();
const prisma = new PrismaClient();

// Lets the client show/hide the "Auto-fill with AI" affordance.
router.get('/status', authenticate, (req, res) => {
  res.json({ configured: aiExtraction.isConfigured() });
});

// Extract a structured DRAFT from an uploaded manual/spec/photo. Persists nothing.
router.post('/extract', authenticate, requireRole('SITE_MANAGER'), async (req, res) => {
  try {
    const { fileUrl, mimeType, recordType } = req.body;
    if (!fileUrl || !mimeType) return res.status(400).json({ error: 'fileUrl and mimeType are required' });
    if (!aiExtraction.isConfigured()) return res.status(503).json({ error: 'AI extraction is not configured. Add an ANTHROPIC_API_KEY.' });

    // Only accept files this app hosts (no arbitrary URLs in v1).
    const hosted = fileUrl.startsWith('/uploads/') || (process.env.R2_PUBLIC_URL && fileUrl.startsWith(process.env.R2_PUBLIC_URL));
    if (!hosted) return res.status(400).json({ error: 'Upload the file first, then extract from it.' });

    if ((recordType || 'equipment') !== 'equipment') return res.status(400).json({ error: 'Only equipment extraction is supported right now.' });

    const result = await aiExtraction.extractEquipment({ fileUrl, mimeType, prisma, tenantId: req.tenantId, userId: req.user.id });
    res.json(result);
  } catch (err) {
    console.error('AI extract error:', err.code || err.message);
    if (err.code === 'NOT_CONFIGURED') return res.status(503).json({ error: 'AI extraction is not configured' });
    if (['BAD_TYPE', 'FILE_UNREADABLE'].includes(err.code)) return res.status(400).json({ error: err.message });
    res.status(502).json({ error: "Couldn't read that document. Try a clearer PDF/photo, or enter the details manually." });
  }
});

module.exports = router;
