const { query } = require('../../db/pool');

/**
 * Konfigurasi generik master data.
 * type  -> tabel, kolom, apakah punya status, apakah PK bukan id
 */
const MASTER_CONFIG = {
  categories: {
    table: 'risk_categories',
    columns: ['code', 'name', 'description', 'status'],
    hasStatus: true,
    order: 'code ASC',
    label: 'Risk Category',
  },
  treatments: {
    table: 'risk_treatments',
    columns: ['code', 'name', 'description', 'status'],
    hasStatus: true,
    order: 'code ASC',
    label: 'Risk Treatment',
  },
  sources: {
    table: 'risk_sources',
    columns: ['code', 'name', 'status'],
    hasStatus: true,
    order: 'code ASC',
    label: 'Risk Source',
  },
  severities: {
    table: 'severity_levels',
    columns: ['score', 'description', 'rp_value', 'status'],
    hasStatus: true,
    order: 'score ASC',
    label: 'Severity',
  },
  likelihoods: {
    table: 'likelihood_master',
    columns: ['score', 'name', 'description'],
    hasStatus: false,
    keyColumn: 'score',
    order: 'score ASC',
    label: 'Likelihood',
  },
  impacts: {
    table: 'impact_master',
    columns: ['score', 'name', 'description'],
    hasStatus: false,
    keyColumn: 'score',
    order: 'score ASC',
    label: 'Impact',
  },
  levels: {
    table: 'risk_level_master',
    columns: ['min_score', 'max_score', 'level', 'color'],
    hasStatus: false,
    order: 'min_score ASC',
    label: 'Risk Level',
  },
};

const getConfig = (type) => MASTER_CONFIG[type] || null;

const findAll = async (type, { status } = {}) => {
  const cfg = getConfig(type);
  const where = status && cfg.hasStatus ? ' WHERE status = ?' : '';
  const [rows] = await query(
    `SELECT * FROM \`${cfg.table}\`${where} ORDER BY ${cfg.order}`,
    status && cfg.hasStatus ? [status] : []
  );
  return rows;
};

const findById = async (type, id) => {
  const cfg = getConfig(type);
  const key = cfg.keyColumn || 'id';
  const [rows] = await query(`SELECT * FROM \`${cfg.table}\` WHERE \`${key}\` = ?`, [id]);
  return rows[0] || null;
};

const create = async (type, data) => {
  const cfg = getConfig(type);
  const cols = cfg.columns.filter((c) => data[c] !== undefined);
  const values = cols.map((c) => data[c]);
  const [result] = await query(
    `INSERT INTO \`${cfg.table}\` (${cols.map((c) => `\`${c}\``).join(', ')})
     VALUES (${cols.map(() => '?').join(', ')})`,
    values
  );
  return result.insertId;
};

const update = async (type, id, data) => {
  const cfg = getConfig(type);
  const key = cfg.keyColumn || 'id';
  const cols = cfg.columns.filter((c) => data[c] !== undefined);
  if (!cols.length) return 0;
  const params = cols.map((c) => data[c]);
  params.push(id);
  const [result] = await query(
    `UPDATE \`${cfg.table}\` SET ${cols.map((c) => `\`${c}\` = ?`).join(', ')} WHERE \`${key}\` = ?`,
    params
  );
  return result.affectedRows;
};

const remove = async (type, id) => {
  const cfg = getConfig(type);
  const key = cfg.keyColumn || 'id';
  const [result] = await query(`DELETE FROM \`${cfg.table}\` WHERE \`${key}\` = ?`, [id]);
  return result.affectedRows;
};

/** Apakah data masih dirujuk oleh risk_register_causes? */
const isReferenced = async (type, id) => {
  const refMap = {
    categories: { table: 'risk_register_categories', column: 'category_id' },
    treatments: { table: 'risk_register_causes', column: 'treatment_id' },
    sources: { table: 'risk_register_causes', column: 'source_id' },
    severities: { table: 'risk_register_causes', column: 'severity_id' },
    likelihoods: null,
    impacts: null,
    levels: null,
  };
  const ref = refMap[type];
  if (!ref) return false;
  const [rows] = await query(`SELECT COUNT(*) AS total FROM \`${ref.table}\` WHERE \`${ref.column}\` = ?`, [id]);
  return Number(rows[0].total) > 0;
};

// ---- Risk tolerance config (1 baris) ----
const getTolerance = async () => {
  const [rows] = await query('SELECT * FROM risk_tolerance_config WHERE id = 1');
  return rows[0] || null;
};

const updateTolerance = async (data) => {
  await query(
    'UPDATE risk_tolerance_config SET max_score = ?, note = ? WHERE id = 1',
    [data.max_score, data.note ?? null]
  );
  return getTolerance();
};

module.exports = { MASTER_CONFIG, getConfig, findAll, findById, create, update, remove, isReferenced, getTolerance, updateTolerance };
