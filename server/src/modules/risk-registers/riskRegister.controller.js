const path = require('path');
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

exports.setMrInstructions = asyncHandler(async (req, res) => {
  const data = await service.setMrInstructions(req.params.id, req.body.items, req);
  res.json({ success: true, message: 'Instruksi tindak lanjut dikirim ke Officer', data });
});

exports.submitFollowUpRealization = asyncHandler(async (req, res) => {
  const data = await service.submitFollowUpRealization(req.params.id, req.body.items, req);
  res.json({ success: true, message: 'Realisasi dikirim ke Risk Owner', data });
});

exports.uploadDocuments = asyncHandler(async (req, res) => {
  const data = await service.uploadDocuments(req.params.id, req.params.itemId, req.files, req);
  res.json({ success: true, data });
});

exports.removeDocument = asyncHandler(async (req, res) => {
  const data = await service.removeDocument(req.params.id, req.params.itemId, req.params.docId, req);
  res.json({ success: true, data });
});

exports.downloadDocument = asyncHandler(async (req, res) => {
  const { doc, filePath } = await service.getDocumentForDownload(req.params.id, req.params.docId, req.user);
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(doc.original_name).replace(/"/g, '')}"`);
  res.sendFile(filePath);
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
