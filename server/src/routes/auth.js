const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { createToken, peekToken, consumeToken } = require('../services/authTokens');
const { sendResetEmail } = require('../services/email');

const router = express.Router();
const prisma = new PrismaClient();

function generateTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, tenantId: user.tenantId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '15m' }
  );
  const refreshToken = jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
  return { accessToken, refreshToken };
}

// Register new tenant + admin user
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName, phone } = req.body;

    if (!email || !password || !firstName || !lastName || !companyName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: companyName, slug: `${slug}-${Date.now().toString(36)}` },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: 'SUPER_ADMIN',
        },
      });

      return { tenant, user };
    });

    const tokens = generateTokens(result.user);

    res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      ...tokens,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        userLocations: { include: { location: true } },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokens = generateTokens(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        position: user.position,
        onboardingCompletedAt: user.onboardingCompletedAt,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
      locations: user.userLocations.map((ul) => ({
        id: ul.location.id,
        name: ul.location.name,
        isPrimary: ul.isPrimary,
      })),
      ...tokens,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + (err.message || 'Unknown error') });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user);
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  const user = req.user;
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    position: user.position,
    onboardingCompletedAt: user.onboardingCompletedAt,
    tenantId: user.tenantId,
    locations: user.userLocations.map((ul) => ({
      id: ul.location.id,
      name: ul.location.name,
      isPrimary: ul.isPrimary,
    })),
  });
});

// Update profile
router.patch('/me', authenticate, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
      },
    });

    res.json({
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
    });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// ---- Password setup / reset via emailed one-time token ----

// Request a password reset email. Always 200 — never reveal whether the email exists.
router.post('/forgot-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && !user.archived) {
        const raw = await createToken(prisma, user.id, 'reset', 1); // 1 hour
        await sendResetEmail(user, raw);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.json({ ok: true }); // still don't leak
  }
});

// Check an invite/reset token (so the page can greet the user and show the form).
router.get('/validate-token', async (req, res) => {
  try {
    const t = await peekToken(prisma, req.query.token);
    if (!t) return res.json({ valid: false });
    res.json({ valid: true, type: t.type, email: t.user.email, firstName: t.user.firstName });
  } catch (err) {
    res.json({ valid: false });
  }
});

// Set a password using a valid invite/reset token.
router.post('/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const t = await consumeToken(prisma, token);
    if (!t) return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one.' });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: t.userId }, data: { passwordHash, isActive: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Set-password error:', err);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

module.exports = router;
