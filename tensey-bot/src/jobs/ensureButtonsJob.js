// ═══════════════════════════════════════════════════════════════════════════════
// Ensure buttons job - maintains persistent buttons in channels
// ═══════════════════════════════════════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/environment');
const ArtifactsRepository = require('../database/repositories/ArtifactsRepository');
const ChannelFinder = require('../utils/channelFinder');
const logger = require('../utils/logger');
const { BRAND } = require('../config/constants');

/**
 * Validate and return a safe image URL or null
 * @param {string} url
 * @returns {string|null}
 */
function getSafeImageUrl(url) {
  if (!url) return null;
  if (typeof url !== 'string') return null;
  if (url.includes('your-banner-url')) return null;

  try {
    const u = new URL(url);
    if (!u.protocol.startsWith('http')) return null;
    return url;
  } catch {
    return null;
  }
}

class EnsureButtonsJob {
  /**
   * Entry point for the job
   * @param {import('discord.js').Client} client
   */
  static async run(client) {
    try {
      const guild = await client.guilds.fetch(config.GUILD_ID);
      await this.ensureOpenButton(guild);
      await this.ensureLeaderboardButton(guild);

      logger.info('✓ Button ensurer started');
    } catch (err) {
      logger.error('Failed to ensure buttons', { error: err.message, stack: err.stack });
    }
  }

  /**
   * Create button to open "Tensey Lists" (ALL LISTS HOME)
   */
  static async ensureOpenButton(guild) {
    if (!config.TENSEYLIST_CHANNEL_ID) {
      logger.warn('EnsureButtonsJob: TENSEYLIST_CHANNEL_ID not set, skipping open button');
      return;
    }

    const channel = await ChannelFinder.findChannel(guild.client, config.TENSEYLIST_CHANNEL_ID);

    if (!channel) {
      logger.warn('EnsureButtonsJob: Tenseylist channel not found', {
        channelId: config.TENSEYLIST_CHANNEL_ID,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(BRAND.primary)
      .setTitle('🔥 OPEN YOUR TENSEY LISTS 🔥')
      .setDescription('Click below to open the **Tensey Lists** hub (all lists).');

    const openBanner = getSafeImageUrl(config.BANNER_URL_OPEN_BUTTON);
    if (openBanner) embed.setImage(openBanner);

    // ✅ IMPORTANT: this must NOT start with "checklist_"
    // so it won't open the checklist UI.
    const EXPECTED_OPEN_CUSTOM_ID = 'tensey_open_lists';

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(EXPECTED_OPEN_CUSTOM_ID)
        .setLabel('🔥 OPEN MY TENSEY LIST 🔥')
        .setStyle(ButtonStyle.Danger)
    );

    // ✅ try reuse existing message
    let artifacts = null;
    try {
      if (typeof ArtifactsRepository.getArtifacts === 'function') {
        artifacts = await ArtifactsRepository.getArtifacts(guild.id);
      }
    } catch (e) {
      logger.warn('EnsureButtonsJob: getArtifacts failed', { error: e?.message });
    }

    const existingChannelId = artifacts?.open_channel_id;
    const existingMessageId = artifacts?.open_message_id;

    if (existingChannelId && existingMessageId) {
      try {
        const existingChannel = await ChannelFinder.findChannel(guild.client, existingChannelId);
        if (existingChannel) {
          const msg = await existingChannel.messages.fetch(existingMessageId);

          if (msg) {
            // ✅ if old button customId is wrong, recreate message
            const firstRow = msg.components?.[0];
            const firstBtn = firstRow?.components?.[0];
            const foundCustomId = firstBtn?.customId;

            if (foundCustomId && foundCustomId !== EXPECTED_OPEN_CUSTOM_ID) {
              logger.warn('EnsureButtonsJob: old open button message had wrong customId, re-creating', {
                foundCustomId,
                expected: EXPECTED_OPEN_CUSTOM_ID,
              });

              try {
                await msg.delete().catch(() => {});
              } catch {}

              // fall through to create new
            } else {
              await msg.edit({ embeds: [embed], components: [row] });

              if (config.PIN_TENSEY_BUTTON) {
                try {
                  await msg.pin();
                } catch {}
              }

              logger.info('✓ Open button persistent message updated (edit)');
              return;
            }
          }
        }
      } catch (e) {
        logger.warn('EnsureButtonsJob: existing open message not found, will re-create', {
          error: e?.message,
          existingChannelId,
          existingMessageId,
        });
      }
    }

    // Create new if no existing (or recreated)
    const message = await channel.send({ embeds: [embed], components: [row] });

    if (config.PIN_TENSEY_BUTTON) {
      try {
        await message.pin();
      } catch {}
    }

    try {
      await ArtifactsRepository.setArtifacts(guild.id, {
        open_channel_id: channel.id,
        open_message_id: message.id,
      });
    } catch (e) {
      logger.warn('EnsureButtonsJob: setArtifacts failed', { error: e?.message });
    }

    logger.info('✓ Open button persistent message created (send)');
  }

  /**
   * Create button to open leaderboard
   */
  static async ensureLeaderboardButton(guild) {
    if (!config.LEADERBOARD_CHANNEL_ID) {
      logger.warn('EnsureButtonsJob: LEADERBOARD_CHANNEL_ID not set, skipping leaderboard button');
      return;
    }

    const channel = await ChannelFinder.findChannel(guild.client, config.LEADERBOARD_CHANNEL_ID);

    if (!channel) {
      logger.warn('EnsureButtonsJob: Leaderboard channel not found', {
        channelId: config.LEADERBOARD_CHANNEL_ID,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(BRAND.accent)
      .setTitle('🏆 XP Leaderboard 🏆')
      .setDescription('Live rankings. Click **Refresh** to update.');

    const lbBanner = getSafeImageUrl(config.BANNER_URL_LEADERBOARD);
    if (lbBanner) embed.setImage(lbBanner);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('refresh-leaderboard').setLabel('Refresh').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('view-my-scorecard').setLabel('My Scorecard').setStyle(ButtonStyle.Secondary)
    );

    // ✅ intentar reutilizar mensaje existente
    let artifacts = null;
    try {
      if (typeof ArtifactsRepository.getArtifacts === 'function') {
        artifacts = await ArtifactsRepository.getArtifacts(guild.id);
      }
    } catch (e) {
      logger.warn('EnsureButtonsJob: getArtifacts failed', { error: e?.message });
    }

    const existingChannelId = artifacts?.open_lb_channel_id;
    const existingMessageId = artifacts?.open_lb_message_id;

    if (existingChannelId && existingMessageId) {
      try {
        const existingChannel = await ChannelFinder.findChannel(guild.client, existingChannelId);
        if (existingChannel) {
          const msg = await existingChannel.messages.fetch(existingMessageId);
          if (msg) {
            await msg.edit({ embeds: [embed], components: [row] });
            if (config.PIN_LEADERBOARD_BUTTON) {
              try {
                await msg.pin();
              } catch {}
            }
            logger.info('✓ Leaderboard persistent message updated (edit)');
            return;
          }
        }
      } catch (e) {
        logger.warn('EnsureButtonsJob: existing leaderboard message not found, will re-create', {
          error: e?.message,
          existingChannelId,
          existingMessageId,
        });
      }
    }

    const message = await channel.send({ embeds: [embed], components: [row] });

    if (config.PIN_LEADERBOARD_BUTTON) {
      try {
        await message.pin();
      } catch {}
    }

    try {
      await ArtifactsRepository.setArtifacts(guild.id, {
        open_lb_channel_id: channel.id,
        open_lb_message_id: message.id,
      });
    } catch (e) {
      logger.warn('EnsureButtonsJob: setArtifacts failed', { error: e?.message });
    }

    logger.info('✓ Leaderboard persistent message created (send)');
  }
}

module.exports = EnsureButtonsJob;
