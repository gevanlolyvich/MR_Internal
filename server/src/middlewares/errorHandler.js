const ApiError = require('../utils/ApiError');

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`));
};

/* eslint-disable no-unused-vars */
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan pada server';
  let details = err.details || null;

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
