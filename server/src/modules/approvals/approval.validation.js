const { body, param, query } = require('express-validator');
const { FOLLOW_UP_STATUS } = require('../../config/status');

const idRule = param('id').isInt({ min: 1 }).withMessage('Id tidak valid');

const rejectRules = [
  idRule,
  body('reason').trim().notEmpty().withMessage('Alasan Reject wajib diisi').isLength({ max: 1000 }),
];

const queueRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const followUpStatusRules = [
  idRule,
  body('items').isArray({ min: 1 }).withMessage('Minimal 1 status tindak lanjut wajib dikirim'),
  body('items.*.itemId').notEmpty().withMessage('Item mitigasi wajib dipilih'),
  body('items.*.status').isIn(Object.values(FOLLOW_UP_STATUS)).withMessage('Status tindak lanjut tidak valid'),
];

module.exports = { idRule, rejectRules, queueRules, followUpStatusRules };
