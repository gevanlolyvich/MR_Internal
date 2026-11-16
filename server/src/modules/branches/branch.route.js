const router = require('express').Router();
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const controller = require('./branch.controller');
const { createRules, updateRules, ownersRules } = require('./branch.validation');

router.use(authenticate);

// Dropdown owner per branch — boleh diakses Risk Officer saat membuat register
router.get('/:id/owners', ownersRules, validate, authorize('risk-register:create', 'approval:owner', 'risk-register:view'), controller.owners);

router.get('/', authorize('branch:manage', 'risk-register:view', 'monitoring:view', 'dashboard:view'), controller.list);
router.get('/:id', authorize('branch:manage'), controller.get);
router.post('/', authorize('branch:manage'), createRules, validate, controller.create);
router.put('/:id', authorize('branch:manage'), updateRules, validate, controller.update);

module.exports = router;
