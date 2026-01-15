/**
 * Migration Runner
 * Runs all SQL migration files in order
 * 
 * Usage: npm run migrate
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { closePool } = require('./postgres');
const { createLogger } = require('../utils/logger');
const settings = require('../config/settings');

const logger = createLogger('MigrationRunner');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function parseConnStrToDiscrete(cs) {
  const u = new URL(cs);
  const dbname = (u.pathname || '').replace(/^\//, '').split('?')[0];
  const user = decodeURIComponent(u.username) || '';
  const rawPass = u.password ?? '';
  const password = String(rawPass ? decodeURIComponent(rawPass) : '')
    .replace(/[\r\n]/g, '')
    .trim();
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user,
    password,
    database: dbname
  };
}

async function runMigrations() {
  logger.info('Starting database migrations...');

  const dbCfg =
    (settings && settings.database && settings.database.pg && settings.database.pg.connectionString)
      ? (settings.database.pg || settings.database)
      : {};
  logger.info('Initial database config');

  let hardPool;

  try {
    const cs = process.env.DATABASE_URL;
    if (!cs) throw new Error('DATABASE_URL environment variable is not set');

    const disc = parseConnStrToDiscrete(cs);
    if (!disc.database) throw new Error('Empty DB name after parsing DATABASE_URL');

    const hardPoolConfig = {
      host: disc.host,
      port: disc.port,
      user: disc.user,
      password: disc.password,
      database: disc.database,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false }
    };

    logger.info('Final pool config (sanitized)', {
      usingConnectionString: false,
      host: hardPoolConfig.host,
      port: hardPoolConfig.port,
      database: hardPoolConfig.database,
      sslIsObject: !!(hardPoolConfig.ssl && typeof hardPoolConfig.ssl === 'object'),
      sslRejectUnauthorized: hardPoolConfig.ssl && hardPoolConfig.ssl.rejectUnauthorized
    });

    const { Pool } = require('pg');
    hardPool = new Pool(hardPoolConfig);

    const pgmod = require('./postgres');
    pgmod.__forcePool = hardPool;
    await pgmod.initializePool();

    const sanity = await hardPool.query('SHOW ssl');
    logger.info('SSL check', sanity.rows[0]);
    logger.info('Connected to database', sanity.rows[0]);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    }

    // Get all migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    logger.info(`Found ${files.length} migration files`);

    if (files.length === 0) {
      logger.info('No migrations to run. Exiting.');
      return;
    }

    // Run each migration file in order
    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      logger.info(`Running migration: ${file}`);

      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        // IMPORTANT: use hardPool.query here to avoid transaction issues
        await hardPool.query(sql);
        logger.info(`✓ ${file} completed`);
      } catch (err) {
        // 42P07 = duplicate_table
        // 42710 = duplicate_object (e.g. index, constraint)
        const msg = err.message || '';
        const isDuplicate =
          err.code === '42P07' ||
          err.code === '42710' ||
          /already exists/i.test(msg);

        if (isDuplicate) {
          logger.warn(`Skipping duplicate object error in ${file}`, {
            code: err.code,
            message: err.message
          });
          // keep going to next migration
          continue;
        }

        logger.error(`Migration failed in ${file}`, { error: err.message });
        throw err;
      }
    }

    logger.info('✅ All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    process.exit(1);
  } finally {
    try {
      await closePool();
    } catch {
      // ignore
    }
    if (hardPool) {
      await hardPool.end().catch(() => {});
    }
  }
}

runMigrations();
