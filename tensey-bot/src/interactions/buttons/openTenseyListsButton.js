// tensey-bot/src/interactions/buttons/openTenseyListsButton.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/environment');
const { BRAND } = require('../../config/constants');

function safeImage(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith('http')) return null;
    return url;
  } catch {
    return null;
  }
}

async function safeEphemeralReply(interaction, payload) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 1 << 6 }); // ephemeral
    }
  } catch {}

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
      return true;
    }
  } catch {}

  try {
    await interaction.reply({ ...payload, flags: 1 << 6 });
    return true;
  } catch {}

  return false;
}

module.exports = {
  async execute(interaction) {
    // IMPORTANT:
    // This view is user-specific and should NOT overwrite the persistent channel message.
    // So we answer ephemerally (deferReply + editReply).
    const embed = new EmbedBuilder()
      .setColor(BRAND.primary)
      .setTitle('🔥 TENSEY LISTS 🔥')
      .setDescription('Choose which list you want to open.');

    // Banner (same as open button, ok)
    const banner = safeImage(config.BANNER_URL_OPEN_BUTTON);
    if (banner) embed.setImage(banner);

    // ✅ Buttons for ALL LISTS view
    // - DO NOT use checklist_nav_open here (that ID is reserved for the persistent "Open My Tensey List" button)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('tensey_open_checklist') // ✅ NEW: opens checklist page 0
        .setLabel('✅ Open Checklist (Challenges)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tensey_open_lists') // optional self-refresh (keeps you on this UI)
        .setLabel('📋 Refresh Lists')
        .setStyle(ButtonStyle.Secondary)
    );

    await safeEphemeralReply(interaction, { embeds: [embed], components: [row1] });
  },
};
