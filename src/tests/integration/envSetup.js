// Ce fichier s'exécute avant le chargement de tout module (setupFiles).
// Il configure les env vars pour que database.js se connecte à jdmdex_test.
process.env.MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
process.env.MYSQL_PORT = process.env.MYSQL_PORT || '3307';
process.env.MYSQL_DATABASE = 'jdmdex_test';
process.env.MYSQL_USER = process.env.MYSQL_USER || 'jdmdex_user';
process.env.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'jdmdex_pass';
process.env.JWT_SECRET = 'integration-test-secret';
