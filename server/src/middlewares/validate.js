const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Jalankan setelah array of express-validator chains. */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(ApiError.badRequest('Validasi gagal', details));
};

module.exports = validate;
