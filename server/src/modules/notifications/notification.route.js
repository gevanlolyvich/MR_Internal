const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middlewares/auth');
const { query, withTransaction } = require('../../db/pool');

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows] = await query(
      `SELECT n.*, rr.risk_code
         FROM notifications n
         LEFT JOIN risk_registers rr ON rr.id = n.risk_register_id
        WHERE n.user_id = ?
        ORDER BY n.id DESC
        LIMIT 50`,
      [req.user.id]
    );
    const [unread] = await query(
      'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ success: true, data: rows, unread: Number(unread[0].total) });
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: { updated: true } });
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    res.json({ success: true, data: { updated: true } });
  })
);

module.exports = router;
