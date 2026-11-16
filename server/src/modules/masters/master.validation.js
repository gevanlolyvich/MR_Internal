const { body, param } = require('express-validator');

const typeRule = param('type').custom((value) => {
  const allowed = ['categories', 'treatments', 'sources', 'severities', 'likelihoods', 'impacts', 'levels'];
  if (!allowed.includes(value)) throw new Error('Jenis master data tidak dikenal');
  return true;
});

const codeRule = body('code').optional().trim().notEmpty().withMessage('Code wajib diisi').isLength({ max: 32 });
const nameRule = body('name').optional().trim().notEmpty().withMessage('Name wajib diisi').isLength({ max: 255 });
const statusRule = body('status').optional().isIn(['ACTIVE', 'INACTIVE']);
const scoreRule = body('score').optional().isInt({ min: 1, max: 5 }).withMessage('Score harus 1-5');
const pct = body('implementation').optional().isInt({ min: 0, max: 100 });

const createRules = [
  typeRule,
  body('code').optional({ nullable: true }),
  body('name').optional({ nullable: true }),
  statusRule,
  scoreRule,
  body('min_score').optional().isInt({ min: 1, max: 25 }),
  body('max_score').optional().isInt({ min: 1, max: 25 }),
  body('level').optional().trim().notEmpty(),
  body('color').optional().trim().matches(/^#[0-9a-fA-F]{6}$/).withMessage('Color harus format hex #RRGGBB'),
  body('rp_value').optional({ nullable: true }).isFloat({ min: 0 }),
  body().custom((value) => {
    if (value.code !== undefined && !String(value.code).trim()) throw new Error('Code wajib diisi');
    if (value.name !== undefined && !String(value.name).trim()) throw new Error('Name wajib diisi');
    if (value.level !== undefined && !String(value.level).trim()) throw new Error('Level wajib diisi');
    if (value.description !== undefined && ['categories', 'treatments'].includes(value.__type) && !String(value.description || '').trim()) {
      // description optional
    }
    return true;
  }),
  pct,
];

const updateRules = [typeRule, ...createRules.slice(1)];

const toleranceRules = [
  body('max_score').isInt({ min: 1, max: 25 }).withMessage('max_score harus 1-25'),
  body('note').optional({ nullable: true }).trim(),
];

module.exports = { createRules, updateRules, toleranceRules, codeRule, nameRule };
