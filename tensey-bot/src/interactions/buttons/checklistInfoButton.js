// ═══════════════════════════════════════════════════════════════════════════════
// Checklist INFO button handler - Show level help
// ═══════════════════════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');

// Level help content
const LEVEL_HELP = {
  1: {
    name: 'Basic Approach & Warm-Up',
    emoji: '🌱',
    description: 'Foundation exercises for social freedom and grounded presence.',
    tips: [
      'Start with 5-10 exercises daily',
      'Focus on belly breathing and grounded presence',
      'Notice your body sensations during interactions',
      'Use UNDO if you accidentally click'
    ]
  },
  2: {
    name: 'Social Creativity & Playfulness',
    emoji: '🎨',
    description: 'Playful experiments to expand social comfort zones.',
    tips: [
      'Embrace the absurd and silly',
      'Let go of needing to look cool',
      'Dance, play pretend, and have fun',
      'Aim for 10-15 challenges daily'
    ]
  },
  3: {
    name: 'Vulnerability & Authentic Expression',
    emoji: '💎',
    description: 'Share your truth and practice emotional authenticity.',
    tips: [
      'Share embarrassing facts openly',
      'Admit when you feel nervous',
      'Practice emotional honesty',
      'Complete 8-12 daily for growth'
    ]
  },
  4: {
    name: 'Bold Social Experiments',
    emoji: '🚀',
    description: 'Push boundaries with creative social experiments.',
    tips: [
      'Embrace the weird and unusual',
      'Run fake campaigns and absurd scenarios',
      'Challenge yourself with bold moves',
      'Aim for 8-10 daily completions'
    ]
  },
  5: {
    name: 'Tension & Escalation',
    emoji: '⚡',
    description: 'Master tension, silence, and sexual energy.',
    tips: [
      'Practice 20-second silence holds',
      'Make direct attraction statements',
      'Work with sexual energy authentically',
      'Complete 6-8 challenges daily'
    ]
  },
  6: {
    name: 'Embodied Approach Foundations',
    emoji: '🧘',
    description: 'Embody sexual authenticity and pattern awareness.',
    tips: [
      'Approach with jaw relaxed',
      'Notice body sensations deeply',
      'Practice sexual authenticity',
      'Complete 6-8 challenges daily'
    ]
  },
  7: {
    name: 'Deep Integration & Mastery',
    emoji: '🎯',
    description: 'Build community and integrate all previous learning.',
    tips: [
      'Create integration circles',
      'Build long-term relationships',
      'Transform your entire life',
      'Complete 2-3 challenges weekly'
    ]
  }
};

function getLevelColor(level) {
  const colors = {
    1: 0x00FF00,
    2: 0xFF6B35,
    3: 0x6C5CE7,
    4: 0xFD79A8,
    5: 0xE74C3C,
    6: 0x00CEC9,
    7: 0x2D3436
  };
  return colors[level] || 0x000000;
}

module.exports = {
  async execute(interaction) {
    try {
      // ✅ ACK rápido y seguro: para INFO queremos responder ephemeral con un embed
      // Si ya fue acknowledged por otro handler, haremos followUp.
      const canReplyNormally = !interaction.deferred && !interaction.replied;

      if (canReplyNormally) {
        await interaction.deferReply({ flags: 1 << 6 }).catch(() => {});
      }

      // Parse level: "checklist_info_L3"
      const parts = String(interaction.customId || '').split('_');
      const levelToken = parts[2] || ''; // "L3"
      const level = Number(String(levelToken).replace('L', ''));

      const help = LEVEL_HELP[level];

      if (!help) {
        const payload = { content: `❌ Invalid level: ${levelToken}`, flags: 1 << 6 };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload).catch(async () => {
            await interaction.followUp(payload).catch(() => {});
          });
        } else {
          await interaction.reply(payload).catch(() => {});
        }
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`${help.emoji} Level ${level}: ${help.name}`)
        .setDescription(help.description)
        .setColor(getLevelColor(level))
        .addFields({
          name: '💡 Tips',
          value: help.tips.map((tip, i) => `${i + 1}. ${tip}`).join('\n').slice(0, 1024),
          inline: false
        })
        .setFooter({ text: 'Social Freedom Exercises • +100 XP per challenge' });

      // ✅ Respuesta final (segura)
      const payload = { embeds: [embed], flags: 1 << 6 };

      if (interaction.deferred) {
        await interaction.editReply(payload).catch(async () => {
          await interaction.followUp(payload).catch(() => {});
        });
      } else if (interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    } catch (error) {
      console.error('Info button error:', error);

      const payload = { content: '❌ Could not load help content.', flags: 1 << 6 };

      try {
        if (interaction.deferred) {
          await interaction.editReply(payload).catch(async () => {
            await interaction.followUp(payload).catch(() => {});
          });
        } else if (interaction.replied) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      } catch {}
    }
  }
};
