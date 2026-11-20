const { body, param, query } = require('express-validator');
const { ALL_STATUS } = require('../../config/status');

const idRule = param('id').isInt({ min: 1 }).withMessage('Id tidak valid');

// Validasi mendalam (nested) dilakukan di service; di sini hanya cek struktur dasar.
const createRules = [
  body('objective').trim().notEmpty().withMessage('Objective wajib diisi'),
  body('risk_owner_id').notEmpty().withMessage('Risk Owner wajib dipilih').isInt({ min: 1 }),
  body('categories').isArray({ min: 1 }).withMessage('Minimal 1 Risk Category'),
];

const updateRules = [idRule, ...createRules];

const listRules = [
  query('year').optional().isInt({ min: 2000, max: 2100 }),
  query('branch').optional().isInt({ min: 1 }),
  query('category').optional().isInt({ min: 1 }),
  query('owner').optional().isInt({ min: 1 }),
  query('officer').optional().isInt({ min: 1 }),
  query('status').optional().isIn(ALL_STATUS),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const itemIdRule = param('itemId').notEmpty().withMessage('Item mitigasi tidak valid');
const docIdRule = param('docId').notEmpty().withMessage('Dokumen tidak valid');

module.exports = { idRule, createRules, updateRules, listRules, itemIdRule, docIdRule };
