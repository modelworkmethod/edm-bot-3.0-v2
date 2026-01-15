/**
 * PostgreSQL connection pool and query wrapper
 * Handles database connections with proper error handling and logging
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { AppError, ErrorTypes } = require('../utils/errorHandler');

const logger = createLogger('Database');

let pool = null;

// ✅ NEW: prevent double-init races (multiple queries at startup, pm2 restarts, etc.)
let initPromise = null;

// ✅ NEW: keep last config so lazy init can reuse it
let lastInitConfig = null;

/**
 * Coerce potentially-wrong config values into strings safely.
 * pg expects strings for host/user/database/password/connectionString.
 */
function asString(val, fallback = '') {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') return String(val);

  // If it's an object, try common shapes
  if (typeof val === 'object') {
    // e.g. { value: '...' }
    if (typeof val.value === 'string') return val.value;

    // e.g. { connectionString: '...' }
    if (typeof val.connectionString === 'string') return val.connectionString;

    // e.g. URL instance
    if (val instanceof URL) return val.toString();

    // Last resort: stringify
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }

  return fallback;
}

/**
 * Build a pg config from settings (supports config.pg or plain config)
 */
function buildEffectivePgConfig(input = {}) {
  const cfg = (input && input.pg && typeof input.pg === 'object') ? input.pg : (input || {});

  // Allow env overrides (useful when settings is messy)
  const envConnectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PG_CONNECTION_STRING ||
    process.env.PGURL;

  // Normalize connection string
  let connectionString = cfg.connectionString ?? cfg.url ?? cfg.databaseUrl ?? cfg.postgresUrl ?? envConnectionString;

  // Sometimes config accidentally stores connectionString as an object
  connectionString = (typeof connectionString === 'string')
    ? connectionString
    : (connectionString && typeof connectionString === 'object' && typeof connectionString.connectionString === 'string')
      ? connectionString.connectionString
      : (connectionString && typeof connectionString === 'object' && typeof connectionString.url === 'string')
        ? connectionString.url
        : undefined;

  const hasUrl = typeof connectionString === 'string' && connectionString.length > 0;

  // Normalize fields (force strings to avoid pg-protocol crash)
  const host = asString(cfg.host ?? cfg.hostname ?? process.env.PGHOST ?? '', '');
  const port = Number(cfg.port ?? process.env.PGPORT ?? 5432);

  const user = asString(cfg.user ?? cfg.username ?? process.env.PGUSER ?? '', '');
  const password = asString(cfg.password ?? process.env.PGPASSWORD ?? '', '');
  const database = asString(cfg.database ?? cfg.name ?? process.env.PGDATABASE ?? '', '');

  // Decide SSL
  const urlHasSSL =
    hasUrl && /\bsslmode=(require|verify-full|verify-ca|no-verify)\b/i.test(connectionString);

  const envWantsSSL =
    process.env.DATABASE_SSL === 'true' || !!process.env.PGSSLMODE;

  const looksLikeDO = /ondigitalocean\.com$/i.test(host) || port === 25060;

  let sslNeeded;
  if (typeof cfg.ssl === 'boolean') {
    sslNeeded = cfg.ssl;
  } else if (typeof cfg.ssl === 'object' && cfg.ssl !== null) {
    sslNeeded = true;
  } else {
    sslNeeded = urlHasSSL || envWantsSSL || looksLikeDO;
  }

  // Build SSL object
  let ssl = false;
  if (sslNeeded) {
    // default to non-verified unless CA provided
    ssl = { rejectUnauthorized: false };

    const caPath =
      cfg.caCertPath ||
      cfg.sslCaPath ||
      cfg.ssl_cert_path ||
      process.env.CA_CERT_PATH;

    if (caPath) {
      try {
        const resolvedPath = path.resolve(caPath);
        if (fs.existsSync(resolvedPath)) {
          const ca = fs.readFileSync(resolvedPath, 'utf8');
          ssl = { ca, rejectUnauthorized: true };
        } else {
          logger.warn('SSL enabled but CA certificate file not found, using unverified SSL', {
            caPath: resolvedPath,
          });
        }
      } catch (err) {
        logger.warn('Error reading CA certificate file, using unverified SSL', {
          caPath,
          error: err.message,
        });
      }
    }
  }

  const basePoolOpts = {
    max: Number(cfg.max || 20),
    idleTimeoutMillis: Number(cfg.idleTimeoutMillis || 30000),
    connectionTimeoutMillis: Number(cfg.connectionTimeoutMillis || 10000),
  };

  if (hasUrl) {
    return { connectionString, ssl, ...basePoolOpts };
  }

  return { host, port, user, password, database, ssl, ...basePoolOpts };
}

/**
 * ✅ NEW: allow boot code to store config for later lazy init
 * (optional but recommended)
 */
function setInitConfig(config = {}) {
  lastInitConfig = config;
}

/**
 * ✅ NEW: ensure pool exists (lazy init)
 */
async function ensurePool() {
  if (pool) return pool;

  // If init is already in progress, wait for it
  if (initPromise) return await initPromise;

  // Build config from lastInitConfig or from env as fallback
  const fallbackConfig =
    lastInitConfig ||
    { connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_CONNECTION_STRING || process.env.PGURL } ||
    {};

  initPromise = (async () => {
    try {
      await initializePool(fallbackConfig);
      return pool;
    } finally {
      initPromise = null; // allow retry if it failed
    }
  })();

  return await initPromise;
}

/**
 * Initialize PostgreSQL connection pool
 * @param {object} config - Database configuration
 * @returns {Pool} PostgreSQL connection pool
 */
async function initializePool(config = {}) {
  if (module.exports.__forcePool) {
    pool = module.exports.__forcePool;
    return pool;
  }

  // ✅ If already initialized, reuse
  if (pool) return pool;

  // ✅ store for later lazy init
  lastInitConfig = config;

  // ✅ prevent concurrent init
  if (initPromise) return await initPromise;

  initPromise = (async () => {
    try {
      logger.info('Initializing PostgreSQL connection pool');

      const effective = buildEffectivePgConfig(config);

      // Normalize into the exact types pg expects (strings + numbers)
      let normalized = effective;

      if (effective.connectionString) {
        try {
          const u = new URL(effective.connectionString);
          const dbname = asString((u.pathname || '').replace(/^\//, '').split('?')[0], '');

          normalized = {
            host: asString(u.hostname, ''),
            port: Number(u.port || 5432),
            user: asString(decodeURIComponent(u.username || ''), ''),
            password: asString(decodeURIComponent(u.password || ''), ''),
            database: dbname,
            ssl: (effective.ssl && typeof effective.ssl === 'object') ? effective.ssl : { rejectUnauthorized: false },
            max: Number(effective.max || 20),
            idleTimeoutMillis: Number(effective.idleTimeoutMillis || 30000),
            connectionTimeoutMillis: Number(effective.connectionTimeoutMillis || 10000),
          };
        } catch (err) {
          // If URL parse fails, keep effective but still coerce string fields
          normalized = {
            ...effective,
            host: asString(effective.host, ''),
            user: asString(effective.user, ''),
            password: asString(effective.password, ''),
            database: asString(effective.database, ''),
          };
        }
      } else {
        normalized = {
          ...effective,
          host: asString(effective.host, ''),
          user: asString(effective.user, ''),
          password: asString(effective.password, ''),
          database: asString(effective.database, ''),
        };
      }

      logger.info('Effective DB config', {
        usingConnectionString: !!effective.connectionString,
        host: normalized.host,
        port: normalized.port,
        database: normalized.database,
        userPresent: !!normalized.user,
        sslType: typeof normalized.ssl,
        sslIsObject: !!normalized.ssl && typeof normalized.ssl === 'object',
        sslRejectUnauthorized: normalized.ssl && normalized.ssl.rejectUnauthorized,
        sslHasCa: !!(normalized.ssl && normalized.ssl.ca),
      });

      // Create pool
      pool = new Pool(normalized);

      // Smoke test
      const client = await pool.connect();
      try {
        const rDb = await client.query('SELECT current_database() AS db');
        const rSSL = await client.query('SHOW ssl');

        logger.info('Database connection established', {
          database: rDb.rows[0]?.db || 'unknown',
          ssl: rSSL.rows[0]?.ssl || 'off',
        });
      } finally {
        client.release();
      }

      return pool;
    } catch (error) {
      logger.error('Failed to initialize database pool', { error: error.message });
      pool = null;
      throw new AppError('Database connection failed', ErrorTypes.DATABASE, {
        originalError: error.message,
      });
    } finally {
      initPromise = null;
    }
  })();

  return await initPromise;
}

/**
 * Get the database pool instance
 * @returns {Pool} PostgreSQL connection pool
 * @throws {AppError} If pool is not initialized
 */
function getPool() {
  if (!pool) {
    throw new AppError('Database pool not initialized', ErrorTypes.DATABASE);
  }
  return pool;
}

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function query(text, params = []) {
  const start = Date.now();

  try {
    // ✅ change: lazy init (prevents "pool not initialized")
    const p = await ensurePool();

    const result = await p.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      duration: `${duration}ms`,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    logger.error('Query failed', {
      error: error.message,
      query: String(text || '').substring(0, 100),
    });
    throw new AppError('Database query failed', ErrorTypes.DATABASE, {
      originalError: error.message,
      query: String(text || '').substring(0, 100),
    });
  }
}

/**
 * Execute a query and return only rows
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Array of rows
 */
async function queryRows(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Execute a query and return first row
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<object|null>} First row or null
 */
async function queryRow(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a transaction
 * @param {Function} callback - Async callback function that receives client
 * @returns {Promise<*>} Result of callback
 */
async function transaction(callback) {
  // ✅ change: lazy init
  const p = await ensurePool();
  const client = await p.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction failed', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the database pool
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

module.exports = {
  initializePool,
  getPool,
  query,
  queryRows,
  queryRow,
  transaction,
  closePool,

  // ✅ NEW export (optional use)
  setInitConfig,
};
