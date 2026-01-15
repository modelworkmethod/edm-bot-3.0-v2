/**
 * Risk Scorer
 * Rule-based client risk assessment
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');

const logger = createLogger('RiskScorer');

class RiskScorer {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Calculate comprehensive risk score for user
   */
  async calculateRiskScore(userId) {
    try {
      const user = await this.userService.getUser(userId);
      if (!user) return null;

      const factors = {
        inactivity: await this.scoreInactivity(userId),
        streakBreaks: await this.scoreStreakBreaks(userId),
        xpVelocity: await this.scoreXPVelocity(userId),
        chatActivity: await this.scoreChatActivity(userId),
        winsParticipation: await this.scoreWinsParticipation(userId),
        courseEngagement: await this.scoreCourseEngagement(userId)
      };

      // Weighted risk calculation
      const riskScore = Math.round(
        factors.inactivity * 0.30 +      // 30% weight - most critical
        factors.streakBreaks * 0.20 +    // 20% weight
        factors.xpVelocity * 0.20 +      // 20% weight
        factors.chatActivity * 0.10 +    // 10% weight
        factors.winsParticipation * 0.10 + // 10% weight
        factors.courseEngagement * 0.10   // 10% weight
      );

      const riskTier = this.getRiskTier(riskScore);
      const insight = this.generateInsight(factors, riskScore);

      // Save assessment
      await this.saveRiskScore(userId, riskScore, riskTier, factors, insight);

      logger.info('Risk score calculated', {
        userId,
        riskScore,
        riskTier,
        primaryConcern: insight.primaryConcern
      });

      return {
        userId,
        riskScore,
        riskTier,
        factors,
        ...insight
      };

    } catch (error) {
      logger.error('Risk calculation failed', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Score inactivity (days since last submission)
   */
  async scoreInactivity(userId) {
    const user = await this.userService.getUser(userId);
    if (!user.last_submission) return 100; // Never submitted

    const daysSince = Math.floor(
      (Date.now() - new Date(user.last_submission).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Risk increases exponentially with inactivity
    if (daysSince === 0) return 0;
    if (daysSince === 1) return 5;
    if (daysSince === 2) return 15;
    if (daysSince === 3) return 30;
    if (daysSince <= 5) return 50;
    if (daysSince <= 7) return 70;
    if (daysSince <= 14) return 85;
    return 100; // 14+ days = critical

  }

  /**
   * Score streak breaks in last 30 days
   */
  async scoreStreakBreaks(userId) {
    const result = await queryRow(
      `SELECT COUNT(*) as breaks
       FROM user_daily
       WHERE user_id = $1
       AND day >= CURRENT_DATE - INTERVAL '30 days'
       AND active = false`,
      [userId]
    );

    const breaks = parseInt(result.breaks);

    // More breaks = higher risk
    if (breaks === 0) return 0;
    if (breaks <= 2) return 10;
    if (breaks <= 5) return 25;
    if (breaks <= 10) return 50;
    if (breaks <= 15) return 75;
    return 100; // 15+ breaks in 30 days
  }

  /**
   * Score XP velocity trend
   */
  async scoreXPVelocity(userId) {
    // Get XP from last 7 days vs previous 7 days
    const recent = await queryRow(
      `SELECT COALESCE(SUM(xp_earned), 0) as xp
       FROM user_daily
       WHERE user_id = $1
       AND day >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    const previous = await queryRow(
      `SELECT COALESCE(SUM(xp_earned), 0) as xp
       FROM user_daily
       WHERE user_id = $1
       AND day >= CURRENT_DATE - INTERVAL '14 days'
       AND day < CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    const recentXP = parseInt(recent.xp);
    const previousXP = parseInt(previous.xp);

    if (previousXP === 0) return 50; // No baseline

    const ratio = recentXP / previousXP;

    // Declining velocity = risk
    if (ratio >= 1.2) return 0;   // Accelerating
    if (ratio >= 0.9) return 20;  // Stable
    if (ratio >= 0.7) return 40;  // Slight decline
    if (ratio >= 0.5) return 60;  // Declining
    if (ratio >= 0.3) return 80;  // Sharp decline
    return 100; // Collapsed
  }

  /**
   * Score chat activity
   */
  async scoreChatActivity(userId) {
    // Count messages in last 7 days
    const result = await queryRow(
      `SELECT COUNT(*) as messages
       FROM user_engagement_metrics
       WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    const messages = parseInt(result.messages) || 0;

    // Active chat = low risk
    if (messages >= 20) return 0;
    if (messages >= 10) return 20;
    if (messages >= 5) return 40;
    if (messages >= 2) return 60;
    if (messages === 1) return 80;
    return 100; // Silent
  }

  /**
   * Score wins participation
   */
  async scoreWinsParticipation(userId) {
    const result = await queryRow(
      `SELECT COUNT(*) as wins
       FROM user_engagement_metrics
       WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '30 days'`,
      [userId]
    );

    const wins = parseInt(result.wins) || 0;

    // Sharing wins = engaged
    if (wins >= 8) return 0;   // 2+ per week
    if (wins >= 4) return 20;  // 1 per week
    if (wins >= 2) return 40;  // Biweekly
    if (wins === 1) return 70;
    return 100; // No wins shared
  }

  /**
   * Score course engagement
   */
  async scoreCourseEngagement(userId) {
    const result = await queryRow(
      `SELECT COUNT(*) as videos
       FROM user_engagement_metrics
       WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '30 days'`,
      [userId]
    );

    const videos = parseInt(result.videos) || 0;

    // Course engagement shows commitment
    if (videos >= 12) return 0;  // 3+ per week
    if (videos >= 6) return 25;  // 1.5 per week
    if (videos >= 3) return 50;  // Weekly
    if (videos >= 1) return 75;
    return 100; // No course activity
  }

  /**
   * Determine risk tier
   */
  getRiskTier(score) {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Generate actionable insight
   */
  generateInsight(factors, riskScore) {
    // Find primary concern (highest risk factor)
    const concerns = Object.entries(factors)
      .sort((a, b) => b[1] - a[1]);

    const primaryFactor = concerns[0][0];
    const primaryScore = concerns[0][1];

    const insights = {
      inactivity: {
        concern: 'User has stopped submitting stats',
        action: 'Send reengagement message',
        urgency: 5
      },
      streakBreaks: {
        concern: 'Inconsistent engagement pattern',
        action: 'Accountability check-in',
        urgency: 3
      },
      xpVelocity: {
        concern: 'Declining XP velocity',
        action: 'Motivational boost needed',
        urgency: 4
      },
      chatActivity: {
        concern: 'Withdrawn from community',
        action: 'Personal outreach',
        urgency: 3
      },
      winsParticipation: {
        concern: 'Not celebrating wins',
        action: 'Encourage win sharing',
        urgency: 2
      },
      courseEngagement: {
        concern: 'Not consuming content',
        action: 'Resource recommendation',
        urgency: 2
      }
    };

    const insight = insights[primaryFactor] || {
      concern: 'General engagement decline',
      action: 'Check-in needed',
      urgency: 3
    };

    return {
      primaryConcern: insight.concern,
      recommendedAction: insight.action,
      urgencyLevel: Math.min(5, Math.ceil(riskScore / 20))
    };
  }

  /**
   * Save risk score to database
   */
  async saveRiskScore(userId, riskScore, riskTier, factors, insight) {
    const daysSince = await this.getDaysSinceSubmission(userId);

    await query(
      `INSERT INTO user_risk_scores 
       (user_id, risk_score, risk_tier, days_since_submission, 
        streak_breaks_30d, xp_velocity_trend, chat_activity_score,
        wins_participation_score, course_engagement_score,
        primary_concern, recommended_action, urgency_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        userId,
        riskScore,
        riskTier,
        daysSince,
        await this.getStreakBreaks(userId),
        await this.getVelocityTrend(userId),
        100 - factors.chatActivity,
        100 - factors.winsParticipation,
        100 - factors.courseEngagement,
        insight.primaryConcern,
        insight.recommendedAction,
        insight.urgencyLevel
      ]
    );
  }

  /**
   * Get days since last submission
   */
  async getDaysSinceSubmission(userId) {
    const user = await this.userService.getUser(userId);
    if (!user.last_submission) return 999;

    return Math.floor(
      (Date.now() - new Date(user.last_submission).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  /**
   * Get streak breaks count
   */
  async getStreakBreaks(userId) {
    const result = await queryRow(
      `SELECT COUNT(*) as breaks
       FROM user_daily
       WHERE user_id = $1
       AND day >= CURRENT_DATE - INTERVAL '30 days'
       AND active = false`,
      [userId]
    );

    return parseInt(result.breaks) || 0;
  }

  /**
   * Get velocity trend
   */
  async getVelocityTrend(userId) {
    const recent = await queryRow(
      `SELECT COALESCE(SUM(xp_earned), 0) as xp
       FROM user_daily
       WHERE user_id = $1
       AND day >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    const previous = await queryRow(
      `SELECT COALESCE(SUM(xp_earned), 0) as xp
       FROM user_daily
       WHERE user_id = $1
       AND day >= CURRENT_DATE - INTERVAL '14 days'
       AND day < CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    const recentXP = parseInt(recent.xp);
    const previousXP = parseInt(previous.xp);

    if (previousXP === 0) return 'unknown';

    const ratio = recentXP / previousXP;

    if (ratio >= 1.1) return 'increasing';
    if (ratio >= 0.9) return 'stable';
    return 'declining';
  }

  /**
   * Get at-risk users
   */
  async getAtRiskUsers(minRiskScore = 50, limit = 50) {
    return await queryRows(
      `SELECT * FROM user_risk_scores
       WHERE risk_score >= $1
       AND calculated_at >= NOW() - INTERVAL '24 hours'
       ORDER BY risk_score DESC, urgency_level DESC
       LIMIT $2`,
      [minRiskScore, limit]
    );
  }

  /**
   * Bulk calculate all users (run daily via cron)
   */
  async calculateAllUsers() {
    const users = await queryRows(`SELECT user_id FROM users`);
    let calculated = 0;

    for (const user of users) {
      await this.calculateRiskScore(user.user_id);
      calculated++;
    }

    logger.info('Bulk risk calculation complete', { usersProcessed: calculated });
    return calculated;
  }
}

module.exports = RiskScorer;

