const { query } = require('../db/pool');

/**
 * Buat in-app notification (fire & forget).
 * Arsitektur sengaja dipisah agar mudah ditambahkan email/WS di masa depan
 * (cukup tambahkan notifier lain di sini).
 */
const notify = async ({ userIds, title, message, riskRegisterId = null }) => {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
  for (const userId of ids) {
    try {
      await query(
        `INSERT INTO notifications (user_id, title, message, risk_register_id)
         VALUES (?, ?, ?, ?)`,
        [userId, title, message, riskRegisterId]
      );
    } catch (err) {
      console.error('[NOTIFY]', err.message);
    }
  }
};

module.exports = { notify };
