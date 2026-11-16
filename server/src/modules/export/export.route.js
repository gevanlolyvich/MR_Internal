const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middlewares/auth');
const { exportRiskRegister } = require('./export.service');
const { audit } = require('../../middlewares/audit');

router.get(
  '/risk-register',
  authenticate,
  authorize('export:run'),
  asyncHandler(async (req, res) => {
    const buffer = await exportRiskRegister(req.query);
    const year = req.query.year || new Date().getFullYear();
    const filename = `Risk-Register-${year}-${Date.now()}.xlsx`;

    audit({
      req,
      action: 'EXPORT_RISK_REGISTER',
      entity: 'risk_registers',
      entityId: null,
      newValue: { filters: req.query },
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  })
);

module.exports = router;
