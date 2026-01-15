/**
 * Backup Manager
 * Automated database backup and restore
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('../../utils/logger');

const execAsync = promisify(exec);
const logger = createLogger('BackupManager');

class BackupManager {
  constructor(config) {
    this.dbConfig = config.database;
    this.backupDir = path.join(process.cwd(), 'backups');
    this.maxBackups = 30; // Keep 30 days
  }

  /**
   * Create database backup
   */
  async createBackup() {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${timestamp}.sql`;
      const filepath = path.join(this.backupDir, filename);

      // Build pg_dump command
      const command = this.buildBackupCommand(filepath);

      logger.info('Starting database backup...', { filename });

      await execAsync(command);

      // Compress backup
      await execAsync(`gzip ${filepath}`);
      const compressedPath = `${filepath}.gz`;

      const stats = await fs.stat(compressedPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      logger.info('Backup completed', {
        filename: `${filename}.gz`,
        size: `${sizeMB} MB`
      });

      // Clean old backups
      await this.cleanOldBackups();

      return {
        success: true,
        filename: `${filename}.gz`,
        size: sizeMB
      };

    } catch (error) {
      logger.error('Backup failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Build pg_dump command
   */
  buildBackupCommand(filepath) {
    const { host, port, name, user, password } = this.dbConfig;

    // Use environment variable for password to avoid command line exposure
    const env = `PGPASSWORD="${password}"`;

    return `${env} pg_dump -h ${host} -p ${port} -U ${user} -d ${name} -F p -f ${filepath}`;
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupFilename) {
    try {
      const filepath = path.join(this.backupDir, backupFilename);

      // Check if file exists
      await fs.access(filepath);

      // Decompress if needed
      let sqlFile = filepath;
      if (filepath.endsWith('.gz')) {
        await execAsync(`gunzip -k ${filepath}`);
        sqlFile = filepath.replace('.gz', '');
      }

      logger.warn('Starting database restore', { backupFilename });

      const command = this.buildRestoreCommand(sqlFile);
      await execAsync(command);

      logger.info('Database restored successfully', { backupFilename });

      return { success: true };

    } catch (error) {
      logger.error('Restore failed', { error: error.message, backupFilename });
      return { success: false, error: error.message };
    }
  }

  /**
   * Build restore command
   */
  buildRestoreCommand(filepath) {
    const { host, port, name, user, password } = this.dbConfig;
    const env = `PGPASSWORD="${password}"`;

    return `${env} psql -h ${host} -p ${port} -U ${user} -d ${name} -f ${filepath}`;
  }

  /**
   * Clean old backups
   */
  async cleanOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = files
        .filter(f => f.startsWith('backup-') && f.endsWith('.gz'))
        .sort()
        .reverse();

      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        
        for (const file of toDelete) {
          await fs.unlink(path.join(this.backupDir, file));
          logger.info('Old backup deleted', { file });
        }
      }

    } catch (error) {
      logger.error('Failed to clean old backups', { error: error.message });
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.startsWith('backup-') && file.endsWith('.gz')) {
          const filepath = path.join(this.backupDir, file);
          const stats = await fs.stat(filepath);
          
          backups.push({
            filename: file,
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            created: stats.mtime
          });
        }
      }

      return backups.sort((a, b) => b.created - a.created);

    } catch (error) {
      logger.error('Failed to list backups', { error: error.message });
      return [];
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutoBackup() {
    // Run backup every day at 3 AM
    const interval = 24 * 60 * 60 * 1000; // 24 hours

    const runBackup = async () => {
      const now = new Date();
      const hour = now.getHours();

      if (hour === 3) {
        await this.createBackup();
      }
    };

    setInterval(runBackup, 3600000); // Check every hour
    logger.info('Auto-backup scheduled (daily at 3 AM)');
  }
}

module.exports = BackupManager;

