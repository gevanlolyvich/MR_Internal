const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middlewares/auth');
const { query } = require('../../db/pool');
const rrService = require('../risk-registers/riskRegister.service');
const { parsePagination } = require('../../utils/pagination');
const { SCORE_SUB } = require('../dashboard/dashboard.service');
const { ROLES } = require('../../config/roles');

router.use(authenticate, authorize('monitoring:view'));

/** Ringkasan per branch + level (untuk visualisasi) */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.year) {
      where.push('rr.year = ?');
      params.push(req.query.year);
    }
    if (req.query.branch) {
      where.push('rr.branch_id = ?');
      params.push(req.query.branch);
    }
    if (req.query.category) {
      where.push('EXISTS (SELECT 1 FROM risk_register_categories c WHERE c.risk_register_id = rr.id AND c.category_id = ?)');
      params.push(req.query.category);
    }
    if (req.query.status) {
      where.push('rr.status = ?');
      params.push(req.query.status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await query(
      `SELECT b.id AS branch_id, b.name AS branch_name,
              COUNT(DISTINCT rr.id) AS total_risk,
              SUM(rr.status = 'APPROVED') AS active_risk,
              SUM(rr.status = 'WAITING_OWNER_APPROVAL') AS waiting_owner,
              SUM(rr.status = 'WAITING_MR_APPROVAL') AS waiting_mr,
              SUM(rr.status IN ('REJECTED_BY_OWNER','REJECTED_BY_MR')) AS rejected_risk,
              MAX(${SCORE_SUB.inherent}) AS max_inherent,
              MAX(${SCORE_SUB.residual}) AS max_residual,
              MAX(${SCORE_SUB.after}) AS max_after,
              ROUND(AVG(${SCORE_SUB.after}), 2) AS avg_after
         FROM branches b
         LEFT JOIN risk_registers rr ON rr.branch_id = b.id ${whereSql}
        GROUP BY b.id, b.name
        HAVING total_risk > 0
        ORDER BY total_risk DESC`,
      params
    );

    const levels = await rrService.loadLevels();
    const levelOf = (s) => {
      if (s === null || s === undefined) return null;
      const f = levels.find((l) => s >= l.min_score && s <= l.max_score);
      return f ? { score: Number(s), level: f.level, color: f.color } : { score: Number(s), level: '-', color: '#94a3b8' };
    };

    res.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        total_risk: Number(r.total_risk),
        active_risk: Number(r.active_risk || 0),
        waiting_owner: Number(r.waiting_owner || 0),
        waiting_mr: Number(r.waiting_mr || 0),
        rejected_risk: Number(r.rejected_risk || 0),
        inherent: levelOf(r.max_inherent),
        residual: levelOf(r.max_residual),
        after: levelOf(r.max_after),
        avg_after: Number(r.avg_after || 0),
      })),
    });
  })
);

/** Detail per register dengan filter lengkap */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query, 20, 100);
    // Monitoring khusus MR: baca semua data
    const scope = req.user.role === ROLES.MR ? { role: 'MR', userId: req.user.id } : { role: req.user.role, userId: req.user.id };
    const result = await rrService.getList(req.query, scope, pagination);
    res.json({ success: true, ...result });
  })
);

module.exports = router;
