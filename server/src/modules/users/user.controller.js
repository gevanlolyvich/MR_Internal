const asyncHandler = require('../../utils/asyncHandler');
const service = require('./user.service');
const { audit } = require('../../middlewares/audit');

exports.list = asyncHandler(async (req, res) => {
  const rows = await service.listUsers(req.query);
  res.json({ success: true, data: rows });
});

exports.get = asyncHandler(async (req, res) => {
  const row = await service.getUser(req.params.id);
  res.json({ success: true, data: row });
});

exports.create = asyncHandler(async (req, res) => {
  const row = await service.createUser(req.body);
  audit({ req, action: 'CREATE_USER', entity: 'users', entityId: row.id, newValue: { username: row.username, role: row.role } });
  res.status(201).json({ success: true, data: row });
});

exports.update = asyncHandler(async (req, res) => {
  const before = await service.getUser(req.params.id);
  const row = await service.updateUser(req.params.id, req.body);
  audit({
    req,
    action: 'UPDATE_USER',
    entity: 'users',
    entityId: req.params.id,
    oldValue: { name: before.name, role: before.role, status: before.status, branch_id: before.branch_id },
    newValue: { name: row.name, role: row.role, status: row.status, branch_id: row.branch_id },
  });
  res.json({ success: true, data: row });
});

exports.remove = asyncHandler(async (req, res) => {
  const row = await service.deleteUser(req.params.id);
  audit({ req, action: 'DEACTIVATE_USER', entity: 'users', entityId: req.params.id });
  res.json({ success: true, data: row });
});
