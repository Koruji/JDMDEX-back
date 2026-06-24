const pool = require('../../db/database');

// DELETE FROM est utilisé à la place de TRUNCATE pour éviter les table-level locks
beforeEach(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DELETE FROM event_comments');
    await conn.query('DELETE FROM events');
    await conn.query('DELETE FROM photos');
    await conn.query('DELETE FROM cars');
    await conn.query('DELETE FROM users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
});

// Ferme le pool après chaque fichier de test pour éviter les connexions orphelines
afterAll(async () => {
  await pool.end();
});
