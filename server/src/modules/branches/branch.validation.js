const { body, param } = require('express-validator');

const createRules = [
  body('code').trim().notEmpty().withMessage('Branch code wajib diisi').isLength({ max: 32 }),
  body('name').trim().notEmpty().withMessage('Branch name wajib diisi').isLength({ max: 150 }),
  body('description').optional({ nullable: true }).trim(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('code').optional().trim().notEmpty().isLength({ max: 32 }),
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('description').optional({ nullable: true }).trim(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];

const ownersRules = [param('id').isInt({ min: 1 })];

module.exports = { createRules, updateRules, ownersRules };
