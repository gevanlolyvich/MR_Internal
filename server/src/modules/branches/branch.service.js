const repo = require('./branch.repository');
const userRepo = require('../users/user.repository');
const ApiError = require('../../utils/ApiError');

const listBranches = (filters) => repo.findAll(filters);

const getBranch = async (id) => {
  const b = await repo.findById(id);
  if (!b) throw ApiError.notFound('Branch tidak ditemukan');
  return b;
};

const createBranch = async (body) => {
  const dup = await repo.findByCode(body.code);
  if (dup) throw ApiError.conflict('Kode branch sudah digunakan');
  const id = await repo.create(body);
  return repo.findById(id);
};

const updateBranch = async (id, body) => {
  const b = await repo.findById(id);
  if (!b) throw ApiError.notFound('Branch tidak ditemukan');
  if (body.code && body.code !== b.code) {
    const dup = await repo.findByCode(body.code);
    if (dup) throw ApiError.conflict('Kode branch sudah digunakan');
  }
  await repo.update(id, body);
  return repo.findById(id);
};

/**
 * Dropdown Risk Owner — hanya owner aktif pada branch yang sama
 * dengan Risk Officer (validasi backend, rule #26).
 */
const listOwnersByBranch = (branchId) => userRepo.findActiveOwnersByBranch(branchId);

module.exports = { listBranches, getBranch, createBranch, updateBranch, listOwnersByBranch };
