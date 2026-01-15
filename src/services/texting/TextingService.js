/**
 * Texting Service
 * Thin wrapper for texting simulator with clean command API
 */

const { createLogger } = require('../../utils/logger');
const { queryRow } = require('../../database/postgres');

const logger = createLogger('TextingService');

class TextingService {
  constructor(textingSimulator) {
    this.simulator = textingSimulator;
  }

  /**
   * Get user's active session (if any)
   */
  async getActiveSession(userId) {
    try {
      const attempt = await queryRow(
        `SELECT ta.*, ts.scenario_name, ts.context, ts.description
         FROM texting_attempts ta
         JOIN texting_scenarios ts ON ta.scenario_id = ts.id
         WHERE ta.user_id = $1 AND ta.status = 'in_progress'
         ORDER BY ta.started_at DESC
         LIMIT 1`,
        [userId]
      );

      if (!attempt) {
        return { success: true, hasSession: false };
      }

      // Get last message for context
      const lastMessage = await queryRow(
        `SELECT * FROM texting_messages 
         WHERE attempt_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [attempt.id]
      );

      return {
        success: true,
        hasSession: true,
        sessionId: attempt.id,
        scenarioKey: attempt.scenario_id,
        scenarioName: attempt.scenario_name,
        turnCount: attempt.messages_sent,
        lastMessage: lastMessage ? lastMessage.message_text : null,
        lastSender: lastMessage ? lastMessage.sender : null,
        startedAt: attempt.started_at
      };

    } catch (error) {
      logger.error('Failed to get active session', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Start or resume scenario
   */
  async startOrResume(userId, scenarioKey) {
    try {
      // Check for existing active session
      const activeCheck = await this.getActiveSession(userId);
      if (activeCheck.hasSession) {
        return {
          success: true,
          resumed: true,
          sessionId: activeCheck.sessionId,
          scenarioKey: activeCheck.scenarioKey,
          scenarioName: activeCheck.scenarioName,
          promptText: activeCheck.lastSender === 'girl' ? activeCheck.lastMessage : 'Your turn to respond.',
          turnCount: activeCheck.turnCount,
          startedAt: activeCheck.startedAt
        };
      }

      // If scenario key provided, start new
      if (scenarioKey) {
        const result = await this.simulator.startSimulation(userId, scenarioKey);
        
        if (!result.success) {
          return { success: false, error: result.error };
        }

        return {
          success: true,
          resumed: false,
          sessionId: result.attempt.id,
          scenarioKey: result.scenario.id,
          scenarioName: result.scenario.scenario_name,
          promptText: result.scenario.context,
          description: result.scenario.description,
          startedAt: result.attempt.started_at
        };
      }

      // No scenario key and no active session = need to pick one
      return { success: true, needsScenario: true };

    } catch (error) {
      logger.error('Failed to start/resume', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send message in active session
   */
  async send(userId, message) {
    try {
      // Get active session
      const activeCheck = await this.getActiveSession(userId);
      if (!activeCheck.hasSession) {
        return { success: false, error: 'No active session. Use /texting-practice to start.' };
      }

      // Send via simulator
      const result = await this.simulator.sendMessage(activeCheck.sessionId, userId, message);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Get updated turn count
      const updatedAttempt = await this.simulator.getAttempt(activeCheck.sessionId);

      return {
        success: true,
        sessionId: activeCheck.sessionId,
        feedback: result.feedback || 'not available',
        nextPrompt: result.girlResponse,
        turnCount: updatedAttempt.messages_sent
      };

    } catch (error) {
      logger.error('Failed to send message', { error: error.message, userId });
      return { success: false, error: 'Failed to send message. Please try again.' };
    }
  }

  /**
   * Finish active session
   */
  async finish(userId) {
    try {
      // Get active session
      const activeCheck = await this.getActiveSession(userId);
      if (!activeCheck.hasSession) {
        return { success: false, error: 'No active session to finish.' };
      }

      // Finish via simulator
      const result = await this.simulator.finishSimulation(activeCheck.sessionId, userId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        score: result.score,
        xpAwarded: result.xpAwarded || 0,
        summary: result.feedback || 'Nice work—keep practicing.'
      };

    } catch (error) {
      logger.error('Failed to finish session', { error: error.message, userId });
      return { success: false, error: 'Failed to finish session. Please try again.' };
    }
  }

  /**
   * Get available scenarios for selection
   */
  async getAvailableScenarios(limit = 5) {
    try {
      const scenarios = await this.simulator.getActiveScenarios();
      return {
        success: true,
        scenarios: scenarios.slice(0, limit).map(s => ({
          key: s.id,
          name: s.scenario_name,
          difficulty: s.difficulty,
          description: s.description
        }))
      };
    } catch (error) {
      logger.error('Failed to get scenarios', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = TextingService;


