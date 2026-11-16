const mysql = require('mysql2/promise');
const env = require('../config/env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
  timezone: '+00:00',
  charset: 'utf8mb4_unicode_ci',
});

/** Execute query with params, returns [rows, fields] */
const query = (sql, params = []) => pool.execute(sql, params);

/**
 * Run fn inside a transaction with a dedicated connection.
 * Rollback otomatis jika fn melempar error.
 */
const withTransaction = async (fn) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
};

const ping = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
};

module.exports = { pool, query, withTransaction, ping };
