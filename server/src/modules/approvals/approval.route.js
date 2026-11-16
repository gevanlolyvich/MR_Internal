const router = require('express').Router();
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const controller = require('./approval.controller');
const { idRule, rejectRules, queueRules } = require('./approval.validation');

router.use(authenticate, authorize('approval:owner', 'approval:mr'));

router.get('/', queueRules, validate, controller.queue);
router.get('/:id', idRule, validate, controller.get);
router.post('/:id/approve', idRule, validate, controller.approve);
router.post('/:id/reject', rejectRules, validate, controller.reject);

module.exports = router;
