const { body } = require('express-validator');
const validate = require('../../middlewares/validate');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../../utils/asyncHandler');
const { login, me } = require('./auth.service');
const { authenticate } = require('../../middlewares/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi 15 menit lagi.' },
});

// Rate limit dinonaktifkan saat test agar tidak menggagalkan skenario test berulang
const loginGuard =
  process.env.NODE_ENV === 'test' ? (req, res, next) => next() : loginLimiter;

const router = require('express').Router();

router.post(
  '/login',
  loginGuard,
  [
    body('username').trim().notEmpty().withMessage('Username wajib diisi'),
    body('password').notEmpty().withMessage('Password wajib diisi'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await login(req.body, req);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await me(req.user) });
  })
);

module.exports = router;
