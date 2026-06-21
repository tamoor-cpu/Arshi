/**
 * Email service — thin wrapper around nodemailer.
 * Gracefully no-ops if SMTP is not configured.
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendReportEmail({ to, subject, html, attachmentPath, filename }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('[Email] SMTP not configured, skipping email to:', to);
    return null;
  }

  try {
    const mailOptions = {
      from: process.env.MAIL_FROM || 'noreply@washops.com',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      attachments: attachmentPath
        ? [{ filename: filename || 'report.pdf', path: attachmentPath }]
        : [],
    };
    const info = await getTransporter().sendMail(mailOptions);
    console.log('[Email] Sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return null;
  }
}

// Base URL of the app (for links in emails).
function appUrl() {
  const fromAllowed = (process.env.ALLOWED_ORIGINS || '').split(',')[0].trim();
  return (process.env.APP_URL || fromAllowed || process.env.CLIENT_URL || 'http://localhost:3003').replace(/\/$/, '');
}

// Generic transactional email — gracefully no-ops (logs) if SMTP isn't configured.
async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[Email] SMTP not configured — skipped "${subject}" to ${to}`);
    return null;
  }
  try {
    const info = await getTransporter().sendMail({ from: process.env.MAIL_FROM || 'noreply@arshi.app', to, subject, html });
    console.log('[Email] Sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return null;
  }
}

function brandedEmail({ heading, body, buttonText, buttonUrl }) {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <div style="font-weight:700;letter-spacing:.16em;color:#6d3ef0;font-size:20px;margin-bottom:8px">ARSHI</div>
    <h2 style="color:#0f172a;margin:0 0 8px">${heading}</h2>
    <p style="color:#334155;line-height:1.6;margin:0 0 16px">${body}</p>
    <a href="${buttonUrl}" style="display:inline-block;background:#6d3ef0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${buttonText}</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:18px;word-break:break-all">Or paste this link into your browser:<br>${buttonUrl}</p>
  </div>`;
}

// Invite a new user to set their initial password.
async function sendInviteEmail(user, rawToken) {
  const url = `${appUrl()}/set-password?token=${rawToken}`;
  console.log(`[Email] Invite link for ${user.email}: ${url}`);
  return sendEmail({
    to: user.email,
    subject: "You're invited to ARSHI — set your password",
    html: brandedEmail({
      heading: `Welcome, ${user.firstName}!`,
      body: 'An ARSHI account has been created for you. Click below to set your password and get started. This link expires in 3 days.',
      buttonText: 'Set my password',
      buttonUrl: url,
    }),
  });
}

// Password reset link.
async function sendResetEmail(user, rawToken) {
  const url = `${appUrl()}/set-password?token=${rawToken}`;
  console.log(`[Email] Password reset link for ${user.email}: ${url}`);
  return sendEmail({
    to: user.email,
    subject: 'Reset your ARSHI password',
    html: brandedEmail({
      heading: 'Reset your password',
      body: "We received a request to reset your password. This link expires in 1 hour. If you didn't request it, you can safely ignore this email.",
      buttonText: 'Reset password',
      buttonUrl: url,
    }),
  });
}

module.exports = { sendReportEmail, sendEmail, sendInviteEmail, sendResetEmail, appUrl };
