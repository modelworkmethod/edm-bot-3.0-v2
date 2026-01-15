// ═══════════════════════════════════════════════════════════════════════════════
// /tenseylist command - Display user's challenge checklist
// ═══════════════════════════════════════════════════════════════════════════════

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const TenseyProgressService = require('../services/TenseyProgressService');
const ChecklistEmbedBuilder = require('../embeds/ChecklistEmbedBuilder');

// Meta de niveles para el mensaje de instrucciones
const LEVEL_META = {
  1: {
    emoji: '🌱',
    title: 'Level 1: Basic Approach & Warm-Up',
    subtitle: 'Foundation exercises for social freedom and grounded presence.',
    tips: [
      'Social Freedom Exercises • +100 XP per challenge',
      'Tenseys are social freedom exercises—the foundation of real comfort in your skin and natural spontaneity. XP is auto-tracked when you complete them; no need to log in /submit-stats.',
      'How to practice:',
      'Start with 1–3 daily',
      'Stay in your body—belly breathe, feel your feet, don’t retreat into your head',
      'Notice sensations during interactions: release on what came up afterwards (counts as In Action Release)',
      'Repeat exercises as needed, but XP degrades with each repeat',
      'Hit UNDO if you misclick'
    ]
  }
  // Si luego quieres textos distintos por nivel, los agregas aquí:
  // 2: { ... }, 3: { ... }, etc.
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tenseylist')
    .setDescription('View and track your Tensey challenge progress'),

  async execute(interaction) {
    try {
      // Get user progress from the service
      let rawProgress;
      try {
        rawProgress = await TenseyProgressService.getUserProgress(interaction.user.id);
      } catch (err) {
        console.warn('tenseylist: error getting user progress, using empty []', {
          userId: interaction.user.id,
          error: err.message,
        });
        rawProgress = [];
      }

      // Normalizamos a un array de índices completados
      let completedIndices = [];
      if (Array.isArray(rawProgress)) {
        completedIndices = rawProgress;
      } else if (Array.isArray(rawProgress?.completedChallenges)) {
        completedIndices = rawProgress.completedChallenges;
      } else if (Array.isArray(rawProgress?.completed)) {
        completedIndices = rawProgress.completed;
      } else {
        completedIndices = [];
      }

      // Forzamos a enteros válidos >= 0
      completedIndices = completedIndices
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v >= 0);

      // Build the checklist embed and components (page 0)
      const { embed, components } = ChecklistEmbedBuilder.build(0, completedIndices);

      // Instrucciones del nivel actual (por ahora asumimos Level 1)
      const level = 1;
      const meta = LEVEL_META[level] || LEVEL_META[1];

      const tipsLines = [
        `${meta.emoji} **${meta.title}**`,
        meta.subtitle,
        '',
        '💡 **Tips**',
        ...meta.tips.map((t) => `• ${t}`)
      ];

      const tipsEmbed = new EmbedBuilder()
        .setColor(0xFFB347) // un color diferente para destacar las instrucciones
        .setTitle('How to Use Your Tensey List')
        .setDescription(tipsLines.join('\n'));

      // Un solo reply con 2 embeds (checklist + instrucciones)
      await interaction.reply({
        embeds: [embed, tipsEmbed],
        components
      });

    } catch (error) {
      const msg = error?.message || '';
      const code = error?.code;

      if (code === 10062 || /Unknown interaction/i.test(msg)) {
        console.warn('tenseylist: interaction invalid, skipping reply', {
          code,
          msg,
        });
        return;
      }

      console.error('tenseylist command error:', error);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Failed to load Tensey challenges. Please try again.',
          });
        } else {
          await interaction.editReply({
            content: '❌ Failed to load Tensey challenges. Please try again.',
            embeds: [],
            components: [],
          });
        }
      } catch (replyErr) {
        console.error('tenseylist: failed to send error reply:', replyErr);
      }
    }
  },
};
