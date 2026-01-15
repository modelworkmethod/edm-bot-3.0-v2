/**
 * Coaching Insights Command
 * Enhanced dashboard with risk scores, patterns, and intervention queue
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('CoachingInsightsCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coaching-insights')
    .setDescription('Predictive coaching analytics (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('at-risk')
        .setDescription('View at-risk users')
        .addIntegerOption(option =>
          option
            .setName('min-score')
            .setDescription('Minimum risk score (default: 50)')
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('patterns')
        .setDescription('View users by behavioral pattern')
        .addStringOption(option =>
          option
            .setName('pattern')
            .setDescription('Pattern type')
            .addChoices(
              { name: 'Action Junkies', value: 'action_junkie' },
              { name: 'Analysis Paralysis', value: 'analysis_paralysis' },
              { name: 'Streaky Performers', value: 'streaky_performer' },
              { name: 'Steady Climbers', value: 'steady_climber' },
              { name: 'At-Risk Plateau', value: 'at_risk_plateau' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('interventions')
        .setDescription('Review pending intervention suggestions')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('user-profile')
        .setDescription('Detailed analytics for specific user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to analyze')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('run-analysis')
        .setDescription('Run analytics for all users (takes ~2 min)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('approve-intervention')
        .setDescription('Approve and send intervention')
        .addIntegerOption(option =>
          option
            .setName('intervention-id')
            .setDescription('Intervention ID')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('edited-message')
            .setDescription('Edit message before sending (optional)')
        )
    ),

  async execute(interaction, services) {
    const isAdmin = interaction.user.id === config.admin.userId ||
                    interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.reply({ content: 'Admin only.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'at-risk') {
      await this.handleAtRisk(interaction, services);
    } else if (subcommand === 'patterns') {
      await this.handlePatterns(interaction, services);
    } else if (subcommand === 'interventions') {
      await this.handleInterventions(interaction, services);
    } else if (subcommand === 'user-profile') {
      await this.handleUserProfile(interaction, services);
    } else if (subcommand === 'run-analysis') {
      await this.handleRunAnalysis(interaction, services);
    } else if (subcommand === 'approve-intervention') {
      await this.handleApproveIntervention(interaction, services);
    }
  },

  async handleAtRisk(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const minScore = interaction.options.getInteger('min-score') || 50;

    const RiskScorer = require('../../services/analytics/RiskScorer');
    const riskScorer = new RiskScorer(services.userService);

    const atRiskUsers = await riskScorer.getAtRiskUsers(minScore, 20);

    if (atRiskUsers.length === 0) {
      await interaction.editReply(`No users with risk score >= ${minScore}.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(`⚠️ At-Risk Users (Score >= ${minScore})`)
      .setDescription(`${atRiskUsers.length} users need attention`)
      .setFooter({ text: 'Risk scores updated within last 24 hours' });

    for (const user of atRiskUsers.slice(0, 15)) {
      const riskEmoji = user.risk_tier === 'critical' ? '🔴' : 
                       user.risk_tier === 'high' ? '🟠' : 
                       user.risk_tier === 'medium' ? '🟡' : '🟢';

      embed.addFields({
        name: `${riskEmoji} <@${user.user_id}> - Score: ${user.risk_score}`,
        value: [
          `**Concern:** ${user.primary_concern}`,
          `**Action:** ${user.recommended_action}`,
          `**Urgency:** ${'⭐'.repeat(user.urgency_level)}`,
          `Days inactive: ${user.days_since_submission} | Breaks: ${user.streak_breaks_30d}`
        ].join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handlePatterns(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const patternType = interaction.options.getString('pattern');

    const PatternDetector = require('../../services/analytics/PatternDetector');
    const detector = new PatternDetector(services.userService);

    const users = await detector.getUsersByPattern(patternType, 70);

    if (users.length === 0) {
      await interaction.editReply(`No users detected with "${patternType}" pattern.`);
      return;
    }

    const patternNames = {
      action_junkie: 'Action Junkies',
      analysis_paralysis: 'Analysis Paralysis',
      streaky_performer: 'Streaky Performers',
      steady_climber: 'Steady Climbers',
      at_risk_plateau: 'At-Risk Plateau'
    };

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle(`📊 ${patternNames[patternType]}`)
      .setDescription(`${users.length} users identified`)
      .setFooter({ text: 'Confidence >= 70%' });

    for (const user of users.slice(0, 15)) {
      const evidence = JSON.parse(user.supporting_evidence);
      
      embed.addFields({
        name: `<@${user.user_id}> - Confidence: ${user.confidence_score}%`,
        value: [
          `**Pattern:** ${evidence.description}`,
          `**Coaching:** ${evidence.coaching_notes}`,
          `**Evidence:** ${evidence.evidence.slice(0, 2).join(', ')}`
        ].join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handleInterventions(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const InterventionGenerator = require('../../services/analytics/InterventionGenerator');
    const generator = new InterventionGenerator(services.userService);

    const pending = await generator.getPendingInterventions(15);

    if (pending.length === 0) {
      await interaction.editReply('No pending interventions. Run analysis to generate new suggestions.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('📬 Pending Intervention Queue')
      .setDescription(`${pending.length} messages awaiting your review`)
      .setFooter({ text: 'Use /coaching-insights approve-intervention to send' });

    for (const intervention of pending.slice(0, 10)) {
      const typeEmoji = {
        reengagement: '🔄',
        celebration: '🎉',
        challenge: '💪',
        resource: '📚',
        accountability: '✅'
      }[intervention.intervention_type] || '💬';

      embed.addFields({
        name: `${typeEmoji} ID: ${intervention.id} - ${intervention.username}`,
        value: [
          `**Type:** ${intervention.intervention_type}`,
          `**Preview:** ${intervention.suggested_message.substring(0, 150)}...`,
          `**Reasoning:** ${intervention.reasoning}`
        ].join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handleUserProfile(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');

    const RiskScorer = require('../../services/analytics/RiskScorer');
    const PatternDetector = require('../../services/analytics/PatternDetector');

    const riskScorer = new RiskScorer(services.userService);
    const patternDetector = new PatternDetector(services.userService);

    const [riskData, pattern] = await Promise.all([
      riskScorer.calculateRiskScore(user.id),
      patternDetector.detectPattern(user.id)
    ]);

    if (!riskData) {
      await interaction.editReply('Could not analyze user.');
      return;
    }

    const riskColor = riskData.riskTier === 'critical' ? 0xFF0000 :
                     riskData.riskTier === 'high' ? 0xFF6B00 :
                     riskData.riskTier === 'medium' ? 0xFFAA00 : 0x00FF00;

    const embed = new EmbedBuilder()
      .setColor(riskColor)
      .setTitle(`Analytics Profile: ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        {
          name: '🎯 Risk Assessment',
          value: [
            `**Score:** ${riskData.riskScore}/100`,
            `**Tier:** ${riskData.riskTier.toUpperCase()}`,
            `**Primary Concern:** ${riskData.primaryConcern}`,
            `**Recommended Action:** ${riskData.recommendedAction}`
          ].join('\n'),
          inline: false
        },
        {
          name: '📊 Risk Factors',
          value: [
            `Inactivity: ${riskData.factors.inactivity}/100`,
            `Streak Breaks: ${riskData.factors.streakBreaks}/100`,
            `XP Velocity: ${riskData.factors.xpVelocity}/100`,
            `Chat Activity: ${100 - riskData.factors.chatActivity}/100`,
            `Wins Participation: ${100 - riskData.factors.winsParticipation}/100`,
            `Course Engagement: ${100 - riskData.factors.courseEngagement}/100`
          ].join('\n'),
          inline: true
        }
      );

    if (pattern && pattern.confidence >= 50) {
      const evidence = pattern.evidence.join('\n- ');
      
      embed.addFields({
        name: `🧩 Behavioral Pattern: ${pattern.type.replace(/_/g, ' ').toUpperCase()}`,
        value: [
          `**Confidence:** ${pattern.confidence}%`,
          `**Description:** ${pattern.description}`,
          `**Coaching Notes:** ${pattern.coaching_notes}`,
          `**Evidence:**`,
          `- ${evidence}`
        ].join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handleRunAnalysis(interaction, services) {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply('🔄 Running analytics for all users... This will take 1-2 minutes.');

    const RiskScorer = require('../../services/analytics/RiskScorer');
    const PatternDetector = require('../../services/analytics/PatternDetector');
    const InterventionGenerator = require('../../services/analytics/InterventionGenerator');

    const riskScorer = new RiskScorer(services.userService);
    const patternDetector = new PatternDetector(services.userService);
    const interventionGenerator = new InterventionGenerator(services.userService);

    try {
      // Calculate risk scores for all users
      const userCount = await riskScorer.calculateAllUsers();

      // Get at-risk users and generate interventions
      const atRiskUsers = await riskScorer.getAtRiskUsers(50, 50);
      let interventionsGenerated = 0;

      for (const riskData of atRiskUsers) {
        const pattern = await patternDetector.detectPattern(riskData.user_id);
        await interventionGenerator.generateIntervention(riskData.user_id, riskData.risk_score, pattern);
        interventionsGenerated++;
      }

      await interaction.editReply(
        `✅ Analysis complete!\n\n` +
        `Users analyzed: ${userCount}\n` +
        `At-risk users: ${atRiskUsers.length}\n` +
        `Interventions generated: ${interventionsGenerated}\n\n` +
        `Use \`/coaching-insights interventions\` to review.`
      );

    } catch (error) {
      logger.error('Analysis failed', { error: error.message });
      await interaction.editReply(`Analysis failed: ${error.message}`);
    }
  },

  async handleApproveIntervention(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const interventionId = interaction.options.getInteger('intervention-id');
    const editedMessage = interaction.options.getString('edited-message');

    const InterventionGenerator = require('../../services/analytics/InterventionGenerator');
    const generator = new InterventionGenerator(services.userService);

    // Approve
    const approval = await generator.approveIntervention(
      interventionId,
      interaction.user.id,
      editedMessage
    );

    if (!approval.success) {
      await interaction.editReply(`Failed to approve: ${approval.error}`);
      return;
    }

    // Send
    const result = await generator.sendIntervention(interventionId, services.channelService);

    if (result.success) {
      await interaction.editReply(
        `✅ Intervention #${interventionId} approved and sent!\n\n` +
        `${editedMessage ? '(Your edited version was used)' : '(AI suggestion sent as-is)'}`
      );
    } else {
      await interaction.editReply(`Approved but failed to send: ${result.error}`);
    }
  }
};

