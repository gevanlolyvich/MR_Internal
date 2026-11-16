const m = require('mysql2/promise');
(async () => {
  try {
    const c = await m.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '' });
    const [dbs] = await c.query('SHOW DATABASES');
    console.log('databases:', dbs.map((r) => Object.values(r)[0]).join(', '));
    let tables = [];
    try {
      const [t] = await c.query('SHOW TABLES FROM jxb_mr');
      tables = t.map((r) => Object.values(r)[0]);
    } catch (_) {
      tables = [];
    }
    console.log('jxb_mr tables:', tables.length ? tables.join(', ') : '(belum ada / kosong)');
    await c.end();
  } catch (e) {
    console.log('ERR', e.message);
  }
})();
