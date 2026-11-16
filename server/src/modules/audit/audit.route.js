const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middlewares/auth');
const { query } = require('../../db/pool');
const { parsePagination } = require('../../utils/pagination');

router.use(authenticate, authorize('audit:view'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query, 20, 100);
    const where = [];
    const params = [];

    if (req.query.action) {
      where.push('a.action = ?');
      params.push(req.query.action);
    }
    if (req.query.user) {
      where.push('a.user_id = ?');
      params.push(req.query.user);
    }
    if (req.query.entity) {
      where.push('a.entity = ?');
      params.push(req.query.entity);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await query(`SELECT COUNT(*) AS total FROM audit_logs a${whereSql}`, params);
    const [rows] = await query(
      `SELECT a.*, u.name AS user_name, u.username
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
        ${whereSql}
        ORDER BY a.id DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      success: true,
      data: rows,
      total: Number(countRows[0].total),
      page,
      limit,
    });
  })
);

module.exports = router;
