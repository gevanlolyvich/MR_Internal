const asyncHandler = require('../../utils/asyncHandler');
const service = require('./riskRegister.service');
const { parsePagination } = require('../../utils/pagination');
const { audit } = require('../../middlewares/audit');

const scopeOf = (user) => ({ role: user.role, userId: user.id });

exports.list = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query, 15, 100);
  const result = await service.getList(req.query, scopeOf(req.user), pagination);
  res.json({ success: true, ...result });
});

exports.get = asyncHandler(async (req, res) => {
  const data = await service.getDetail(req.params.id, req.user);
  res.json({ success: true, data });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await service.createRegister(req.body, req);
  res.status(201).json({ success: true, data });
});

exports.update = asyncHandler(async (req, res) => {
  const data = await service.updateRegister(req.params.id, req.body, req);
  res.json({ success: true, data });
});

exports.submit = asyncHandler(async (req, res) => {
  const data = await service.submitRegister(req.params.id, req);
  res.json({ success: true, data });
});

exports.history = asyncHandler(async (req, res) => {
  const data = await service.getHistory(req.params.id);
  res.json({ success: true, data });
});

exports.remove = asyncHandler(async (req, res) => {
  const data = await service.deleteRegister(req.params.id, req);
  res.json({ success: true, data });
});

exports.owners = asyncHandler(async (req, res) => {
  // Dropdown owner mengikuti branch Risk Officer yang login
  const branchId = req.user.branch_id;
  if (!branchId) return res.json({ success: true, data: [] });
  const { query } = require('../../db/pool');
  const [rows] = await query(
    `SELECT id, name, username, email FROM users
      WHERE role = 'RISK_OWNER' AND status = 'ACTIVE' AND branch_id = ?
      ORDER BY name ASC`,
    [branchId]
  );
  return res.json({ success: true, data: rows });
});
