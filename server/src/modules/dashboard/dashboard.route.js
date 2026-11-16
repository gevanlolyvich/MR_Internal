const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middlewares/auth');
const { getDashboard } = require('./dashboard.service');

router.get(
  '/',
  authenticate,
  authorize('dashboard:view'),
  asyncHandler(async (req, res) => {
    const data = await getDashboard(req.user);
    res.json({ success: true, data });
  })
);

module.exports = router;
