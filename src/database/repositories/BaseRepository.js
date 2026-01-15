/**
 * Base repository class
 * Provides common database operations for all repositories
 */

const { query, queryRows, queryRow, transaction } = require('../postgres');
const { createLogger } = require('../../utils/logger');
const { AppError, ErrorTypes } = require('../../utils/errorHandler');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.logger = createLogger(`${tableName}Repository`);
  }

  /**
   * Find record by primary key
   * @param {string} id - Primary key value
   * @param {string} pkColumn - Primary key column name (default: 'id')
   * @returns {Promise<object|null>} Record or null
   */
  async findById(id, pkColumn = 'id') {
    try {
      return await queryRow(
        `SELECT * FROM ${this.tableName} WHERE ${pkColumn} = $1`,
        [id]
      );
    } catch (error) {
      this.logger.error(`Failed to find by ${pkColumn}`, { id, error: error.message });
      throw error;
    }
  }

  /**
   * Find all records matching criteria
   * @param {object} where - Where clause object
   * @param {object} options - Query options (orderBy, limit, offset)
   * @returns {Promise<Array>} Array of records
   */
  async findAll(where = {}, options = {}) {
    try {
      const whereClauses = [];
      const params = [];
      let paramIndex = 1;

      // Build WHERE clause
      for (const [key, value] of Object.entries(where)) {
        whereClauses.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const orderSQL = options.orderBy ? `ORDER BY ${options.orderBy}` : '';
      const limitSQL = options.limit ? `LIMIT ${parseInt(options.limit)}` : '';
      const offsetSQL = options.offset ? `OFFSET ${parseInt(options.offset)}` : '';

      return await queryRows(
        `SELECT * FROM ${this.tableName} ${whereSQL} ${orderSQL} ${limitSQL} ${offsetSQL}`,
        params
      );
    } catch (error) {
      this.logger.error('Failed to find all', { where, error: error.message });
      throw error;
    }
  }

  /**
   * Create new record
   * @param {object} data - Record data
   * @returns {Promise<object>} Created record
   */
  async create(data) {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const result = await queryRow(
        `INSERT INTO ${this.tableName} (${keys.join(', ')}) 
         VALUES (${placeholders}) 
         RETURNING *`,
        values
      );

      this.logger.debug('Record created', { table: this.tableName });
      return result;
    } catch (error) {
      this.logger.error('Failed to create', { error: error.message });
      throw error;
    }
  }

  /**
   * Update record by primary key
   * @param {string} id - Primary key value
   * @param {object} data - Data to update
   * @param {string} pkColumn - Primary key column name
   * @returns {Promise<object>} Updated record
   */
  async update(id, data, pkColumn = 'id') {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClauses = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

      const result = await queryRow(
        `UPDATE ${this.tableName} 
         SET ${setClauses}, updated_at = NOW() 
         WHERE ${pkColumn} = $${keys.length + 1} 
         RETURNING *`,
        [...values, id]
      );

      this.logger.debug('Record updated', { table: this.tableName, id });
      return result;
    } catch (error) {
      this.logger.error('Failed to update', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete record by primary key
   * @param {string} id - Primary key value
   * @param {string} pkColumn - Primary key column name
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id, pkColumn = 'id') {
    try {
      const result = await query(
        `DELETE FROM ${this.tableName} WHERE ${pkColumn} = $1`,
        [id]
      );
      
      this.logger.debug('Record deleted', { table: this.tableName, id });
      return result.rowCount > 0;
    } catch (error) {
      this.logger.error('Failed to delete', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Execute raw query (use sparingly)
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<object>} Query result
   */
  async raw(sql, params = []) {
    return await query(sql, params);
  }

  /**
   * Count records matching criteria
   * @param {object} where - Where clause object
   * @returns {Promise<number>} Count
   */
  async count(where = {}) {
    try {
      const whereClauses = [];
      const params = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(where)) {
        whereClauses.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const result = await queryRow(
        `SELECT COUNT(*) as count FROM ${this.tableName} ${whereSQL}`,
        params
      );

      return parseInt(result.count);
    } catch (error) {
      this.logger.error('Failed to count', { where, error: error.message });
      throw error;
    }
  }
}

module.exports = BaseRepository;

