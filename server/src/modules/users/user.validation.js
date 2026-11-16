const { body, param } = require('express-validator');
const { ALL_ROLES } = require('../../config/roles');

const passwordPolicy = (field = 'password') =>
  body(field)
    .isLength({ min: 8 })
    .withMessage('Password minimal 8 karakter')
    .matches(/[A-Za-z]/)
    .withMessage('Password harus mengandung huruf')
    .matches(/[0-9]/)
    .withMessage('Password harus mengandung angka');

const createRules = [
  body('name').trim().notEmpty().withMessage('Name wajib diisi'),
  body('username').trim().isLength({ min: 3, max: 64 }).withMessage('Username 3-64 karakter'),
  body('email').trim().isEmail().withMessage('Email tidak valid').normalizeEmail(),
  passwordPolicy(),
  body('role').isIn(ALL_ROLES).withMessage('Role tidak valid'),
  body('branch_id').notEmpty().withMessage('Branch wajib dipilih').isInt({ min: 1 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty(),
  body('username').optional().trim().isLength({ min: 3, max: 64 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 8 }).matches(/[A-Za-z]/).matches(/[0-9]/)
    .withMessage('Password minimal 8 karakter, mengandung huruf dan angka'),
  body('role').optional().isIn(ALL_ROLES),
  body('branch_id').optional().isInt({ min: 1 }),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];

module.exports = { createRules, updateRules };
