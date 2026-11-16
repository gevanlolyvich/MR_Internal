const router = require('express').Router();
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const controller = require('./user.controller');
const { createRules, updateRules } = require('./user.validation');

router.use(authenticate, authorize('user:manage'));

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', createRules, validate, controller.create);
router.put('/:id', updateRules, validate, controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
