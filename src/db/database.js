const mysql = require('mysql2/promise');
require('dotenv').config();
const logger = require('../utils/logger');

// Configuration de la connexion MariaDB
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  user: process.env.MYSQL_USER || 'jdmdex_user',
  password: process.env.MYSQL_PASSWORD || 'jdmdex_pass',
  database: process.env.MYSQL_DATABASE || 'jdmdex',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Tester la connexion à la base de données
async function testDatabaseConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    logger.info('Database connection successful', {
      operation: 'connection test',
    });
  } catch (error) {
    logger.databaseError(error, {
      operation: 'connection test',
    });
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Appeler le test de connexion au démarrage
testDatabaseConnection().catch((error) => {
  logger.databaseError(error, { operation: 'startup connection test' });
});

// Exporter le pool de connexions
module.exports = pool;
