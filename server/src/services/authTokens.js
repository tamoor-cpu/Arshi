/**
 * One-time token service for email invites and password resets.
 * Only the SHA-256 hash of each token is stored; the raw token lives only in
 * the emailed link.
 */
const crypto = require('crypto');

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Create a fresh token, invalidating any prior unused tokens of the same type.
async function createToken(prisma, userId, type, ttlHours) {
  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
  await prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  await prisma.authToken.create({ data: { userId, tokenHash, type, expiresAt } });
  return raw;
}

// Look up a token without consuming it (for validation / showing the form).
async function peekToken(prisma, raw) {
  if (!raw) return null;
  const t = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true, archived: true } } },
  });
  if (!t || t.usedAt || t.expiresAt < new Date() || t.user.archived) return null;
  return t;
}

// Validate and atomically mark a token used.
async function consumeToken(prisma, raw) {
  const t = await peekToken(prisma, raw);
  if (!t) return null;
  await prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t;
}

module.exports = { createToken, peekToken, consumeToken };
