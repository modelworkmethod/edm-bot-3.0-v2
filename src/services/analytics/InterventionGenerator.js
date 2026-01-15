/**
 * Intervention Generator
 * Creates suggested coaching interventions based on risk and patterns
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');

const logger = createLogger('InterventionGenerator');

class InterventionGenerator {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Generate intervention suggestions for user
   */
  async generateIntervention(userId, riskScore, pattern) {
    try {
      const user = await this.userService.getUser(userId);
      const interventionType = this.determineInterventionType(riskScore, pattern);
      const message = await this.craftMessage(user, interventionType, riskScore, pattern);

      // Save intervention for coach approval
      const intervention = await this.saveIntervention(
        userId,
        interventionType,
        message.text,
        message.reasoning
      );

      logger.info('Intervention generated', {
        userId,
        interventionType,
        interventionId: intervention.id
      });

      return intervention;

    } catch (error) {
      logger.error('Intervention generation failed', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Determine intervention type based on risk and pattern
   */
  determineInterventionType(riskScore, pattern) {
    // Critical risk = reengagement
    if (riskScore >= 75) return 'reengagement';

    // Pattern-based interventions
    if (pattern) {
      switch (pattern.type) {
        case 'action_junkie':
          return 'resource'; // Point to inner work modules
        case 'analysis_paralysis':
          return 'challenge'; // Push to action
        case 'streaky_performer':
          return 'accountability'; // Check-in system
        case 'steady_climber':
          return 'celebration'; // Acknowledge progress
        case 'at_risk_plateau':
          return 'reengagement'; // Personal outreach
      }
    }

    // Default based on risk tier
    if (riskScore >= 50) return 'accountability';
    if (riskScore >= 25) return 'resource';
    return 'celebration';
  }

  /**
   * Craft personalized message
   */
  async craftMessage(user, interventionType, riskScore, pattern) {
    const templates = {
      reengagement: this.reengagementMessage,
      celebration: this.celebrationMessage,
      challenge: this.challengeMessage,
      resource: this.resourceMessage,
      accountability: this.accountabilityMessage
    };

    const generator = templates[interventionType] || templates.accountability;
    return await generator.call(this, user, riskScore, pattern);
  }

  /**
   * Reengagement message template
   */
  async reengagementMessage(user, riskScore, pattern) {
    const daysSince = await this.getDaysSinceSubmission(user.user_id);
    const lastStreak = user.longest_streak || 0;

    const message = `Hey ${user.username},

I noticed you haven't submitted stats in ${daysSince} days. 

${lastStreak > 0 ? `You had an amazing ${lastStreak}-day streak going - that takes real commitment.` : 'I know staying consistent can be tough.'}

What's going on? ${this.getReengagementQuestion(pattern)}

Sometimes we just need to talk through what's blocking us. Want to hop on a quick call this week?

- Coach`;

    return {
      text: message,
      reasoning: `User inactive ${daysSince} days. Risk score: ${riskScore}. ${pattern ? `Pattern: ${pattern.type}` : 'No pattern detected yet.'}`
    };
  }

  /**
   * Get contextual reengagement question
   */
  getReengagementQuestion(pattern) {
    if (!pattern) return 'Hit a rough patch?';

    switch (pattern.type) {
      case 'action_junkie':
        return 'Burned out from pushing too hard?';
      case 'analysis_paralysis':
        return 'Got stuck overthinking again?';
      case 'streaky_performer':
        return 'Lost momentum after your last push?';
      default:
        return 'What pulled you off track?';
    }
  }

  /**
   * Celebration message template
   */
  async celebrationMessage(user, riskScore, pattern) {
    const stats = await this.getRecentStats(user.user_id);
    const highlight = this.getHighlight(stats);

    const message = `${user.username} - crushing it! 🔥

${highlight}

${pattern && pattern.type === 'steady_climber' ? 
  'Your consistency is exactly what transformation looks like. Most people quit. You keep showing up.' : 
  'This is the momentum that changes everything.'}

Keep going. You're building something real here.

- Coach`;

    return {
      text: message,
      reasoning: `Positive reinforcement. Risk: ${riskScore}. Pattern: ${pattern?.type || 'unknown'}. Recent wins detected.`
    };
  }

  /**
   * Challenge message template
   */
  async challengeMessage(user, riskScore, pattern) {
    const challenge = this.getChallenge(pattern, user);

    const message = `${user.username},

${challenge.setup}

Here's the challenge: ${challenge.task}

${challenge.why}

You ready?

- Coach`;

    return {
      text: message,
      reasoning: `User needs action push. Pattern: ${pattern?.type}. Risk: ${riskScore}.`
    };
  }

  /**
   * Get appropriate challenge
   */
  getChallenge(pattern, user) {
    if (pattern?.type === 'analysis_paralysis') {
      return {
        setup: "I see you've been deep in the course modules. That's great - you're learning. But learning without action is just entertainment.",
        task: "3 approaches per day for the next 7 days. No excuses. Don't need to get numbers, just approach.",
        why: "Action cures fear. Every approach you don't make is a choice to stay stuck."
      };
    }

    if (pattern?.type === 'action_junkie') {
      return {
        setup: "You're crushing approaches. Respect. But I'm seeing a lot of action without processing.",
        task: "Journal for 10 minutes after every approach session this week. What did you feel? What resistance came up?",
        why: "Unconscious action leads to burnout. Conscious action leads to transformation."
      };
    }

    return {
      setup: "You're making progress, but I know you can go harder.",
      task: "Double your usual daily stats for the next 5 days.",
      why: "Because comfort zones are where dreams go to die."
    };
  }

  /**
   * Resource message template
   */
  async resourceMessage(user, riskScore, pattern) {
    const resource = this.getResource(pattern, user);

    const message = `${user.username},

Based on where you're at, I think ${resource.module} would be huge for you right now.

${resource.why}

Check it out this week and let me know what lands.

- Coach`;

    return {
      text: message,
      reasoning: `Targeted resource recommendation. Pattern: ${pattern?.type}. Risk: ${riskScore}.`
    };
  }

  /**
   * Get targeted resource
   */
  getResource(pattern, user) {
    if (pattern?.type === 'analysis_paralysis') {
      return {
        module: 'Module 3: Approaching - From Fear to Freedom',
        why: "You know the theory. Time to apply it. This module will get you out of your head and into the field."
      };
    }

    if (pattern?.type === 'action_junkie') {
      return {
        module: 'Module 2: Inner Game - Releasing Resistance',
        why: "All that action is great, but you're leaving gains on the table. This will help you process and integrate."
      };
    }

    return {
      module: 'Module 4: Conversation - Creating Connection',
      why: "Getting numbers is one thing. Creating genuine connection is where the magic happens."
    };
  }

  /**
   * Accountability message template
   */
  async accountabilityMessage(user, riskScore, pattern) {
    const message = `${user.username},

Quick check-in: How's the week going?

${pattern?.type === 'streaky_performer' ? 
  "I know you go through waves. What usually helps you get back on track when you feel momentum slipping?" :
  "What's one win from this week, even if it's small?"}

Reply when you can. I'm here.

- Coach`;

    return {
      text: message,
      reasoning: `Accountability check-in. Pattern: ${pattern?.type}. Risk: ${riskScore}.`
    };
  }

  /**
   * Save intervention for approval
   */
  async saveIntervention(userId, interventionType, message, reasoning) {
    const result = await queryRow(
      `INSERT INTO coaching_interventions 
       (user_id, intervention_type, suggested_message, reasoning, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [userId, interventionType, message, reasoning]
    );

    return result;
  }

  /**
   * Get pending interventions (for coach review)
   */
  async getPendingInterventions(limit = 20) {
    return await queryRows(
      `SELECT i.*, u.username
       FROM coaching_interventions i
       JOIN users u ON i.user_id = u.user_id
       WHERE i.status = 'pending'
       ORDER BY i.created_at ASC
       LIMIT $1`,
      [limit]
    );
  }

  /**
   * Approve intervention
   */
  async approveIntervention(interventionId, reviewerId, editedMessage = null) {
    const intervention = await queryRow(
      'SELECT * FROM coaching_interventions WHERE id = $1',
      [interventionId]
    );

    if (!intervention) return { success: false, error: 'Not found' };

    const finalMessage = editedMessage || intervention.suggested_message;
    const status = editedMessage ? 'edited' : 'approved';

    await query(
      `UPDATE coaching_interventions
       SET status = $1, reviewed_by = $2, final_message = $3
       WHERE id = $4`,
      [status, reviewerId, finalMessage, interventionId]
    );

    return {
      success: true,
      intervention: { ...intervention, final_message: finalMessage }
    };
  }

  /**
   * Reject intervention
   */
  async rejectIntervention(interventionId, reviewerId) {
    await query(
      `UPDATE coaching_interventions
       SET status = 'rejected', reviewed_by = $1
       WHERE id = $2`,
      [reviewerId, interventionId]
    );

    return { success: true };
  }

  /**
   * Send approved intervention
   */
  async sendIntervention(interventionId, channelService) {
    const intervention = await queryRow(
      'SELECT * FROM coaching_interventions WHERE id = $1',
      [interventionId]
    );

    if (!intervention || intervention.status !== 'approved' && intervention.status !== 'edited') {
      return { success: false, error: 'Not approved' };
    }

    try {
      await channelService.sendDM(intervention.user_id, intervention.final_message);

      await query(
        `UPDATE coaching_interventions
         SET sent_at = NOW()
         WHERE id = $1`,
        [interventionId]
      );

      logger.info('Intervention sent', {
        interventionId,
        userId: intervention.user_id,
        type: intervention.intervention_type
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to send intervention', { error: error.message, interventionId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper methods
   */
  async getDaysSinceSubmission(userId) {
    const user = await this.userService.getUser(userId);
    if (!user.last_submission) return 999;

    return Math.floor(
      (Date.now() - new Date(user.last_submission).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  async getRecentStats(userId) {
    return await queryRow(
      `SELECT 
         COALESCE(SUM((raw_stats->>'Approaches')::int), 0) as approaches,
         COALESCE(SUM((raw_stats->>'Numbers')::int), 0) as numbers,
         COALESCE(SUM((raw_stats->>'Dates Had')::int), 0) as dates
       FROM user_daily
       WHERE user_id = $1
       AND day >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );
  }

  getHighlight(stats) {
    const highlights = [];
    
    if (stats.dates > 0) {
      highlights.push(`${stats.dates} ${stats.dates === 1 ? 'date' : 'dates'} this week`);
    }
    if (stats.numbers >= 5) {
      highlights.push(`${stats.numbers} numbers`);
    }
    if (stats.approaches >= 10) {
      highlights.push(`${stats.approaches} approaches`);
    }

    return highlights.length > 0 
      ? highlights.join(', ') + '.'
      : 'Solid week of showing up and doing the work.';
  }
}

module.exports = InterventionGenerator;

