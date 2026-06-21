/**
 * Storage adapter — keeps file persistence pluggable.
 *
 * Defaults to LOCAL DISK (server/uploads, served at /uploads) so the app works
 * with zero config. If Cloudflare R2 (or any S3-compatible) credentials are set
 * in the environment, files are stored there instead and public URLs are returned.
 *
 * Required env to enable remote storage:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const remote = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET &&
  process.env.R2_PUBLIC_URL
);

let s3 = null;
let PutObjectCommand = null;
if (remote) {
  const { S3Client, PutObjectCommand: Put } = require('@aws-sdk/client-s3');
  PutObjectCommand = Put;
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true, // R2's wildcard cert only covers one subdomain level; path-style avoids a TLS handshake failure
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('[storage] Remote object storage enabled (R2 bucket:', process.env.R2_BUCKET + ')');
} else {
  console.log('[storage] Using local disk storage (server/uploads)');
}

function isRemote() { return remote; }

// Persist a buffer and return a publicly reachable URL.
// Tries remote object storage when configured; if it's unreachable, falls back
// to local disk so an upload never hard-fails (logged so it's visible).
async function saveBuffer(buffer, { ext = 'bin', contentType = 'application/octet-stream' } = {}) {
  const key = `${uuidv4()}.${String(ext).replace(/^\./, '') || 'bin'}`;
  if (remote) {
    try {
      await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
      return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    } catch (err) {
      console.error('[storage] R2 upload failed — falling back to local disk:', err.code || err.message);
    }
  }
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, key), buffer);
  return `/uploads/${key}`;
}

// Read a previously stored file back into a Buffer, given the URL we returned.
// Handles both local (/uploads/..) and remote (https://..) URLs.
async function readBuffer(url) {
  if (!url) return null;
  if (url.startsWith('/uploads/')) {
    const p = path.join(UPLOAD_DIR, url.replace(/^\/uploads\//, ''));
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  }
  if (/^https?:\/\//.test(url)) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch { return null; }
  }
  return null;
}

module.exports = { isRemote, saveBuffer, readBuffer, UPLOAD_DIR };
