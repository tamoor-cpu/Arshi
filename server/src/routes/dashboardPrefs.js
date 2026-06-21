const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/v1/dashboard-preferences
router.get('/', authenticate, async (req, res) => {
  try {
    const pref = await prisma.dashboardPreference.findUnique({
      where: { userId: req.user.id },
    });

    if (!pref) {
      return res.json({ hiddenWidgets: [], widgetOrder: [] });
    }

    res.json({
      hiddenWidgets: JSON.parse(pref.hiddenWidgets || '[]'),
      widgetOrder: JSON.parse(pref.widgetOrder || '[]'),
    });
  } catch (err) {
    console.error('Get dashboard prefs error:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// PUT /api/v1/dashboard-preferences
router.put('/', authenticate, async (req, res) => {
  try {
    const { hiddenWidgets, widgetOrder } = req.body;

    const pref = await prisma.dashboardPreference.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        hiddenWidgets: JSON.stringify(hiddenWidgets || []),
        widgetOrder: JSON.stringify(widgetOrder || []),
      },
      update: {
        hiddenWidgets: JSON.stringify(hiddenWidgets || []),
        widgetOrder: JSON.stringify(widgetOrder || []),
      },
    });

    res.json({
      hiddenWidgets: JSON.parse(pref.hiddenWidgets),
      widgetOrder: JSON.parse(pref.widgetOrder),
    });
  } catch (err) {
    console.error('Save dashboard prefs error:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

module.exports = router;
