const router = require('express').Router();
const { authenticate, authorize } = require('../../middlewares/auth');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middlewares/validate');
const controller = require('./master.controller');
const { createRules, updateRules, toleranceRules } = require('./master.validation');

router.use(authenticate);

// Master data (read) — MR kelola; register form butuh read master
router.get(
  '/tolerance',
  authorize('master:manage', 'matrix:view', 'risk-register:create', 'risk-register:view'),
  asyncHandler(controller.getTolerance)
);
router.put('/tolerance', authorize('master:manage'), toleranceRules, validate, controller.saveTolerance);

router.get('/:type', authorize('master:manage', 'risk-register:create', 'risk-register:view', 'dashboard:view', 'matrix:view', 'monitoring:view'), controller.list);
router.post('/:type', authorize('master:manage'), createRules, validate, controller.create);
router.put('/:type/:id', authorize('master:manage'), updateRules, validate, controller.update);
router.delete('/:type/:id', authorize('master:manage'), controller.remove);

module.exports = router;
