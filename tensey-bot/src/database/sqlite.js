const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const config = require('../config/environment');
const logger = require('../utils/logger');

let db = null;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  /**
   * Initialize SQLite database (async API)
   */
  async initialize(pathOverride) {
    try {
      const sqlitePath = pathOverride || config.SQLITE_PATH;
      if (!sqlitePath) {
        throw new Error('Missing SQLITE_PATH (check tensey-bot/src/config/environment.js)');
      }

      // Ensure data directory exists
      const dataDir = path.dirname(sqlitePath);
      ensureDir(dataDir);

      // Open database
      db = new Database(sqlitePath);
      db.pragma('journal_mode = WAL');

      // Run migrations (safe)
      await this._runMigrations();

      logger.info('SQLite initialized:', sqlitePath);
      return db;
    } catch (err) {
      logger.error('Failed to initialize SQLite:', err?.message || err);
      throw err;
    }
  },

  /**
   * Sync-friendly alias used by some codebases
   * (internally calls initialize)
   */
  init(pathOverride) {
    return this.initialize(pathOverride);
  },

  /**
   * Get database instance
   */
  get() {
    if (!db) throw new Error('SQLite not initialized');
    return db;
  },

  /**
   * Close database
   */
  close() {
    if (db) {
      try {
        db.close();
      } finally {
        db = null;
      }
      logger.info('SQLite closed');
    }
  },

  /**
   * Run migrations
   * @private
   */
  async _runMigrations() {
    const migrationsDir = path.join(__dirname, 'migrations');

    // If no migrations folder, just skip (don’t crash)
    if (!fs.existsSync(migrationsDir)) {
      logger.warn('SQLite migrations dir not found, skipping', { migrationsDir });
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Create migrations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const file of files) {
      const applied = db.prepare('SELECT 1 FROM migrations WHERE filename = ?').get(file);
      if (applied) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
      db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file);

      logger.info(`Applied migration: ${file}`);
    }
  },
};
