// ═══════════════════════════════════════════════════════════════════════════════
// EnsureBarbieMenuJob - creates/updates a persistent Barbie Menu card in a channel
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createLogger } = require('../utils/logger');
const config = require('../config/settings');

const logger = createLogger('EnsureBarbieMenuJob');

const ARTIFACTS_PATH = path.join(__dirname, '_barbie_menu_artifacts.json');

function readArtifacts() {
  try {
    if (!fs.existsSync(ARTIFACTS_PATH)) return {};
    return JSON.parse(fs.readFileSync(ARTIFACTS_PATH, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeArtifacts(obj) {
  try {
    fs.writeFileSync(ARTIFACTS_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    logger.warn('Failed to write Barbie artifacts', { error: e?.message });
  }
}

function buildStaticEmbed() {
  return new EmbedBuilder()
    .setColor(config.branding.colorHex)
    .setTitle('💅 Barbie Menu')
    .setDescription('Quick actions for your contact list.\n\nUse the buttons below:')
    .setFooter({ text: 'Tap a button to open your private menu.' });
}

function buildStaticRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('barbie-menu:add')
      .setLabel('➕ Add Barbie')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('barbie-menu:list')
      .setLabel('📋 List')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('barbie-menu:view')
      .setLabel('🔎 View')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('barbie-menu:reminders')
      .setLabel('⏰ Reminders')
      .setStyle(ButtonStyle.Secondary)
  );
}

class EnsureBarbieMenuJob {
  static async run(client) {
    try {
      const channelId =
        process.env.BARBIE_MENU_CHANNEL_ID ||
        config?.channels?.BARBIE_MENU_CHANNEL_ID ||
        config?.BARBIE_MENU_CHANNEL_ID;

      if (!channelId) {
        logger.warn('BARBIE_MENU_CHANNEL_ID not set. Skipping Barbie static card.');
        return;
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        logger.warn('Barbie menu channel not found', { channelId });
        return;
      }

      const embed = buildStaticEmbed();
      const row = buildStaticRow();

      const artifacts = readArtifacts();
      const existingMsgId = artifacts?.message_id;

      // Try edit existing message
      if (existingMsgId) {
        try {
          const msg = await channel.messages.fetch(existingMsgId);
          if (msg) {
            await msg.edit({ embeds: [embed], components: [row] });
            logger.info('✓ Barbie static card updated (edit)', { channelId, messageId: existingMsgId });

            // Optional pin
            if (process.env.PIN_BARBIE_MENU === 'true') {
              try { await msg.pin(); } catch {}
            }

            return;
          }
        } catch (e) {
          logger.warn('Existing Barbie message not found, will re-create', {
            error: e?.message,
            channelId,
            messageId: existingMsgId
          });
        }
      }

      // Create new message
      const msg = await channel.send({ embeds: [embed], components: [row] });
      writeArtifacts({ channel_id: channelId, message_id: msg.id });

      // Optional pin
      if (process.env.PIN_BARBIE_MENU === 'true') {
        try { await msg.pin(); } catch {}
      }

      logger.info('✓ Barbie static card created (send)', { channelId, messageId: msg.id });
    } catch (err) {
      logger.error('EnsureBarbieMenuJob failed', { error: err?.message, stack: err?.stack });
    }
  }
}

module.exports = EnsureBarbieMenuJob;
