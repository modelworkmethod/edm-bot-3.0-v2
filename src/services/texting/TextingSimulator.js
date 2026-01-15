/**
 * Texting Simulator
 * Interactive texting practice scenarios
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');

const logger = createLogger('TextingSimulator');

class TextingSimulator {
  constructor(repositories, secondaryXPProcessor) {
    this.repositories = repositories;
    this.secondaryXPProcessor = secondaryXPProcessor;
  }

  /**
   * Start new simulation attempt
   */
  async startSimulation(userId, scenarioId) {
    try {
      const scenario = await this.getScenario(scenarioId);

      if (!scenario || !scenario.is_active) {
        return { success: false, error: 'Scenario not found or inactive' };
      }

      const attempt = await queryRow(
        `INSERT INTO texting_attempts (user_id, scenario_id, status)
         VALUES ($1, $2, 'in_progress')
         RETURNING *`,
        [userId, scenarioId]
      );

      logger.info('Texting simulation started', { userId, attemptId: attempt.id, scenarioId });

      return {
        success: true,
        attempt,
        scenario
      };

    } catch (error) {
      logger.error('Failed to start simulation', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send message in simulation
   */
  async sendMessage(attemptId, userId, messageText) {
    try {
      // Get attempt
      const attempt = await this.getAttempt(attemptId);

      if (!attempt || attempt.user_id !== userId) {
        return { success: false, error: 'Attempt not found or unauthorized' };
      }

      if (attempt.status !== 'in_progress') {
        return { success: false, error: 'Simulation is not active' };
      }

      // Record user message
      await query(
        `INSERT INTO texting_messages (attempt_id, sender, message_text)
         VALUES ($1, 'user', $2)`,
        [attemptId, messageText]
      );

      // Update message count
      await query(
        `UPDATE texting_attempts 
         SET messages_sent = messages_sent + 1 
         WHERE id = $1`,
        [attemptId]
      );

      // Generate AI response (placeholder)
      const girlResponse = await this.generateGirlResponse(attemptId, messageText);

      // Record girl's response
      await query(
        `INSERT INTO texting_messages (attempt_id, sender, message_text, sentiment_score)
         VALUES ($1, 'girl', $2, $3)`,
        [attemptId, girlResponse.text, girlResponse.sentimentScore]
      );

      logger.info('Texting message exchanged', { attemptId, userId });

      return {
        success: true,
        girlResponse: girlResponse.text,
        sentimentScore: girlResponse.sentimentScore,
        feedback: girlResponse.feedback
      };

    } catch (error) {
      logger.error('Failed to send texting message', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate girl's response (AI placeholder)
   */
  async generateGirlResponse(attemptId, userMessage) {
    // TODO: Implement AI-powered responses (Phase 11)
    // For now, use simple rule-based responses
    
    const responses = [
      { text: "Haha that's funny 😄", sentimentScore: 7, feedback: "Good playful energy" },
      { text: "Yeah for sure!", sentimentScore: 5, feedback: "Neutral but engaged" },
      { text: "Sorry I'm busy", sentimentScore: -5, feedback: "Low interest - try escalating" }
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    return randomResponse;
  }

  /**
   * Finish simulation and calculate score
   */
  async finishSimulation(attemptId, userId) {
    try {
      const attempt = await this.getAttempt(attemptId);

      if (!attempt || attempt.user_id !== userId) {
        return { success: false, error: 'Attempt not found' };
      }

      if (attempt.status !== 'in_progress') {
        return { success: false, error: 'Simulation already finished' };
      }

      // Calculate score
      const score = await this.calculateScore(attemptId);

      // Update attempt
      await query(
        `UPDATE texting_attempts 
         SET status = 'completed', score = $1, feedback = $2, completed_at = NOW()
         WHERE id = $3`,
        [score.score, score.feedback, attemptId]
      );

      // Award XP based on score
      if (this.secondaryXPProcessor) {
        const result = await this.secondaryXPProcessor.awardSecondaryXP(
          userId,
          'textingPractice',
          'completeScenario',
          { score: score.score, attemptId }
        );

        score.xpAwarded = result.xp || 0;
        score.unlocked = result.unlocked;
      }

      logger.info('Texting simulation completed', {
        userId,
        attemptId,
        score: score.score
      });

      return {
        success: true,
        score: score.score,
        feedback: score.feedback,
        xpAwarded: score.xpAwarded,
        unlocked: score.unlocked
      };

    } catch (error) {
      logger.error('Failed to finish simulation', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate score for attempt
   */
  async calculateScore(attemptId) {
    const messages = await this.getMessages(attemptId);

    if (messages.length === 0) {
      return { score: 0, feedback: 'No messages sent' };
    }

    // Simple scoring: average sentiment
    const girlMessages = messages.filter(m => m.sender === 'girl');
    const avgSentiment = girlMessages.reduce((sum, m) => sum + (m.sentiment_score || 0), 0) / girlMessages.length;

    // Convert sentiment (-10 to +10) to score (0-100)
    const score = Math.round(((avgSentiment + 10) / 20) * 100);

    let feedback = 'Good effort! ';
    if (score >= 80) {
      feedback += 'Excellent texting game - you built strong attraction.';
    } else if (score >= 60) {
      feedback += 'Solid conversation, but could escalate more.';
    } else {
      feedback += 'Work on building more emotional investment.';
    }

    return { score, feedback };
  }

  /**
   * Get scenario by ID
   */
  async getScenario(scenarioId) {
    return await queryRow('SELECT * FROM texting_scenarios WHERE id = $1', [scenarioId]);
  }

  /**
   * Get attempt by ID
   */
  async getAttempt(attemptId) {
    return await queryRow('SELECT * FROM texting_attempts WHERE id = $1', [attemptId]);
  }

  /**
   * Get messages for attempt
   */
  async getMessages(attemptId) {
    return await queryRows(
      'SELECT * FROM texting_messages WHERE attempt_id = $1 ORDER BY created_at ASC',
      [attemptId]
    );
  }

  /**
   * Get all active scenarios
   */
  async getActiveScenarios() {
    return await queryRows(
      'SELECT * FROM texting_scenarios WHERE is_active = true ORDER BY difficulty, scenario_name'
    );
  }
}

module.exports = TextingSimulator;

