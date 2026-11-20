const ApiError = require('../utils/ApiError');

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`));
};

/* eslint-disable no-unused-vars */
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan pada server';
  let details = err.details || null;

  if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Ukuran file maksimal 5 MB'
      : err.code === 'LIMIT_FILE_COUNT'
        ? 'Maksimal 5 dokumen per tindakan mitigasi'
        : `File tidak dapat diunggah (${err.code || 'upload error'})`;
  }

  // MySQL duplicate key
  if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = 'Data sudah ada (duplikat)';
  }
  // MySQL FK violation
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 409;
    message = 'Data masih digunakan oleh tabel lain';
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', err);
  }

  res.status(status).json({
    success: false,
    message,
    details,
  });
};

module.exports = { notFoundHandler, errorHandler };
