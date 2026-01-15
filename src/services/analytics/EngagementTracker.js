/**
 * Engagement Tracker
 * Aggregates user activity metrics daily for analytics
 */

const { createLogger } = require('../../utils/logger');
const { query } = require('../../database/postgres');

const logger = createLogger('EngagementTracker');

class EngagementTracker {
  /**
   * Track stat submission
   */
  static async trackStatSubmission(userId) {
    await this.incrementMetric(userId, 'stats_submitted');
  }

  /**
   * Track chat message
   */
  static async trackChatMessage(userId, sentiment = 0) {
    await this.incrementMetric(userId, 'chat_messages');
    await this.updateSentiment(userId, sentiment);
  }

  /**
   * Track win posted
   */
  static async trackWinPosted(userId) {
    await this.incrementMetric(userId, 'wins_posted');
  }

  /**
   * Track journal entry
   */
  static async trackJournalEntry(userId) {
    await this.incrementMetric(userId, 'journal_entries');
  }

  /**
   * Track course video watched
   */
  static async trackCourseVideo(userId) {
    await this.incrementMetric(userId, 'course_videos');
  }

  /**
   * Track tensey click
   */
  static async trackTenseyClick(userId) {
    await this.incrementMetric(userId, 'tensey_clicks');
  }

  /**
   * Increment daily metric
   */
  static async incrementMetric(userId, metric) {
    try {
      await query(
        `INSERT INTO user_engagement_metrics (user_id, date, ${metric})
         VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (user_id, date)
         DO UPDATE SET ${metric} = user_engagement_metrics.${metric} + 1`,
        [userId]
      );
    } catch (error) {
      logger.error('Failed to track metric', { error: error.message, userId, metric });
    }
  }

  /**
   * Update average sentiment
   */
  static async updateSentiment(userId, sentiment) {
    try {
      // Simple moving average of sentiment
      await query(
        `UPDATE user_engagement_metrics
         SET avg_chat_sentiment = 
           CASE 
             WHEN avg_chat_sentiment IS NULL THEN $2
             ELSE (avg_chat_sentiment * 0.8 + $2 * 0.2)
           END
         WHERE user_id = $1 AND date = CURRENT_DATE`,
        [userId, sentiment]
      );
    } catch (error) {
      logger.error('Failed to update sentiment', { error: error.message });
    }
  }

  /**
   * Calculate approach-to-date ratio
   */
  static async updateApproachRatio(userId, approaches, dates) {
    if (approaches === 0) return;

    try {
      const ratio = dates / approaches;
      
      await query(
        `UPDATE user_engagement_metrics
         SET approach_to_date_ratio = $2
         WHERE user_id = $1 AND date = CURRENT_DATE`,
        [userId, ratio]
      );
    } catch (error) {
      logger.error('Failed to update approach ratio', { error: error.message });
    }
  }
}

module.exports = EngagementTracker;

