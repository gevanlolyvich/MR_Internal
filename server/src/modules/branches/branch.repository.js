const { query } = require('../../db/pool');

const baseSelect = `
  SELECT id, code, name, description, status, created_at, updated_at
    FROM branches`;

const findAll = async ({ status, q } = {}) => {
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(name LIKE ? OR code LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const [rows] = await query(
    `${baseSelect}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY name ASC`,
    params
  );
  return rows;
};

const findById = async (id) => {
  const [rows] = await query(`${baseSelect} WHERE id = ?`, [id]);
  return rows[0] || null;
};

const findByCode = async (code) => {
  const [rows] = await query(`${baseSelect} WHERE code = ?`, [code]);
  return rows[0] || null;
};

const create = async (data) => {
  const [result] = await query(
    'INSERT INTO branches (code, name, description, status) VALUES (?, ?, ?, ?)',
    [data.code, data.name, data.description || null, data.status || 'ACTIVE']
  );
  return result.insertId;
};

const update = async (id, data) => {
  const fields = [];
  const params = [];
  ['code', 'name', 'description', 'status'].forEach((k) => {
    if (data[k] !== undefined) {
      fields.push(`${k} = ?`);
      params.push(data[k]);
    }
  });
  if (!fields.length) return 0;
  params.push(id);
  const [result] = await query(`UPDATE branches SET ${fields.join(', ')} WHERE id = ?`, params);
  return result.affectedRows;
};

module.exports = { findAll, findById, findByCode, create, update };
