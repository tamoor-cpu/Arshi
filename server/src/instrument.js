/**
 * Error monitoring — initializes Sentry only when SENTRY_DSN is set.
 * Without it this is a no-op, so local/dev runs are unaffected.
 * Required at the very top of index.js (after dotenv) so it loads early.
 */
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  console.log('[sentry] error monitoring enabled');
}

module.exports = Sentry;
