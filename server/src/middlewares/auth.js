const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { hasPermission } = require('../config/roles');
const { query } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');

/** Verifikasi JWT + load user terbaru dari database. */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Token tidak ditemukan');

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (_) {
    throw ApiError.unauthorized('Token tidak valid atau kedaluwarsa');
  }

  const [rows] = await query(
    `SELECT u.id, u.name, u.username, u.email, u.role, u.status, u.branch_id,
            b.name AS branch_name, b.code AS branch_code
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.id = ?`,
    [payload.sub]
  );
  const user = rows[0];
  if (!user) throw ApiError.unauthorized('User tidak ditemukan');
  if (user.status !== 'ACTIVE') throw ApiError.forbidden('User tidak aktif');

  req.user = user;
  next();
});

/**
 * Authorization berbasis permission matrix (bukan hanya cek role di frontend).
 * authorize('approval:mr')
 */
const authorize =
  (...permissions) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const allowed = permissions.some((p) => hasPermission(req.user.role, p));
    if (!allowed) return next(ApiError.forbidden('Anda tidak memiliki akses untuk tindakan ini'));
    return next();
  };

/** Cek role eksplisit jika diperlukan. */
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Role tidak diizinkan'));
    return next();
  };

module.exports = { authenticate, authorize, requireRole };
