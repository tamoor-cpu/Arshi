const express = require('express');
const path = require('path');
const router = express.Router();
const upload = require('../config/upload');
const { authenticate } = require('../middleware/auth');
const storage = require('../services/storage');

// POST /api/v1/uploads — upload up to 10 files
router.post('/', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = await Promise.all(req.files.map(async (file) => {
      const ext = path.extname(file.originalname).replace(/^\./, '') || 'bin';
      const url = await storage.saveBuffer(file.buffer, { ext, contentType: file.mimetype });
      return { url, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
    }));

    res.json({ files });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Error handling for multer errors
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files. Maximum is 10.' });
  }
  if (err.message && err.message.includes('not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
