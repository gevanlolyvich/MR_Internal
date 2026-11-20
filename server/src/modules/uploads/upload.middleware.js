const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../../utils/ApiError');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', '..', 'uploads', 'risk-registers');

const ALLOWED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const ALLOWED_EXTENSIONS = new Set(Object.values(ALLOWED_TYPES).flat());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const registerId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(registerId) || registerId <= 0) return cb(ApiError.badRequest('Id Risk Register tidak valid'));
    const dir = path.join(UPLOAD_ROOT, String(registerId));
    fs.mkdirSync(dir, { recursive: true });
    return cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    file.docId = crypto.randomUUID();
    return cb(null, `${file.docId}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ALLOWED_TYPES[file.mimetype];
  const genericMime = !file.mimetype || file.mimetype === 'application/octet-stream';
  const valid = ALLOWED_EXTENSIONS.has(ext) && (allowedExts ? allowedExts.includes(ext) : genericMime);
  if (!valid) {
    return cb(ApiError.badRequest('Tipe file tidak didukung. Gunakan gambar, Excel, PowerPoint, PDF, atau Word.'));
  }
  return cb(null, true);
};

const documentUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).array('files', 5);

module.exports = { documentUpload, UPLOAD_ROOT, ALLOWED_TYPES };
