/**
 * Security Admin Command
 * Manage warnings, bans, content flags, and audit logs
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('SecurityCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('security')
    .setDescription('Security and moderation tools (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to warn')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for warning')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('severity')
            .setDescription('Warning severity')
            .addChoices(
              { name: 'Low', value: 'low' },
              { name: 'Medium', value: 'medium' },
              { name: 'High', value: 'high' },
              { name: 'Critical', value: 'critical' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('warnings')
        .setDescription('View user warnings')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to check')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('flags')
        .setDescription('View unreviewed content flags')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('audit')
        .setDescription('View recent admin actions')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of records (default: 20)')
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('export-data')
        .setDescription('Export user data (GDPR)')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to export data for')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('backup')
        .setDescription('Create database backup')
    ),

  async execute(interaction, services) {
    const isAdmin = interaction.user.id === config.admin.userId ||
                    interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      await interaction.reply({ content: 'Admin only.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'warn') {
      await this.handleWarn(interaction, services);
    } else if (subcommand === 'warnings') {
      await this.handleWarnings(interaction, services);
    } else if (subcommand === 'flags') {
      await this.handleFlags(interaction, services);
    } else if (subcommand === 'audit') {
      await this.handleAudit(interaction, services);
    } else if (subcommand === 'export-data') {
      await this.handleExport(interaction, services);
    } else if (subcommand === 'backup') {
      await this.handleBackup(interaction, services);
    }
  },

  async handleWarn(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const severity = interaction.options.getString('severity') || 'medium';

    const WarningSystem = require('../../services/security/WarningSystem');
    const warningSystem = new WarningSystem(services.channelService);

    const result = await warningSystem.warnUser(
      user.id,
      interaction.user.id,
      reason,
      severity
    );

    if (result.success) {
      await interaction.editReply(
        `User ${user.tag} warned.\nTotal warnings: ${result.warningCount}\nAction: ${result.actionTaken}`
      );
    } else {
      await interaction.editReply(`Failed to warn user: ${result.error}`);
    }
  },

  async handleWarnings(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');

    const WarningSystem = require('../../services/security/WarningSystem');
    const warningSystem = new WarningSystem(services.channelService);

    const warnings = await warningSystem.getUserWarnings(user.id);

    if (warnings.length === 0) {
      await interaction.editReply(`${user.tag} has no warnings.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle(`Warnings for ${user.tag}`)
      .setDescription(`Total: ${warnings.length} warnings`);

    for (const warning of warnings.slice(0, 10)) {
      const date = new Date(warning.created_at).toLocaleDateString();
      embed.addFields({
        name: `${warning.severity.toUpperCase()} - ${date}`,
        value: warning.reason,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handleFlags(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const ContentModerator = require('../../services/security/ContentModerator');
    const moderator = new ContentModerator();

    const flags = await moderator.getUnreviewedFlags(20);

    if (flags.length === 0) {
      await interaction.editReply('No unreviewed flags.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Unreviewed Content Flags')
      .setDescription(`${flags.length} flags pending review`);

    for (const flag of flags.slice(0, 10)) {
      const date = new Date(flag.created_at).toLocaleDateString();
      embed.addFields({
        name: `Flag ${flag.id} - ${flag.flag_reason}`,
        value: `User: <@${flag.user_id}>\nType: ${flag.content_type}\nDate: ${date}`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handleAudit(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const limit = interaction.options.getInteger('limit') || 20;

    const AuditLogger = require('../../services/security/AuditLogger');
    const logs = await AuditLogger.getRecentActions(limit);

    if (logs.length === 0) {
      await interaction.editReply('No audit logs found.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle('Recent Admin Actions')
      .setDescription(`Last ${logs.length} actions`);

    for (const log of logs.slice(0, 15)) {
      const date = new Date(log.created_at).toLocaleString();
      const target = log.target_user_id ? `<@${log.target_user_id}>` : 'N/A';
      
      embed.addFields({
        name: `${log.action_type} - ${date}`,
        value: `Admin: <@${log.admin_id}>\nTarget: ${target}`,
        inline: true
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handleExport(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');

    const GDPRExporter = require('../../services/compliance/GDPRExporter');
    const exporter = new GDPRExporter();

    const result = await exporter.exportUserData(user.id, interaction.user.id);

    if (result.success) {
      // Send as JSON file
      const jsonData = JSON.stringify(result.data, null, 2);
      const buffer = Buffer.from(jsonData);

      await interaction.editReply({
        content: `Data export for ${user.tag} completed.`,
        files: [{
          attachment: buffer,
          name: `user-data-${user.id}-${Date.now()}.json`
        }]
      });
    } else {
      await interaction.editReply(`Export failed: ${result.error}`);
    }
  },

  async handleBackup(interaction, services) {
    await interaction.deferReply({ ephemeral: true });

    const BackupManager = require('../../services/backup/BackupManager');
    const config = require('../../config/settings');
    const backupManager = new BackupManager(config);

    await interaction.editReply('Starting database backup...');

    const result = await backupManager.createBackup();

    if (result.success) {
      await interaction.editReply(
        `Backup completed!\nFile: ${result.filename}\nSize: ${result.size} MB`
      );
    } else {
      await interaction.editReply(`Backup failed: ${result.error}`);
    }
  }
};

