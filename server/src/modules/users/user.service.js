const bcrypt = require('bcryptjs');
const repo = require('./user.repository');
const branchRepo = require('../branches/branch.repository');
const ApiError = require('../../utils/ApiError');
const { ROLES, ALL_ROLES } = require('../../config/roles');

const listUsers = async (filters) => repo.findAll(filters);

const getUser = async (id) => {
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User tidak ditemukan');
  return user;
};

const assertBranchUsable = async (branchId) => {
  if (!branchId) return; // MR boleh tanpa branch? tetap wajibkan branch untuk semua role
  const branch = await branchRepo.findById(branchId);
  if (!branch) throw ApiError.badRequest('Branch tidak ditemukan');
  if (branch.status !== 'ACTIVE') throw ApiError.badRequest('Branch nonaktif tidak dapat digunakan');
};

const createUser = async (body) => {
  const existingU = await repo.findByUsername(body.username);
  if (existingU) throw ApiError.conflict('Username sudah digunakan');
  const existingE = await repo.findByEmail(body.email);
  if (existingE) throw ApiError.conflict('Email sudah digunakan');
  if (!body.branch_id) throw ApiError.badRequest('Branch wajib dipilih');
  await assertBranchUsable(body.branch_id);

  const passwordHash = await bcrypt.hash(body.password, 10);
  const id = await repo.create({ ...body, password_hash: passwordHash });
  return repo.findById(id);
};

const updateUser = async (id, body) => {
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User tidak ditemukan');

  if (body.username && body.username !== user.username) {
    const dup = await repo.findByUsername(body.username);
    if (dup) throw ApiError.conflict('Username sudah digunakan');
  }
  if (body.email && body.email !== user.email) {
    const dup = await repo.findByEmail(body.email);
    if (dup) throw ApiError.conflict('Email sudah digunakan');
  }
  if (body.branch_id !== undefined) await assertBranchUsable(body.branch_id);
  if (body.role && !ALL_ROLES.includes(body.role)) throw ApiError.badRequest('Role tidak valid');

  const data = { ...body };
  if (body.password) data.password_hash = await bcrypt.hash(body.password, 10);
  else delete data.password;
  if (data.username === undefined) delete data.username;
  if (data.email === undefined) delete data.email;

  await repo.update(id, data);
  return repo.findById(id);
};

const deleteUser = async (id) => {
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User tidak ditemukan');
  // Nonaktifkan (soft) agar riwayat risk register tetap utuh (FK)
  await repo.update(id, { status: 'INACTIVE' });
  return { id, status: 'INACTIVE' };
};

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, ROLES };
