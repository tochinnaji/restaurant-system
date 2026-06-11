const mysql = require('mysql2/promise');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const requireEnv = (name, fallback = '') => {
  const value = process.env[name];
  if (isProduction && !value) {
    throw new Error(`${name} is required in production.`);
  }
  return value ?? fallback;
};

const pool = mysql.createPool({
  host: requireEnv('DB_HOST', 'localhost'),
  port: Number(process.env.DB_PORT || 3306),
  user: requireEnv('DB_USER', 'root'),
  password: requireEnv('DB_PASSWORD', ''),
  database: requireEnv('DB_NAME', 'restaurant_db'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(conn => {
    console.log('MySQL connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('MySQL connection failed:', err.message);
    if (isProduction) {
      process.exit(1);
    }
  });

module.exports = pool;
