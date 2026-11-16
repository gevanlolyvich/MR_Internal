const { query, withTransaction } = require('../../db/pool');

const baseSelect = `
  SELECT u.id, u.branch_id, u.name, u.username, u.email, u.role, u.status,
         u.last_login_at, u.created_at, u.updated_at,
         b.name AS branch_name, b.code AS branch_code
    FROM users u
    LEFT JOIN branches b ON b.id = u.branch_id`;

const findAll = async ({ role, branch_id, status, q } = {}) => {
  const where = [];
  const params = [];
  if (role) {
    where.push('u.role = ?');
    params.push(role);
  }
  if (branch_id) {
    where.push('u.branch_id = ?');
    params.push(branch_id);
  }
  if (status) {
    where.push('u.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const sql = `${baseSelect}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY u.name ASC`;
  const [rows] = await query(sql, params);
  return rows;
};

const findById = async (id) => {
  const [rows] = await query(`${baseSelect} WHERE u.id = ?`, [id]);
  return rows[0] || null;
};

const findByUsername = async (username) => {
  const [rows] = await query(`${baseSelect} WHERE u.username = ?`, [username]);
  return rows[0] || null;
};

const findByEmail = async (email) => {
  const [rows] = await query(`${baseSelect} WHERE u.email = ?`, [email]);
  return rows[0] || null;
};

const create = async (data, conn = null) => {
  const run = conn ? conn.query.bind(conn) : query;
  const [result] = await run(
    `INSERT INTO users (branch_id, name, username, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.branch_id ?? null, data.name, data.username, data.email, data.password_hash, data.role, data.status || 'ACTIVE']
  );
  return result.insertId;
};

const update = async (id, data, conn = null) => {
  const run = conn ? conn.query.bind(conn) : query;
  const fields = [];
  const params = [];
  const map = {
    branch_id: data.branch_id,
    name: data.name,
    username: data.username,
    email: data.email,
    password_hash: data.password_hash,
    role: data.role,
    status: data.status,
  };
  Object.entries(map).forEach(([k, v]) => {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      params.push(v);
    }
  });
  if (!fields.length) return 0;
  params.push(id);
  const [result] = await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  return result.affectedRows;
};

const remove = async (id) => {
  const [result] = await query('DELETE FROM users WHERE id = ?', [id]);
  return result.affectedRows;
};

/** Owner aktif pada branch tertentu (rule #26) */
const findActiveOwnersByBranch = async (branchId) => {
  const [rows] = await query(
    `SELECT u.id, u.name, u.username, u.email, u.branch_id
       FROM users u
      WHERE u.role = 'RISK_OWNER' AND u.status = 'ACTIVE' AND u.branch_id = ?
      ORDER BY u.name ASC`,
    [branchId]
  );
  return rows;
};

const countByRole = async () => {
  const [rows] = await query('SELECT role, COUNT(*) AS total FROM users GROUP BY role');
  return rows;
};

module.exports = {
  findAll,
  findById,
  findByUsername,
  findByEmail,
  create,
  update,
  remove,
  findActiveOwnersByBranch,
  countByRole,
  withTransaction,
};
