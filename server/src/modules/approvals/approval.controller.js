const asyncHandler = require('../../utils/asyncHandler');
const service = require('./approval.service');
const { parsePagination } = require('../../utils/pagination');

exports.queue = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query, 15, 100);
  const result = await service.getQueue(req.user, req.query, pagination);
  res.json({ success: true, ...result });
});

exports.get = asyncHandler(async (req, res) => {
  const data = await service.getDetail(req.params.id, req.user);
  res.json({ success: true, data });
});

exports.approve = asyncHandler(async (req, res) => {
  const data = await service.approve(req.params.id, req);
  res.json({ success: true, message: 'Risk Register disetujui', data });
});

exports.reject = asyncHandler(async (req, res) => {
  const data = await service.reject(req.params.id, req.body.reason, req);
  res.json({ success: true, message: 'Risk Register ditolak', data });
});
