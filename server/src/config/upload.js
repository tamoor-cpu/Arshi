const multer = require('multer');

// Memory storage — the storage adapter (services/storage.js) decides where the
// buffer is persisted (local disk or remote object storage like R2).
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const allowedVideo = ['video/mp4', 'video/webm', 'video/quicktime'];
  const allowedDoc = ['application/pdf'];
  const allowed = [...allowedImage, ...allowedVideo, ...allowedDoc];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (for video)
  },
});

module.exports = upload;
