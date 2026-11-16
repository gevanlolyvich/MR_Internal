const asyncHandler = require('../../utils/asyncHandler');
const service = require('./master.service');
const { audit } = require('../../middlewares/audit');

exports.list = asyncHandler(async (req, res) => {
  const rows = await service.list(req.params.type, req.query);
  res.json({ success: true, data: rows });
});

exports.create = asyncHandler(async (req, res) => {
  const row = await service.create(req.params.type, req.body);
  audit({ req, action: `CREATE_MASTER_${req.params.type.toUpperCase()}`, entity: req.params.type, entityId: row.id || row.score, newValue: req.body });
  res.status(201).json({ success: true, data: row });
});

exports.update = asyncHandler(async (req, res) => {
  const { before, after } = await service.update(req.params.type, req.params.id, req.body);
  audit({
    req,
    action: `UPDATE_MASTER_${req.params.type.toUpperCase()}`,
    entity: req.params.type,
    entityId: req.params.id,
    oldValue: before,
    newValue: after,
  });
  res.json({ success: true, data: after });
});

exports.remove = asyncHandler(async (req, res) => {
  const result = await service.remove(req.params.type, req.params.id);
  audit({ req, action: `DELETE_MASTER_${req.params.type.toUpperCase()}`, entity: req.params.type, entityId: req.params.id });
  res.json({ success: true, data: result });
});

exports.getTolerance = asyncHandler(async (req, res) => {
  const row = await service.listTolerance();
  res.json({ success: true, data: row });
});

exports.saveTolerance = asyncHandler(async (req, res) => {
  const row = await service.saveTolerance(req.body);
  audit({ req, action: 'UPDATE_RISK_TOLERANCE', entity: 'risk_tolerance_config', entityId: 1, newValue: req.body });
  res.json({ success: true, data: row });
});
