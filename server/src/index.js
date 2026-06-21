require('dotenv').config();
const Sentry = require('./instrument');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');

// Fail fast if the JWT secret is missing or weak — never run auth without it.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET is missing or too short (need >= 32 chars). Refusing to start.');
  process.exit(1);
}
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const locationRoutes = require('./routes/locations');
const userRoutes = require('./routes/users');
const shiftRoutes = require('./routes/shifts');
const clockRoutes = require('./routes/clock');
const checklistRoutes = require('./routes/checklists');
const dashboardRoutes = require('./routes/dashboard');
const messageRoutes = require('./routes/messages');
const incidentRoutes = require('./routes/incidents');
const equipmentRoutes = require('./routes/equipment');
const inventoryRoutes = require('./routes/inventory');
const chemicalsRoutes = require('./routes/chemicals');
const opsModulesRoutes = require('./routes/opsModules');
const reviewsOrdersRoutes = require('./routes/reviewsOrders');
const workOrdersRoutes = require('./routes/workOrders');
const customerRoutes = require('./routes/customers');
const claimRoutes = require('./routes/claims');
const trainingRoutes = require('./routes/training');
const taskRoutes = require('./routes/tasks');
const supplierRoutes = require('./routes/suppliers');
const searchRoutes = require('./routes/search');
const activityRoutes = require('./routes/activity');
const exportRoutes = require('./routes/exports');
const auditRoutes = require('./routes/audit');
const uploadRoutes = require('./routes/uploads');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const multiLocationAnalyticsRoutes = require('./routes/multiLocationAnalytics');
const dashboardPrefsRoutes = require('./routes/dashboardPrefs');
const timeoffRoutes = require('./routes/timeoff');
const apiKeyRoutes = require('./routes/apiKeys');
const webhookRoutes = require('./routes/webhooks');
const aiInsightsRoutes = require('./routes/aiInsights');
const { auditMiddleware } = require('./middleware/audit');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

// CORS allow-list. In production only configured origins are allowed; in dev
// (and same-origin / curl / mobile, which send no Origin header) requests pass.
const PROD = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);                 // same-origin / curl / mobile
  if (!PROD) return callback(null, true);                   // permissive in dev
  if (ALLOWED_ORIGINS.length === 0) return callback(null, true); // not configured yet — don't break the app
  if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
  return callback(null, false);                             // deny CORS headers, but never throw (no 500)
}
if (PROD && ALLOWED_ORIGINS.length === 0) {
  console.warn('[cors] ALLOWED_ORIGINS is not set — allowing all origins. Set it to your app URL to lock down cross-origin access.');
}

// Socket.io setup — same CORS policy as the API.
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
});

// Make io accessible to routes
app.set('io', io);
app.set('prisma', prisma);

// Security headers. CSP is left off (this is an API + separate SPA origin), and
// resource policy is cross-origin so the client can embed uploaded images/PDFs.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting — a generous global guardrail, plus a strict limit on auth.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed logins count toward the limit
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
});

// CORS — locked to ALLOWED_ORIGINS in production (see corsOrigin above).
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);
app.use(auditMiddleware);

// Serve uploaded files and generated reports
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/reports', express.static(path.join(__dirname, '../reports')));

// Health check — verifies the process is up and the database is reachable.
app.get('/api/v1/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: true, storage: require('./services/storage').isRemote() ? 'remote' : 'local', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: false });
  }
});

// Health check — includes DB connectivity test
app.get('/api/health', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ status: 'ok', service: 'washops-api', dbConnected: true, users: userCount, timestamp: new Date().toISOString() });
  } catch (err) {
    res.json({ status: 'degraded', service: 'washops-api', dbConnected: false, dbError: err.message, timestamp: new Date().toISOString() });
  }
});

// API routes
// Throttle only the brute-forceable, password-checking endpoints — NOT /auth/refresh,
// which uses a refresh token and must keep working to avoid logging users out.
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1', require('./routes/documents'));
app.use('/api/v1/locations', shiftRoutes);
app.use('/api/v1/locations', clockRoutes);
app.use('/api/v1/locations', checklistRoutes);
app.use('/api/v1/locations', dashboardRoutes);
app.use('/api/v1/locations', messageRoutes);
app.use('/api/v1/locations', incidentRoutes);
app.use('/api/v1/locations', equipmentRoutes);
app.use('/api/v1/locations', inventoryRoutes);
app.use('/api/v1/locations', chemicalsRoutes);
app.use('/api/v1/locations', opsModulesRoutes);
app.use('/api/v1/locations', reviewsOrdersRoutes);
app.use('/api/v1/locations', workOrdersRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/locations', claimRoutes);
app.use('/api/v1/training', trainingRoutes);
app.use('/api/v1/locations', taskRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/locations', activityRoutes);
app.use('/api/v1/locations', exportRoutes);
app.use('/api/v1/customers', exportRoutes); // customer exports at /api/v1/customers/export/...
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/analytics', multiLocationAnalyticsRoutes);
app.use('/api/v1/dashboard-preferences', dashboardPrefsRoutes);
app.use('/api/v1/locations', timeoffRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/locations', aiInsightsRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join-location', (locationId) => {
    socket.join(`location:${locationId}`);
    console.log(`Socket ${socket.id} joined location:${locationId}`);
  });

  socket.on('leave-location', (locationId) => {
    socket.leave(`location:${locationId}`);
  });

  socket.on('join-user', (userId) => {
    socket.join(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// In production, serve the built React app from this same service (single-service deploy).
if (PROD) {
  const clientBuild = path.join(__dirname, '../../client/build');
  app.use(express.static(clientBuild));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/reports')) return next();
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚗 WashOps API running on port ${PORT}`);
});

// Initialize report scheduler
const { initScheduler } = require('./services/scheduler');
initScheduler(prisma).then(() => {
  console.log('📊 Report scheduler initialized');
}).catch((err) => {
  console.error('Scheduler init error:', err);
});

module.exports = { app, server, io, prisma };
