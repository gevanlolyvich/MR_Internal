require('dotenv').config();
const env = require('./config/env');
const app = require('./app');
const { ping } = require('./db/pool');

const start = async () => {
  try {
    await ping();
    console.log(`[DB] Terhubung ke MySQL: ${env.db.database} @ ${env.db.host}:${env.db.port}`);
  } catch (err) {
    console.error('[DB] Gagal terhubung:', err.message);
    console.error('     Pastikan XAMPP MySQL berjalan dan database jxb_mr sudah dimigrasi (lihat server/MIGRATION.md).');
  }

  app.listen(env.port, () => {
    console.log(`[API] Server berjalan di http://localhost:${env.port}`);
  });
};

start();
