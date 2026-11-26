const router = require('express').Router();
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const controller = require('./approval.controller');
const {
  idRule,
  approveRules,
  rejectRules,
  rejectInstructionRules,
  queueRules,
  followUpStatusRules,
} = require('./approval.validation');

router.use(authenticate, authorize('approval:owner', 'approval:mr'));

router.get('/', queueRules, validate, controller.queue);
router.get('/:id', idRule, validate, controller.get);
router.post('/:id/approve', approveRules, validate, controller.approve);
router.post('/:id/reject', rejectRules, validate, controller.reject);
router.post('/:id/reject-instruction', rejectInstructionRules, validate, controller.rejectInstruction);
router.put('/:id/follow-up-status', followUpStatusRules, validate, controller.setFollowUpStatus);

module.exports = router;
