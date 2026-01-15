/**
 * Barbie List Manager (UPDATED)
 * Now awards XP for contact management
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');

const logger = createLogger('BarbieListManager');

class BarbieListManager {
  constructor(secondaryXPProcessor = null) {
    this.secondaryXPProcessor = secondaryXPProcessor;
  }

  /**
   * Add contact to list (NOW WITH XP)
   */
  async addContact(userId, contactData) {
    const {
      name,
      metLocation,
      metDate,
      phoneNumber,
      instagramHandle,
      instagramUrl,
      notes,
      vibeRating,
      tags = [],
      isPrivate = false
    } = contactData;

    const result = await queryRow(
      `INSERT INTO barbie_list 
       (user_id, contact_name, met_location, met_date, phone_number, instagram_handle, instagram_url, notes, vibe_rating, tags, is_private)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [userId, name, metLocation, metDate, phoneNumber, instagramHandle, instagramUrl, notes, vibeRating, tags, isPrivate]
    );

    logger.info('Contact added', { userId, contactId: result.id, name });

    // Award XP for adding contact
    let xpResult = null;
    if (this.secondaryXPProcessor) {
      xpResult = await this.secondaryXPProcessor.awardSecondaryXP(
        userId,
        'barbie',
        'addContact',
        { contactName: name, vibeRating }
      );

      // Bonus XP for perfect vibe rating
      if (vibeRating >= 9 && xpResult.success) {
        await this.secondaryXPProcessor.awardSecondaryXP(
          userId,
          'barbie',
          'perfectVibe',
          { contactName: name, vibeRating }
        );
      }
    }

    return {
      contact: result,
      xpAwarded: xpResult?.xp || 0
    };
  }

  /**
   * Add interaction (NOW WITH XP FOR FOLLOW-UPS)
   */
  async addInteraction(barbieId, userId, interactionData) {
    const { type, content, sentiment } = interactionData;

    const result = await queryRow(
      `INSERT INTO barbie_interactions (barbie_id, user_id, interaction_type, content, sentiment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [barbieId, userId, type, content, sentiment]
    );

    // Update last_contacted if it's an outgoing message
    if (type === 'text_sent' || type === 'call') {
      await query(
        `UPDATE barbie_list SET last_contacted = NOW() WHERE id = $1`,
        [barbieId]
      );

      // Award XP for logging follow-up
      if (this.secondaryXPProcessor) {
        await this.secondaryXPProcessor.awardSecondaryXP(
          userId,
          'barbie',
          'logFollowup',
          { interactionType: type }
        );
      }
    }

    // Award bonus XP if logging a date
    if (type === 'date' && this.secondaryXPProcessor) {
      await this.secondaryXPProcessor.awardSecondaryXP(
        userId,
        'barbie',
        'updateWithDate',
        { interactionType: type }
      );
    }

    return result;
  }

  // ... rest of existing methods unchanged ...
  
  async getUserContacts(userId, filters = {}) {
    const { tag, minVibeRating, sortBy = 'created_at' } = filters;

    let whereClause = 'WHERE user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (tag) {
      whereClause += ` AND $${paramIndex} = ANY(tags)`;
      params.push(tag);
      paramIndex++;
    }

    if (minVibeRating) {
      whereClause += ` AND vibe_rating >= $${paramIndex}`;
      params.push(minVibeRating);
      paramIndex++;
    }

    const orderBy = sortBy === 'vibe' ? 'vibe_rating DESC' : 'created_at DESC';

    return await queryRows(
      `SELECT * FROM barbie_list 
       ${whereClause}
       ORDER BY ${orderBy}`,
      params
    );
  }

  async getContact(contactId, userId) {
    return await queryRow(
      'SELECT * FROM barbie_list WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );
  }

  async updateContact(contactId, userId, updates) {
    const allowedFields = [
      'contact_name', 'met_location', 'met_date', 'phone_number',
      'instagram_handle', 'instagram_url', 'notes', 'vibe_rating', 
      'last_contacted', 'next_action', 'tags', 'is_private',
      'ai_ig_summary', 'ai_ig_openers', 'instagram_last_checked'
    ];

    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        fields.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(contactId, userId);

    return await queryRow(
      `UPDATE barbie_list 
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );
  }

  async deleteContact(contactId, userId) {
    const result = await query(
      'DELETE FROM barbie_list WHERE id = $1 AND user_id = $2',
      [contactId, userId]
    );
    return result.rowCount > 0;
  }

  async getInteractionHistory(barbieId, userId, limit = 20) {
    return await queryRows(
      `SELECT * FROM barbie_interactions 
       WHERE barbie_id = $1 AND user_id = $2 
       ORDER BY created_at DESC 
       LIMIT $3`,
      [barbieId, userId, limit]
    );
  }

  async generateOpener(contactData) {
    const { met_location, notes, vibe_rating } = contactData;

    const templates = [
      `Hey! It was great meeting you at ${met_location || 'the other day'}. How's your week going?`,
      `Random thought: ${notes ? 'remembered you mentioned something about...' : 'been thinking about our conversation'}`,
      `Yo! That ${met_location || 'place'} we met at keeps popping up in my mind. Ever been back?`
    ];

    return {
      suggestions: templates,
      note: 'AI suggestions coming soon - for now, use these templates as inspiration'
    };
  }

  async getFollowUpReminders(userId, daysSince = 3) {
    return await queryRows(
      `SELECT * FROM barbie_list 
       WHERE user_id = $1 
       AND (last_contacted IS NULL OR last_contacted < NOW() - INTERVAL '${daysSince} days')
       AND next_action IS NOT NULL
       ORDER BY vibe_rating DESC NULLS LAST`,
      [userId]
    );
  }

  /**
   * Update Instagram AI analysis data
   */
  async updateInstagramAnalysis(contactId, userId, analysisData) {
    const { summary, openers } = analysisData;
    
    return await queryRow(
      `UPDATE barbie_list 
       SET ai_ig_summary = $1, ai_ig_openers = $2, instagram_last_checked = NOW(), updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [summary, openers, contactId, userId]
    );
  }

  /**
   * Get contacts with Instagram handles for analysis
   */
  async getContactsWithInstagram(userId, limit = 50) {
    return await queryRows(
      `SELECT * FROM barbie_list 
       WHERE user_id = $1 
       AND instagram_handle IS NOT NULL 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
  }

  /**
   * Add Instagram media (screenshots) to a contact
   * @param {object} params - Media parameters
   * @param {number} params.contactId - Contact ID
   * @param {string} params.uploaderUserId - User ID who uploaded
   * @param {string} params.messageId - Discord message ID (optional)
   * @param {Array} params.items - Array of media items [{attachment_url, caption, width, height}]
   * @returns {Array} Inserted media records
   */
  async addInstagramMedia({ contactId, uploaderUserId, messageId = null, items }) {
    if (!items || items.length === 0) {
      return [];
    }

    const results = [];

    for (const item of items) {
      const { attachment_url, caption = null, width = null, height = null } = item;

      const result = await queryRow(
        `INSERT INTO barbie_instagram_media 
         (contact_id, uploader_user_id, message_id, attachment_url, caption, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [contactId, uploaderUserId, messageId, attachment_url, caption, width, height]
      );

      results.push(result);
    }

    logger.info('Instagram media added', {
      contactId,
      uploaderUserId,
      count: results.length
    });

    return results;
  }

  /**
   * Get Instagram media for a contact
   * @param {number} contactId - Contact ID
   * @param {number} limit - Maximum number of media items to return
   * @returns {Array} Media records
   */
  async getInstagramMedia(contactId, limit = 8) {
    return await queryRows(
      `SELECT * FROM barbie_instagram_media 
       WHERE contact_id = $1 
       ORDER BY uploaded_at DESC 
       LIMIT $2`,
      [contactId, limit]
    );
  }

  /**
   * Get media count for a contact
   * @param {number} contactId - Contact ID
   * @returns {number} Count of media items
   */
  async getInstagramMediaCount(contactId) {
    const result = await queryRow(
      `SELECT COUNT(*)::int as count FROM barbie_instagram_media WHERE contact_id = $1`,
      [contactId]
    );
    return result?.count || 0;
  }

  /**
   * Update Instagram vision analysis results
   * @param {number} contactId - Contact ID
   * @param {string} userId - User ID
   * @param {object} analysisData - Analysis data
   * @param {string} analysisData.summary - Analysis summary
   * @param {Array} analysisData.openers - Opener suggestions
   * @returns {object} Updated contact
   */
  async updateInstagramVision(contactId, userId, analysisData) {
    const { summary, openers } = analysisData;
    
    return await queryRow(
      `UPDATE barbie_list 
       SET ai_ig_summary = $1, ai_ig_openers = $2, instagram_last_checked = NOW(), updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [summary, openers, contactId, userId]
    );
  }

  /**
   * Delete Instagram media by ID
   * @param {number} mediaId - Media ID
   * @param {string} uploaderUserId - User ID who uploaded (for permission check)
   * @returns {boolean} True if deleted
   */
  async deleteInstagramMedia(mediaId, uploaderUserId) {
    const result = await query(
      `DELETE FROM barbie_instagram_media 
       WHERE id = $1 AND uploader_user_id = $2`,
      [mediaId, uploaderUserId]
    );
    return result.rowCount > 0;
  }
}

module.exports = BarbieListManager;

