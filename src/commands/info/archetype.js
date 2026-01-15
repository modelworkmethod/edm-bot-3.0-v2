const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  generateArchetypeBar,
  getArchetypeIcon,
  getArchetypeColor,
  calculateMovementVolatility
} = require('../../utils/archetypeVisuals');

const settings = require('../../config/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('archetype')
    .setDescription('Learn about your archetype and how the system works'),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;

      // Get services
      const ArchetypeService = require('../../services/user/ArchetypeService');
      const UserRepository = require('../../database/repositories/UserRepository');

      const archetypeService = new ArchetypeService();
      const userRepository = new UserRepository();

      // Get user data
      const user = await userRepository.findByUserId(userId);
      if (!user) {
        return interaction.reply({
          content: '❌ You need to submit stats first! Use `/submit-stats`',
          ephemeral: true
        });
      }

      // Calculate archetype
      const archetypeData = await archetypeService.calculateUserArchetype(userId);
      const {
        archetype,
        warriorPercent,
        magePercent,
        isBalanced,
        rawPoints,
        totalActionPoints
      } = archetypeData;

      // Get visuals
      const icon = getArchetypeIcon(archetype);
      const color = getArchetypeColor(archetype);
      const visualBar = generateArchetypeBar(warriorPercent, magePercent);

      // Get volatility info
      const totalXP = user.total_xp || user.xp || 0;
      const volatility = calculateMovementVolatility(totalXP);

      // ✅ 3 FIELDS FOR CURRENT BALANCE (as requested)
      const balanceBarField = {
        name: '⚖️ Current Balance — Bar',
        value: `${visualBar}`,
        inline: false
      };

      const balancePercentsField = {
        name: '📈 Current Balance — Percent',
        value:
          `⚔️ Warrior: **${warriorPercent.toFixed(1)}%**\n` +
          `🔮 Mage: **${magePercent.toFixed(1)}%**`,
        inline: true
      };

      const balanceStatusField = {
        name: '🎯 Current Balance — Status',
        value: isBalanced
          ? '✅ **Templar Zone (40–60% Mage)**'
          : '⚠️ **Out of balance**',
        inline: true
      };

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${icon} Your Archetype: ${archetype}`)
        .setDescription('Your archetype represents your balance between **Action** and **Inner Work**.')
        .addFields(
          // ✅ Current Balance (3 fields)
          balanceBarField,
          balancePercentsField,
          balanceStatusField,

          // Keep the rest as-is (you can adjust later if client asks)
          {
            name: '📊 Raw Archetype Points',
            value:
              `⚔️ Warrior: **${rawPoints.warrior.toFixed(1)}**\n` +
              `🔮 Mage: **${rawPoints.mage.toFixed(1)}**\n` +
              `⚖️ Templar: **${rawPoints.templar.toFixed(1)}**\n` +
              `Total: ${totalActionPoints.toFixed(1)} points`,
            inline: true
          },
          {
            name: `${volatility.emoji} Movement Speed`,
            value:
              `**${volatility.description}**\n` +
              `Dampening: ${volatility.percentage}%\n` +
              `Based on ${totalXP.toLocaleString()} XP`,
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: false
          },
          {
            name: '⚔️ Warrior Path (<40% Mage)',
            value:
              '**Action-Dominant**\n' +
              '• Approaches & Numbers\n' +
              '• Dates & Field Work\n' +
              '• Social Interactions\n' +
              '• High energy output',
            inline: true
          },
          {
            name: '🔮 Mage Path (>60% Mage)',
            value:
              '**Inner Work-Dominant**\n' +
              '• SBMM Meditation\n' +
              '• Grounding & Releasing\n' +
              '• CTJ & Course Work\n' +
              '• Deep reflection',
            inline: true
          },
          {
            name: '⚖️ Templar Path (40-60% Mage)',
            value:
              '**Balanced Integration**\n' +
              '• **+30% XP bonus** 🎁\n' +
              '• Maximum momentum\n' +
              '• Sustainable growth\n' +
              '• **Target archetype**',
            inline: true
          },
          {
            name: '📖 How It Works',
            value:
              'Each stat you submit has **Warrior** and **Mage** weights. Action stats (approaches, dates) ' +
              'increase Warrior points. Inner work (meditation, grounding) increases Mage points.\n\n' +
              '**Your archetype** is determined by: `Mage % = (Mage Points / Total Points) × 100`\n\n' +
              '**Movement Speed:** New players shift archetypes quickly (volatile). Veterans shift slowly ' +
              '(stable) as their patterns are established.',
            inline: false
          },
          {
            name: '🎯 Your Goal',
            value: isBalanced
              ? '✅ **You\'re in Templar balance!** Keep up the momentum by maintaining 40-60% Mage through balanced action and inner work.'
              : '⚠️ **You\'re out of balance!** ' +
                (archetype === 'Warrior'
                  ? 'Do more inner work (SBMM, Grounding, CTJ) to return to Templar.'
                  : 'Take more action (Approaches, Numbers, Dates) to return to Templar.'),
            inline: false
          }
        )
        .setFooter({ text: 'Strive for Templar balance for maximum power! ⚖️' })
        .setTimestamp();

      // ✅ POST MOSTLY TO SCOREBOARD CHANNEL
      const channelsCfg = settings?.channels || {};

      const scoreboardChannelId =
        channelsCfg.scoreboardChannelId ||
        channelsCfg.scoreboard_channel_id ||
        channelsCfg.SCOREBOARD_CHANNEL_ID ||
        channelsCfg.leaderboardChannelId || // fallback common
        channelsCfg.LEADERBOARD_CHANNEL_ID ||
        null;

      let targetChannel = interaction.channel;

      if (scoreboardChannelId) {
        try {
          const ch = await interaction.client.channels.fetch(scoreboardChannelId);
          if (ch && typeof ch.send === 'function') targetChannel = ch;
        } catch {
          // fallback to interaction.channel
        }
      }

      // Send embed to scoreboard (or current channel if not configured)
      await targetChannel.send({ embeds: [embed] });

      // Confirm to user (ephemeral)
      const where =
        (targetChannel && targetChannel.id && interaction.guild?.channels?.cache?.get?.(targetChannel.id))
          ? `<#${targetChannel.id}>`
          : 'the scoreboard channel';

      await interaction.reply({
        content: `✅ Posted your archetype card in ${where}.`,
        ephemeral: true
      });

    } catch (error) {
      console.error('[/archetype command error]:', error);
      await interaction.reply({
        content: '❌ Error fetching archetype data. Please try again.',
        ephemeral: true
      });
    }
  }
};
