const asyncHandler = require('../../utils/asyncHandler');
const service = require('./branch.service');
const { audit } = require('../../middlewares/audit');

exports.list = asyncHandler(async (req, res) => {
  const rows = await service.listBranches(req.query);
  res.json({ success: true, data: rows });
});

exports.get = asyncHandler(async (req, res) => {
  const row = await service.getBranch(req.params.id);
  res.json({ success: true, data: row });
});

exports.create = asyncHandler(async (req, res) => {
  const row = await service.createBranch(req.body);
  audit({ req, action: 'CREATE_BRANCH', entity: 'branches', entityId: row.id, newValue: { code: row.code, name: row.name } });
  res.status(201).json({ success: true, data: row });
});

exports.update = asyncHandler(async (req, res) => {
  const before = await service.getBranch(req.params.id);
  const row = await service.updateBranch(req.params.id, req.body);
  audit({
    req,
    action: 'UPDATE_BRANCH',
    entity: 'branches',
    entityId: req.params.id,
    oldValue: { code: before.code, name: before.name, status: before.status },
    newValue: { code: row.code, name: row.name, status: row.status },
  });
  res.json({ success: true, data: row });
});

exports.owners = asyncHandler(async (req, res) => {
  const rows = await service.listOwnersByBranch(req.params.id);
  res.json({ success: true, data: rows });
});
