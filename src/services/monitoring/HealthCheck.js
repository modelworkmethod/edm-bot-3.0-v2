/**
 * Health Check Service
 * Monitor bot health and database connectivity
 */

const { createLogger } = require('../../utils/logger');
const { query } = require('../../database/postgres');

const logger = createLogger('HealthCheck');

class HealthCheck {
  constructor(client) {
    this.client = client;
    this.lastCheck = null;
    this.status = {
      healthy: false,
      discord: false,
      database: false,
      uptime: 0,
      lastError: null
    };
  }

  /**
   * Run comprehensive health check
   */
  async check() {
    const results = {
      timestamp: new Date().toISOString(),
      discord: await this.checkDiscord(),
      database: await this.checkDatabase(),
      memory: this.checkMemory(),
      uptime: process.uptime()
    };

    this.status = {
      healthy: results.discord && results.database,
      discord: results.discord,
      database: results.database,
      uptime: results.uptime,
      lastError: null
    };

    this.lastCheck = new Date();

    if (!this.status.healthy) {
      logger.error('Health check failed', results);
    }

    return results;
  }

  /**
   * Check Discord connection
   */
  async checkDiscord() {
    try {
      if (!this.client.isReady()) {
        return false;
      }

      // Try to fetch bot user
      await this.client.user.fetch();
      return true;

    } catch (error) {
      logger.error('Discord health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Check database connection
   */
  async checkDatabase() {
    try {
      const result = await query('SELECT NOW() as time');
      return result.rows.length > 0;

    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      this.status.lastError = error.message;
      return false;
    }
  }

  /**
   * Check memory usage
   */
  checkMemory() {
    const used = process.memoryUsage();
    
    return {
      heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
      rss: Math.round(used.rss / 1024 / 1024) + ' MB',
      external: Math.round(used.external / 1024 / 1024) + ' MB'
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      ...this.status,
      lastCheck: this.lastCheck,
      memory: this.checkMemory()
    };
  }

  /**
   * Schedule periodic health checks
   */
  scheduleChecks(intervalMinutes = 5) {
    setInterval(async () => {
      await this.check();
    }, intervalMinutes * 60 * 1000);

    logger.info('Health checks scheduled', { intervalMinutes });
  }
}

module.exports = HealthCheck;

