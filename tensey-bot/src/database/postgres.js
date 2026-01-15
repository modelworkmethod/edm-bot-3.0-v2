// tensey-bot/src/database/postgres.js
const { Pool } = require('pg');
const config = require('../config/environment');
const logger = require('../utils/logger');

const poolConfig = {
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,

  // DO Managed PostgreSQL requiere SSL
  ssl: {
    rejectUnauthorized: false, 
  },
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err);
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as now');
    logger.info('PostgreSQL connection successful', { now: result.rows[0].now });
    return true;
  } catch (err) {
    logger.error('PostgreSQL connection failed', err);
    throw err;
  }
}

async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error('Query failed', { text, params, err: err.message });
    throw err;
  }
}

async function getClient() {
  return await pool.connect();
}

async function close() {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}

module.exports = {
  testConnection,
  query,
  getClient,
  close,
  pool,
};
