const { body, param, query } = require('express-validator');

const idRule = param('id').isInt({ min: 1 }).withMessage('Id tidak valid');

const rejectRules = [
  idRule,
  body('reason').trim().notEmpty().withMessage('Alasan Reject wajib diisi').isLength({ max: 1000 }),
];

const queueRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

module.exports = { idRule, rejectRules, queueRules };
