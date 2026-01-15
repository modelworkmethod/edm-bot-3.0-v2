/**
 * Pattern Detector
 * Identifies behavioral patterns to classify user archetypes
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');

const logger = createLogger('PatternDetector');

class PatternDetector {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Detect user behavioral pattern
   */
  async detectPattern(userId) {
    try {
      const metrics = await this.gatherMetrics(userId);
      const pattern = this.classifyPattern(metrics);

      // Save pattern detection
      await this.savePattern(userId, pattern);

      logger.info('Pattern detected', {
        userId,
        pattern: pattern.type,
        confidence: pattern.confidence
      });

      return pattern;

    } catch (error) {
      logger.error('Pattern detection failed', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Gather behavioral metrics
   */
  async gatherMetrics(userId) {
    const [
      user,
      stats30d,
      activityRatio,
      reflectionRatio,
      consistency,
      courseVsAction
    ] = await Promise.all([
      this.userService.getUser(userId),
      this.getStats30d(userId),
      this.getActivityRatio(userId),
      this.getReflectionRatio(userId),
      this.getConsistencyScore(userId),
      this.getCourseVsActionRatio(userId)
    ]);

    return {
      user,
      totalStats: stats30d.total,
      approaches: stats30d.approaches,
      numbers: stats30d.numbers,
      dates: stats30d.dates,
      meditation: stats30d.meditation,
      journaling: stats30d.journaling,
      activityRatio,
      reflectionRatio,
      consistency,
      courseVsAction,
      archetype: user.archetype
    };
  }

  /**
   * Get stats from last 30 days
   */
  async getStats30d(userId) {
    const result = await queryRow(
      `SELECT 
         COUNT(*) as total,
         COALESCE(SUM((raw_stats->>'Approaches')::int), 0) as approaches,
         COALESCE(SUM((raw_stats->>'Numbers')::int), 0) as numbers,
         COALESCE(SUM((raw_stats->>'Dates Had')::int), 0) as dates,
         COALESCE(SUM((raw_stats->>'Meditation')::int), 0) as meditation,
         COALESCE(SUM((raw_stats->>'Journaling')::int), 0) as journaling
       FROM user_daily
       WHERE user_id = $1
       AND day >= CURRENT_DATE - INTERVAL '30 days'
       AND active = true`,
      [userId]
    );

    return {
      total: parseInt(result.total) || 0,
      approaches: parseInt(result.approaches) || 0,
      numbers: parseInt(result.numbers) || 0,
      dates: parseInt(result.dates) || 0,
      meditation: parseInt(result.meditation) || 0,
      journaling: parseInt(result.journaling) || 0
    };
  }

  /**
   * Activity ratio (action stats vs total)
   */
  async getActivityRatio(userId) {
    const stats = await this.getStats30d(userId);
    const actionStats = stats.approaches + stats.numbers + stats.dates;
    
    if (stats.total === 0) return 0;
    return actionStats / stats.total;
  }

  /**
   * Reflection ratio (introspective work vs total)
   */
  async getReflectionRatio(userId) {
    const stats = await this.getStats30d(userId);
    const reflectionStats = stats.meditation + stats.journaling;
    
    if (stats.total === 0) return 0;
    return reflectionStats / stats.total;
  }

  /**
   * Consistency score (submission pattern regularity)
   */
  async getConsistencyScore(userId) {
    const result = await queryRows(
      `SELECT day, active FROM user_daily
       WHERE user_id = $1
       AND day >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY day`,
      [userId]
    );

    if (result.length === 0) return 0;

    const activeCount = result.filter(r => r.active).length;
    const consistency = activeCount / 30;

    // Penalize for gaps
    let maxGap = 0;
    let currentGap = 0;

    for (const record of result) {
      if (!record.active) {
        currentGap++;
        maxGap = Math.max(maxGap, currentGap);
      } else {
        currentGap = 0;
      }
    }

    // Reduce consistency if there are large gaps
    const gapPenalty = Math.min(0.3, maxGap * 0.05);
    return Math.max(0, consistency - gapPenalty);
  }

  /**
   * Course consumption vs field action ratio
   */
  async getCourseVsActionRatio(userId) {
    const result = await queryRow(
      `SELECT 
         COALESCE(SUM(course_videos), 0) as videos,
         COALESCE(SUM(stats_submitted), 0) as actions
       FROM user_engagement_metrics
       WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '30 days'`,
      [userId]
    );

    const videos = parseInt(result.videos) || 0;
    const actions = parseInt(result.actions) || 0;

    if (actions === 0) return 999; // All theory, no action
    return videos / actions;
  }

  /**
   * Classify pattern based on metrics
   */
  classifyPattern(metrics) {
    const patterns = [
      this.checkActionJunkie(metrics),
      this.checkAnalysisParalysis(metrics),
      this.checkStreakyPerformer(metrics),
      this.checkSteadyClimber(metrics),
      this.checkAtRiskPlateau(metrics)
    ];

    // Return pattern with highest confidence
    return patterns.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Check for Action Junkie pattern
   */
  checkActionJunkie(metrics) {
    let confidence = 0;
    const evidence = [];

    // High approach count
    if (metrics.approaches > 30) {
      confidence += 30;
      evidence.push('High approach volume (30+ in 30 days)');
    }

    // Low reflection work
    if (metrics.reflectionRatio < 0.2) {
      confidence += 20;
      evidence.push('Minimal introspective work');
    }

    // Warrior archetype
    if (metrics.archetype === 'Warrior') {
      confidence += 20;
      evidence.push('Warrior archetype alignment');
    }

    // Low course engagement relative to action
    if (metrics.courseVsAction < 0.5) {
      confidence += 15;
      evidence.push('More action than learning');
    }

    // Consistent activity
    if (metrics.consistency > 0.7) {
      confidence += 15;
      evidence.push('Consistent daily action');
    }

    return {
      type: 'action_junkie',
      confidence: Math.min(100, confidence),
      evidence,
      description: 'High field action, low reflection. Needs balance.',
      coaching_notes: 'Encourage journaling and inner work. Risk of burnout without processing.'
    };
  }

  /**
   * Check for Analysis Paralysis pattern
   */
  checkAnalysisParalysis(metrics) {
    let confidence = 0;
    const evidence = [];

    // High course consumption
    if (metrics.courseVsAction > 2) {
      confidence += 35;
      evidence.push('Heavy course consumption vs field action');
    }

    // Low approach count
    if (metrics.approaches < 10) {
      confidence += 25;
      evidence.push('Low approach volume (<10 in 30 days)');
    }

    // Mage archetype
    if (metrics.archetype === 'Mage') {
      confidence += 20;
      evidence.push('Mage archetype - over-intellectualizing');
    }

    // High reflection ratio
    if (metrics.reflectionRatio > 0.6) {
      confidence += 10;
      evidence.push('High introspective work but low action');
    }

    // Consistent engagement (shows commitment, just misdirected)
    if (metrics.consistency > 0.6) {
      confidence += 10;
      evidence.push('Consistent engagement, needs redirection');
    }

    return {
      type: 'analysis_paralysis',
      confidence: Math.min(100, confidence),
      evidence,
      description: 'Overthinking, under-acting. Needs action push.',
      coaching_notes: 'Challenge to daily approaches. Stop consuming, start doing. Action cures fear.'
    };
  }

  /**
   * Check for Streaky Performer pattern
   */
  checkStreakyPerformer(metrics) {
    let confidence = 0;
    const evidence = [];

    // Moderate action but inconsistent
    if (metrics.approaches >= 15 && metrics.approaches <= 40) {
      confidence += 20;
      evidence.push('Moderate approach volume');
    }

    // Low consistency (key indicator)
    if (metrics.consistency < 0.5 && metrics.consistency > 0.2) {
      confidence += 40;
      evidence.push('Inconsistent daily engagement');
    }

    // Has done action (not paralyzed)
    if (metrics.activityRatio > 0.4) {
      confidence += 20;
      evidence.push('Capable of action when motivated');
    }

    // Total submissions moderate
    if (metrics.totalStats >= 8 && metrics.totalStats <= 20) {
      confidence += 20;
      evidence.push('Intermittent submission pattern');
    }

    return {
      type: 'streaky_performer',
      confidence: Math.min(100, confidence),
      evidence,
      description: 'Bursts of high performance, then gaps. Needs accountability.',
      coaching_notes: 'Focus on building systems and habits. Accountability partner recommended. Track triggers for drops.'
    };
  }

  /**
   * Check for Steady Climber pattern
   */
  checkSteadyClimber(metrics) {
    let confidence = 0;
    const evidence = [];

    // High consistency (key indicator)
    if (metrics.consistency > 0.7) {
      confidence += 40;
      evidence.push('Highly consistent daily submissions');
    }

    // Balanced approach
    if (metrics.activityRatio > 0.4 && metrics.reflectionRatio > 0.2) {
      confidence += 30;
      evidence.push('Balanced action and reflection');
    }

    // Templar archetype
    if (metrics.archetype === 'Templar') {
      confidence += 20;
      evidence.push('Templar archetype - balanced approach');
    }

    // Moderate course engagement
    if (metrics.courseVsAction >= 0.5 && metrics.courseVsAction <= 1.5) {
      confidence += 10;
      evidence.push('Healthy learning-to-action ratio');
    }

    return {
      type: 'steady_climber',
      confidence: Math.min(100, confidence),
      evidence,
      description: 'Consistent, balanced progress. Low intervention needed.',
      coaching_notes: 'Model student. Maintain momentum. Consider challenging with duels or advanced modules.'
    };
  }

  /**
   * Check for At-Risk Plateau pattern
   */
  checkAtRiskPlateau(metrics) {
    let confidence = 0;
    const evidence = [];

    // Low total activity
    if (metrics.totalStats < 8) {
      confidence += 30;
      evidence.push('Low submission frequency');
    }

    // Low approach count
    if (metrics.approaches < 5) {
      confidence += 25;
      evidence.push('Minimal field action');
    }

    // Poor consistency
    if (metrics.consistency < 0.3) {
      confidence += 25;
      evidence.push('Very inconsistent engagement');
    }

    // Low dates (not seeing results)
    if (metrics.dates === 0) {
      confidence += 20;
      evidence.push('No dating results visible');
    }

    return {
      type: 'at_risk_plateau',
      confidence: Math.min(100, confidence),
      evidence,
      description: 'Stalled progress, low engagement. HIGH PRIORITY intervention.',
      coaching_notes: 'URGENT: Personal 1-on-1 needed. Identify blockers. May need program reset or deep coaching session.'
    };
  }

  /**
   * Save pattern to database
   */
  async savePattern(userId, pattern) {
    await query(
      `INSERT INTO user_behavior_patterns 
       (user_id, pattern_type, confidence_score, supporting_evidence)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        pattern.type,
        pattern.confidence,
        JSON.stringify({
          evidence: pattern.evidence,
          description: pattern.description,
          coaching_notes: pattern.coaching_notes
        })
      ]
    );
  }

  /**
   * Get users by pattern type
   */
  async getUsersByPattern(patternType, minConfidence = 70) {
    return await queryRows(
      `SELECT DISTINCT ON (user_id) *
       FROM user_behavior_patterns
       WHERE pattern_type = $1
       AND confidence_score >= $2
       ORDER BY user_id, detected_at DESC`,
      [patternType, minConfidence]
    );
  }
}

module.exports = PatternDetector;

