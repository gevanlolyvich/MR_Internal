const repo = require('./master.repository');
const ApiError = require('../../utils/ApiError');
const { invalidateLevelCache } = require('../../utils/riskLevel');

const assertType = (type) => {
  const cfg = repo.getConfig(type);
  if (!cfg) throw ApiError.notFound('Jenis master data tidak dikenal');
  return cfg;
};

const list = async (type, filters) => {
  assertType(type);
  return repo.findAll(type, filters);
};

const getOne = async (type, id) => {
  assertType(type);
  const row = await repo.findById(type, id);
  if (!row) throw ApiError.notFound(`${assertType(type).label} tidak ditemukan`);
  return row;
};

const create = async (type, body) => {
  assertType(type);
  try {
    const id = await repo.create(type, body);
    if (type === 'levels') invalidateLevelCache();
    return await repo.findById(type, id);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw ApiError.conflict('Kode/skor sudah ada pada master ini');
    throw err;
  }
};

const update = async (type, id, body) => {
  assertType(type);
  const before = await getOne(type, id);
  try {
    await repo.update(type, id, body);
    if (type === 'levels') invalidateLevelCache();
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw ApiError.conflict('Kode/skor sudah ada pada master ini');
    throw err;
  }
  return { before, after: await repo.findById(type, id) };
};

const remove = async (type, id) => {
  assertType(type);
  await getOne(type, id);
  if (['likelihoods', 'impacts', 'levels'].includes(type)) {
    throw ApiError.badRequest(`${assertType(type).label} tidak dapat dihapus (digunakan oleh kalkulasi risiko)`);
  }
  const referenced = await repo.isReferenced(type, id);
  if (referenced) throw ApiError.conflict('Data masih digunakan oleh Risk Register. Set status INACTIVE saja.');
  await repo.remove(type, id);
  if (type === 'levels') invalidateLevelCache();
  return { id, deleted: true };
};

const listTolerance = () => repo.getTolerance();
const saveTolerance = async (body) => {
  const row = await repo.updateTolerance(body);
  return row;
};

module.exports = { list, getOne, create, update, remove, listTolerance, saveTolerance, MASTER_TYPES: Object.keys(repo.MASTER_CONFIG) };
