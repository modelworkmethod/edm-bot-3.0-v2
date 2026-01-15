/**
 * Progress Tracker
 * Tracks all user metrics and computes aggregations
 */

const { query, queryRow, queryRows } = require('../../database/postgres');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('ProgressTracker');

class ProgressTracker {
  /**
   * Record daily metrics (called from /submit-stats or automatically)
   */
  async recordDailyMetrics(userId, data) {
    try {
      const date = data.date || new Date().toISOString().split('T')[0];

      await query(
        `INSERT INTO daily_metrics 
         (user_id, date, approaches_count, numbers_collected, conversations_count,
          dates_count, closes_count, second_dates, approach_quality_avg,
          conversation_quality_avg, date_quality_avg, number_response_rate,
          date_conversion_rate, close_rate, morning_state, afternoon_state,
          evening_state, daily_avg_state, energy_level, confidence_level,
          anxiety_level, meditation_completed, meditation_duration_mins,
          workout_completed, stats_submitted, journal_completed, wins, struggles, insights)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
         ON CONFLICT (user_id, date) DO UPDATE SET
           approaches_count = EXCLUDED.approaches_count,
           numbers_collected = EXCLUDED.numbers_collected,
           conversations_count = EXCLUDED.conversations_count,
           dates_count = EXCLUDED.dates_count,
           closes_count = EXCLUDED.closes_count,
           second_dates = EXCLUDED.second_dates,
           approach_quality_avg = EXCLUDED.approach_quality_avg,
           conversation_quality_avg = EXCLUDED.conversation_quality_avg,
           date_quality_avg = EXCLUDED.date_quality_avg,
           number_response_rate = EXCLUDED.number_response_rate,
           date_conversion_rate = EXCLUDED.date_conversion_rate,
           close_rate = EXCLUDED.close_rate,
           morning_state = EXCLUDED.morning_state,
           afternoon_state = EXCLUDED.afternoon_state,
           evening_state = EXCLUDED.evening_state,
           daily_avg_state = EXCLUDED.daily_avg_state,
           energy_level = EXCLUDED.energy_level,
           confidence_level = EXCLUDED.confidence_level,
           anxiety_level = EXCLUDED.anxiety_level,
           meditation_completed = EXCLUDED.meditation_completed,
           meditation_duration_mins = EXCLUDED.meditation_duration_mins,
           workout_completed = EXCLUDED.workout_completed,
           stats_submitted = EXCLUDED.stats_submitted,
           journal_completed = EXCLUDED.journal_completed,
           wins = EXCLUDED.wins,
           struggles = EXCLUDED.struggles,
           insights = EXCLUDED.insights,
           updated_at = NOW()`,
        [
          userId, date,
          data.approachesCount || 0,
          data.numbersCollected || 0,
          data.conversationsCount || 0,
          data.datesCount || 0,
          data.closesCount || 0,
          data.secondDates || 0,
          data.approachQuality || null,
          data.conversationQuality || null,
          data.dateQuality || null,
          data.numberResponseRate || null,
          data.dateConversionRate || null,
          data.closeRate || null,
          data.morningState || null,
          data.afternoonState || null,
          data.eveningState || null,
          data.dailyAvgState || null,
          data.energyLevel || null,
          data.confidenceLevel || null,
          data.anxietyLevel || null,
          data.meditationCompleted || false,
          data.meditationDuration || null,
          data.workoutCompleted || false,
          data.statsSubmitted || false,
          data.journalCompleted || false,
          data.wins || null,
          data.struggles || null,
          data.insights || null
        ]
      );

      // Compute moving averages for key metrics
      await this.computeMovingAverages(userId, date);

      // Check for milestones
      await this.checkMilestones(userId);

      // Detect trends
      await this.detectTrends(userId);

      logger.info('Daily metrics recorded', { userId, date });

      return { success: true };

    } catch (error) {
      logger.error('Failed to record daily metrics', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Compute moving averages for all key metrics
   */
  async computeMovingAverages(userId, date) {
    const metrics = [
      'emotional_state',
      'approaches',
      'number_response_rate',
      'confidence',
      'energy'
    ];

    for (const metric of metrics) {
      await query(
        'SELECT compute_moving_average($1, $2, $3)',
        [userId, metric, date]
      );
    }
  }

  /**
   * Get skill progression data for charts
   */
  async getSkillProgression(userId, days = 90) {
    const data = await queryRows(
      `SELECT 
         date,
         approaches_count,
         numbers_collected,
         conversations_count,
         dates_count,
         closes_count,
         second_dates,
         approach_quality_avg,
         number_response_rate,
         date_conversion_rate,
         close_rate
       FROM daily_metrics
       WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY date ASC`,
      [userId]
    );

    // Calculate cumulative totals for funnel visualization
    let cumulativeApproaches = 0;
    let cumulativeNumbers = 0;
    let cumulativeDates = 0;
    let cumulativeCloses = 0;

    const processedData = data.map(row => {
      cumulativeApproaches += row.approaches_count || 0;
      cumulativeNumbers += row.numbers_collected || 0;
      cumulativeDates += row.dates_count || 0;
      cumulativeCloses += row.closes_count || 0;

      return {
        date: row.date,
        approaches: row.approaches_count || 0,
        numbers: row.numbers_collected || 0,
        conversations: row.conversations_count || 0,
        dates: row.dates_count || 0,
        closes: row.closes_count || 0,
        secondDates: row.second_dates || 0,
        quality: row.approach_quality_avg || 0,
        numberResponseRate: row.number_response_rate || 0,
        dateConversionRate: row.date_conversion_rate || 0,
        closeRate: row.close_rate || 0,
        cumulativeApproaches,
        cumulativeNumbers,
        cumulativeDates,
        cumulativeCloses
      };
    });

    return processedData;
  }

  /**
   * Get emotional state data with moving averages
   */
  async getEmotionalStateData(userId, days = 90) {
    const data = await queryRows(
      `SELECT 
         dm.date,
         dm.daily_avg_state as current_state,
         dm.energy_level,
         dm.confidence_level,
         dm.anxiety_level,
         ma.ma_7day as state_ma7,
         ma.ma_14day as state_ma14,
         ma.ma_30day as state_ma30
       FROM daily_metrics dm
       LEFT JOIN moving_averages ma ON 
         dm.user_id = ma.user_id AND 
         dm.date = ma.date AND 
         ma.metric_name = 'emotional_state'
       WHERE dm.user_id = $1
       AND dm.date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY dm.date ASC`,
      [userId]
    );

    return data.map(row => ({
      date: row.date,
      state: parseFloat(row.current_state) || 0,
      energy: parseFloat(row.energy_level) || 0,
      confidence: parseFloat(row.confidence_level) || 0,
      anxiety: parseFloat(row.anxiety_level) || 0,
      ma7: parseFloat(row.state_ma7) || 0,
      ma14: parseFloat(row.state_ma14) || 0,
      ma30: parseFloat(row.state_ma30) || 0
    }));
  }

  /**
   * Get habit correlation data
   */
  async getHabitCorrelationData(userId, days = 90) {
    const data = await queryRows(
      `SELECT 
         date,
         meditation_completed,
         workout_completed,
         stats_submitted,
         approaches_count,
         daily_avg_state,
         confidence_level,
         approach_quality_avg
       FROM daily_metrics
       WHERE user_id = $1
       AND date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY date ASC`,
      [userId]
    );

    // Split into days with/without habits
    const withMeditation = data.filter(d => d.meditation_completed);
    const withoutMeditation = data.filter(d => !d.meditation_completed);

    const withWorkout = data.filter(d => d.workout_completed);
    const withoutWorkout = data.filter(d => !d.workout_completed);

    const avgApproachesWithMeditation = this.average(withMeditation.map(d => d.approaches_count));
    const avgApproachesWithoutMeditation = this.average(withoutMeditation.map(d => d.approaches_count));

    const avgStateWithMeditation = this.average(withMeditation.map(d => d.daily_avg_state));
    const avgStateWithoutMeditation = this.average(withoutMeditation.map(d => d.daily_avg_state));

    const avgConfidenceWithWorkout = this.average(withWorkout.map(d => d.confidence_level));
    const avgConfidenceWithoutWorkout = this.average(withoutWorkout.map(d => d.confidence_level));

    return {
      rawData: data,
      insights: {
        meditationImpact: {
          approaches: {
            with: avgApproachesWithMeditation,
            without: avgApproachesWithoutMeditation,
            improvement: ((avgApproachesWithMeditation - avgApproachesWithoutMeditation) / avgApproachesWithoutMeditation * 100).toFixed(1)
          },
          state: {
            with: avgStateWithMeditation,
            without: avgStateWithoutMeditation,
            improvement: ((avgStateWithMeditation - avgStateWithoutMeditation) / avgStateWithoutMeditation * 100).toFixed(1)
          }
        },
        workoutImpact: {
          confidence: {
            with: avgConfidenceWithWorkout,
            without: avgConfidenceWithoutWorkout,
            improvement: ((avgConfidenceWithWorkout - avgConfidenceWithoutWorkout) / avgConfidenceWithoutWorkout * 100).toFixed(1)
          }
        }
      }
    };
  }

  /**
   * Check for skill milestones
   */
  async checkMilestones(userId) {
    // Get recent totals
    const totals = await queryRow(
      `SELECT 
         SUM(approaches_count) as total_approaches,
         SUM(numbers_collected) as total_numbers,
         SUM(dates_count) as total_dates,
         SUM(closes_count) as total_closes
       FROM daily_metrics
       WHERE user_id = $1`,
      [userId]
    );

    const milestones = [
      { skill: 'approaching', name: 'First Approach', threshold: 1, metric: 'total_approaches' },
      { skill: 'approaching', name: '10 Approaches', threshold: 10, metric: 'total_approaches' },
      { skill: 'approaching', name: '50 Approaches', threshold: 50, metric: 'total_approaches' },
      { skill: 'approaching', name: '100 Approaches', threshold: 100, metric: 'total_approaches' },
      { skill: 'texting', name: 'First Number', threshold: 1, metric: 'total_numbers' },
      { skill: 'texting', name: '10 Numbers', threshold: 10, metric: 'total_numbers' },
      { skill: 'dating', name: 'First Date', threshold: 1, metric: 'total_dates' },
      { skill: 'dating', name: '10 Dates', threshold: 10, metric: 'total_dates' },
      { skill: 'closing', name: 'First Close', threshold: 1, metric: 'total_closes' },
      { skill: 'closing', name: '5 Closes', threshold: 5, metric: 'total_closes' }
    ];

    for (const milestone of milestones) {
      const currentValue = parseInt(totals[milestone.metric]) || 0;

      if (currentValue >= milestone.threshold) {
        // Check if already achieved
        const existing = await queryRow(
          `SELECT id FROM skill_milestones 
           WHERE user_id = $1 AND skill_type = $2 AND milestone_name = $3`,
          [userId, milestone.skill, milestone.name]
        );

        if (!existing) {
          // Record new milestone
          await query(
            `INSERT INTO skill_milestones 
             (user_id, skill_type, milestone_name, metric_value, description)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              userId,
              milestone.skill,
              milestone.name,
              currentValue,
              `Achieved ${milestone.name}!`
            ]
          );

          logger.info('Milestone achieved', { userId, milestone: milestone.name });

          // TODO: Send celebration message
        }
      }
    }
  }

  /**
   * Detect trends and create alerts
   */
  async detectTrends(userId) {
    // Get last 30 days of emotional state
    const stateData = await queryRows(
      `SELECT date, daily_avg_state
       FROM daily_metrics
       WHERE user_id = $1
       AND daily_avg_state IS NOT NULL
       AND date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY date ASC`,
      [userId]
    );

    if (stateData.length < 7) return; // Need at least a week

    // Simple trend detection: compare first 7 days vs last 7 days
    const firstWeek = stateData.slice(0, 7);
    const lastWeek = stateData.slice(-7);

    const firstWeekAvg = this.average(firstWeek.map(d => parseFloat(d.daily_avg_state)));
    const lastWeekAvg = this.average(lastWeek.map(d => parseFloat(d.daily_avg_state)));

    const change = lastWeekAvg - firstWeekAvg;
    const changePercent = (change / firstWeekAvg) * 100;

    let trendType = 'plateau';
    let description = '';
    let recommendation = '';

    if (changePercent > 10) {
      trendType = 'improving';
      description = `Emotional state improving by ${changePercent.toFixed(1)}% over last 30 days`;
      recommendation = 'Keep doing what you\'re doing! Your habits are working.';
    } else if (changePercent < -10) {
      trendType = 'declining';
      description = `Emotional state declining by ${Math.abs(changePercent).toFixed(1)}% over last 30 days`;
      recommendation = 'Time for a check-in. What changed recently? Consider increasing meditation/workout frequency.';
    } else {
      trendType = 'plateau';
      description = 'Emotional state stable';
      recommendation = 'Consistent performance. Ready to level up your approach volume?';
    }

    // Check if we already have this alert
    const existing = await queryRow(
      `SELECT id FROM trend_alerts
       WHERE user_id = $1
       AND metric_name = 'emotional_state'
       AND detected_at >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    if (!existing) {
      await query(
        `INSERT INTO trend_alerts
         (user_id, metric_name, trend_type, trend_strength, description, recommendation)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, 'emotional_state', trendType, Math.abs(changePercent) / 100, description, recommendation]
      );
    }
  }

  /**
   * Helper: Calculate average
   */
  average(arr) {
    const filtered = arr.filter(n => n != null && !isNaN(n));
    if (filtered.length === 0) return 0;
    return filtered.reduce((a, b) => a + b, 0) / filtered.length;
  }

  /**
   * Get complete analytics summary
   */
  async getAnalyticsSummary(userId) {
    const skillProgression = await this.getSkillProgression(userId, 90);
    const emotionalState = await this.getEmotionalStateData(userId, 90);
    const habitCorrelation = await this.getHabitCorrelationData(userId, 90);
    const milestones = await queryRows(
      'SELECT * FROM skill_milestones WHERE user_id = $1 ORDER BY achieved_at DESC',
      [userId]
    );
    const trends = await queryRows(
      'SELECT * FROM trend_alerts WHERE user_id = $1 AND acknowledged = false ORDER BY detected_at DESC',
      [userId]
    );

    return {
      skillProgression,
      emotionalState,
      habitCorrelation,
      milestones,
      trends
    };
  }
}

module.exports = ProgressTracker;

