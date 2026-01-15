/**
 * Course Command
 * Access and navigate the course content
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('CourseCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('course')
    .setDescription('Access course modules')
    .addSubcommand(subcommand =>
      subcommand
        .setName('overview')
        .setDescription('View all course modules')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('module')
        .setDescription('View a specific module')
        .addIntegerOption(option =>
          option
            .setName('number')
            .setDescription('Module number (1-7)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(7)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('progress')
        .setDescription('View your course progress')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('watch')
        .setDescription('Mark a video as watched')
        .addIntegerOption(option =>
          option
            .setName('video-id')
            .setDescription('Video ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ask')
        .setDescription('Ask a question about course content')
    ),

  async execute(interaction, services) {
    const subcommand = interaction.options.getSubcommand();

    // Important:  No deferReply here globally.
    // eachd handler decides whether to deferReply or showModal.

    if (subcommand === 'overview') {
      return this.handleOverview(interaction, services);
    } else if (subcommand === 'module') {
      return this.handleModule(interaction, services);
    } else if (subcommand === 'progress') {
      return this.handleProgress(interaction, services);
    } else if (subcommand === 'watch') {
      return this.handleWatch(interaction, services);
    } else if (subcommand === 'ask') {
      return this.handleAsk(interaction, services);
    }
  },

  async handleOverview(interaction, services) {
    // use flags instead of ephemeral
    await interaction.deferReply({ flags: 1 << 6 });

    const modules = await services.courseManager.getModulesForUser(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle('📚 Course Modules')
      .setDescription('Your pathway to mastery')
      .setFooter({ text: config.branding.name });

    for (const module of modules) {
      const statusEmoji =
        module.progress.status === 'completed'
          ? '✅'
          : module.progress.status === 'in_progress'
          ? '🔄'
          : module.isUnlocked
          ? '🔓'
          : '🔒';

      const progressText =
        module.progress.completion_percentage > 0
          ? `${module.progress.completion_percentage}% complete`
          : module.isUnlocked
          ? 'Not started'
          : 'Locked';

      embed.addFields({
        name: `${statusEmoji} Module ${module.module_number}: ${module.title}`,
        value: [
          module.description.substring(0, 100),
          `${module.total_videos} videos • ${module.estimated_duration_minutes}min`,
          progressText
        ].join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handleModule(interaction, services) {
    await interaction.deferReply({ flags: 1 << 6 });

    const moduleNumber = interaction.options.getInteger('number');

    // Get module by number
    const { queryRow } = require('../../database/postgres');
    const module = await queryRow(
      'SELECT * FROM course_modules WHERE module_number = $1',
      [moduleNumber]
    );

    if (!module) {
      await interaction.editReply('Module not found.');
      return;
    }

    const moduleData = await services.courseManager.getModule(
      module.id,
      interaction.user.id
    );
    const user = await services.userService.getUser(interaction.user.id);
    const isUnlocked = await services.courseManager.checkModuleUnlock(user, module);

    if (!isUnlocked) {
      const requirements = module.unlock_requirements || {};
      let reqText = 'Requirements:\n';
      if (requirements.level) reqText += `• Level ${requirements.level}\n`;
      if (requirements.xp) reqText += `• ${requirements.xp} XP\n`;
      if (requirements.previous_module)
        reqText += `• Complete Module ${requirements.previous_module}\n`;

      await interaction.editReply({
        content: `🔒 Module ${moduleNumber} is locked.\n\n${reqText}`
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle(`Module ${moduleNumber}: ${moduleData.title}`)
      .setDescription(moduleData.description)
      .addFields({
        name: 'Progress',
        value: `${moduleData.progress.completion_percentage}% complete (${moduleData.progress.videos_watched}/${moduleData.total_videos} videos)`,
        inline: false
      });

    // List videos
    if (moduleData.videos.length > 0) {
      const videoList = moduleData.videos
        .map(v => {
          const watched = v.progress.watched ? '✅' : '⭕';
          return `${watched} **Video ${v.video_number}:** ${v.title} (${v.duration_minutes}min)`;
        })
        .join('\n');

      embed.addFields({
        name: 'Videos',
        value: videoList,
        inline: false
      });
    }

    const buttons = new ActionRowBuilder();

    if (
      moduleData.progress.status !== 'in_progress' &&
      moduleData.progress.status !== 'completed'
    ) {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`course-start-module:${module.id}`)
          .setLabel('Start Module')
          .setStyle(ButtonStyle.Primary)
      );
    }

    if (moduleData.videos.length > 0) {
      const nextVideo =
        moduleData.videos.find(v => !v.progress.watched) || moduleData.videos[0];
      buttons.addComponents(
        new ButtonBuilder()
          .setURL(nextVideo.video_url)
          .setLabel('Watch Next Video')
          .setStyle(ButtonStyle.Link)
      );
    }

    await interaction.editReply({
      embeds: [embed],
      components: buttons.components.length > 0 ? [buttons] : []
    });
  },

  async handleProgress(interaction, services) {
    await interaction.deferReply({ flags: 1 << 6 });

    const progress = await services.courseManager.getUserCourseProgress(
      interaction.user.id
    );

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle('Your Course Progress')
      .addFields(
        {
          name: 'Modules',
          value: `${progress.completedModules}/${progress.totalModules} completed`,
          inline: true
        },
        {
          name: 'Overall',
          value: `${progress.overallPercentage}%`,
          inline: true
        }
      )
      .setFooter({ text: 'Keep learning!' });

    await interaction.editReply({ embeds: [embed] });
  },

  async handleWatch(interaction, services) {
    await interaction.deferReply({ flags: 1 << 6 });

    const videoId = interaction.options.getInteger('video-id');

    const result = await services.courseManager.markVideoWatched(
      interaction.user.id,
      videoId
    );

    if (!result.success) {
      await interaction.editReply(`Error: ${result.error}`);
      return;
    }

    await interaction.editReply('Video marked as watched! Progress updated.');
  },

  async handleAsk(interaction, services) {
    // 👇 Took deferReply away 
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('course-ask-open')
        .setLabel('Open Question Form')
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle('Ask a Course Question')
      .setDescription(
        [
          'Use this to ask a question about any course module.',
          '',
          '👉 Click **"Open Question Form"** below to open the modal and submit your question.'
        ].join('\n')
      )
      .setFooter({ text: config.branding.name });

    try {
      await interaction.reply({
        embeds: [embed],
        components: [buttons],
        flags: 1 << 6 // ephemeral
      });
    } catch (err) {
      logger.error('CourseCommand.handleAsk: failed to send ask UI', {
        error: err.message
      });
    }
  }


};
