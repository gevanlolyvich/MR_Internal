const { query } = require('../db/pool');

const getClientIp = (req) =>
  ((req && req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim() ||
  (req && req.socket && req.socket.remoteAddress) ||
  null;

const jsonOrNull = (value) => {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return null;
  }
};

/**
 * Catat audit log. Tidak menyimpan password/data sensitif.
 * Dipanggil manual dari service (fire & forget, tidak menggagalkan request utama).
 * @param {object} opts.user - override user (mis. saat login, req.user belum ada)
 */
const audit = ({ req, user: userOverride, action, entity = null, entityId = null, oldValue = null, newValue = null }) => {
  const user = userOverride || req.user || null;
  const sql = `INSERT INTO audit_logs
      (user_id, role, action, entity, entity_id, ip, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    user ? user.id : null,
    user ? user.role : null,
    action,
    entity,
    entityId === null || entityId === undefined ? null : String(entityId),
    getClientIp(req),
    jsonOrNull(oldValue),
    jsonOrNull(newValue),
  ];
  query(sql, params).catch((err) => console.error('[AUDIT]', err.message));
};

module.exports = { audit, getClientIp };
