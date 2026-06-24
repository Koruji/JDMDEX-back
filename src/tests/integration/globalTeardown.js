const mysql = require('mysql2/promise');

module.exports = async () => {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3307', 10),
    user: 'root',
    password: 'rootpassword',
  });

  await conn.query('DROP DATABASE IF EXISTS jdmdex_test');
  await conn.end();
};
