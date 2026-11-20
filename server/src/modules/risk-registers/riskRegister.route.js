const router = require('express').Router();
const { authenticate, authorize } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const controller = require('./riskRegister.controller');
const { documentUpload } = require('../uploads/upload.middleware');
const { idRule, createRules, updateRules, listRules, itemIdRule, docIdRule } = require('./riskRegister.validation');

router.use(authenticate);

router.get('/', authorize('risk-register:view'), listRules, validate, controller.list);
router.get('/owners/me', authorize('risk-register:create', 'risk-register:submit'), controller.owners);

router.get('/:id', idRule, validate, authorize('risk-register:view'), controller.get);
router.get('/:id/history', idRule, validate, authorize('risk-register:view'), controller.history);

router.post('/', authorize('risk-register:create'), createRules, validate, controller.create);
router.put('/:id', authorize('risk-register:edit'), updateRules, validate, controller.update);
router.post('/:id/submit', idRule, validate, authorize('risk-register:submit'), controller.submit);
router.delete('/:id', idRule, validate, authorize('risk-register:edit'), controller.remove);

router.get(
  '/:id/documents/:docId',
  idRule,
  docIdRule,
  validate,
  authorize('risk-register:view'),
  controller.downloadDocument
);
router.post(
  '/:id/mitigation-items/:itemId/documents',
  idRule,
  itemIdRule,
  validate,
  authorize('risk-register:edit'),
  documentUpload,
  controller.uploadDocuments
);
router.delete(
  '/:id/mitigation-items/:itemId/documents/:docId',
  idRule,
  itemIdRule,
  docIdRule,
  validate,
  authorize('risk-register:edit'),
  controller.removeDocument
);

module.exports = router;
