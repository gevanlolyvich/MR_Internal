const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../db/pool');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { audit } = require('../../middlewares/audit');
const { PERMISSIONS } = require('../../config/roles');

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role,
  status: u.status,
  branch_id: u.branch_id,
  branch_name: u.branch_name,
  branch_code: u.branch_code,
});

const login = async (body, req) => {
  const [rows] = await query(
    `SELECT u.*, b.name AS branch_name, b.code AS branch_code
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.username = ?`,
    [body.username.trim()]
  );
  const user = rows[0];

  // Pesan sama untuk user tidak ada / password salah (hindari user enumeration)
  if (!user) throw ApiError.unauthorized('Username atau password salah');
  const ok = await bcrypt.compare(body.password, user.password_hash);
  if (!ok) throw ApiError.unauthorized('Username atau password salah');
  if (user.status !== 'ACTIVE') throw ApiError.forbidden('User tidak aktif');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });

  audit({
    req,
    user: { id: user.id, role: user.role },
    action: 'LOGIN',
    entity: 'users',
    entityId: user.id,
  });

  return {
    token,
    user: publicUser(user),
    permissions: PERMISSIONS[user.role] || [],
  };
};

const me = async (user) => ({
  ...publicUser(user),
  permissions: PERMISSIONS[user.role] || [],
});

module.exports = { login, me, publicUser };
