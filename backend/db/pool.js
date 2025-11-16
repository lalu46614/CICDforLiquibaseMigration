const mysql = require('mysql2/promise');
require('dotenv').config();
const url = require('url');

/**
 * Parse JDBC URL and create MySQL connection pool
 * Supports: jdbc:mysql://host:port/database?user=xxx&password=yyy
 * Also supports: mysql://user:password@host:port/database
 */
function createPool(jdbcUrl) {
  if (!jdbcUrl) {
    throw new Error('Database URL is required');
  }

  // Remove jdbc: prefix if present
  let clean = jdbcUrl.replace(/^jdbc:/i, '');

  // Handle mysql://user:password@host:port/database format
  if (clean.includes('@') && !clean.includes('?')) {
    // Standard URL format: mysql://user:pass@host:port/db
    const parsed = new url.URL(clean);
    return mysql.createPool({
      host: parsed.hostname,
      port: parsed.port || 3306,
      user: parsed.username,
      password: parsed.password,
      database: parsed.pathname.replace(/^\//, ''), // Remove leading slash
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  // Handle jdbc:mysql://host:port/database?user=xxx&password=yyy format
  const parsed = new url.URL(clean);
  
  // Extract database name from pathname (remove leading slash)
  const database = parsed.pathname.replace(/^\//, '');
  
  // Get user and password from query params
  const user = parsed.searchParams.get('user') || parsed.username;
  const password = parsed.searchParams.get('password') || parsed.password;

  return mysql.createPool({
    host: parsed.hostname,
    port: parsed.port || 3306,
    user: user,
    password: password,
    database: database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

module.exports = {
  DEV: createPool(process.env.DEV_DATABASE_URL),
  QA: createPool(process.env.QA_DATABASE_URL),
  PROD: createPool(process.env.PROD_DATABASE_URL)
};
