// ═══════════════════════════════════════════════════════════════════════════════
// Barbie View Modal Submit Handler
// customId: barbie-view-modal
// fields:
// - barbie_view_id
// ═══════════════════════════════════════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');
const config = require('../../config/settings');

module.exports = {
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const rawId = interaction.fields.getTextInputValue('barbie_view_id');
      const contactId = parseInt(String(rawId || '').trim(), 10);

      if (!contactId || Number.isNaN(contactId)) {
        await interaction.editReply('❌ Invalid Contact ID.');
        return;
      }

      const BarbieListManager = require('../../services/barbie/BarbieListManager');
      const manager = new BarbieListManager();

      const contact = await manager.getContact(contactId, interaction.user.id);

      if (!contact) {
        await interaction.editReply('Contact not found.');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(config.branding.colorHex)
        .setTitle(contact.contact_name)
        .addFields(
          {
            name: 'Vibe Rating',
            value: contact.vibe_rating ? `${contact.vibe_rating}/10` : 'Not rated',
            inline: true
          },
          {
            name: 'Met At',
            value: contact.met_location || 'Unknown',
            inline: true
          }
        );

      if (contact.phone_number) {
        embed.addFields({ name: 'Phone', value: contact.phone_number, inline: true });
      }

      // Privacy guard (igual que tu comando)
      const isPublicChannel = interaction.channel && interaction.channel.type === 0;
      if (contact.instagram_handle) {
        if (contact.is_private && isPublicChannel) {
          embed.addFields({ name: 'Instagram', value: '🔒 Private — IG hidden in public channel', inline: true });
        } else {
          embed.addFields({ name: 'Instagram', value: `@${contact.instagram_handle}`, inline: true });
        }
      }

      if (contact.notes) {
        embed.addFields({
          name: 'Notes',
          value: contact.notes.substring(0, 1024),
          inline: false
        });
      }

      if (contact.next_action) {
        embed.addFields({
          name: 'Next Action',
          value: contact.next_action,
          inline: false
        });
      }

      const mediaCount = await manager.getInstagramMediaCount(contactId);
      if (mediaCount > 0) {
        const recentMedia = await manager.getInstagramMedia(contactId, 1);
        const lastUploadTime = recentMedia[0] ? new Date(recentMedia[0].uploaded_at) : null;

        if (!contact.is_private || !isPublicChannel) {
          const timeAgo = lastUploadTime ? `<t:${Math.floor(lastUploadTime.getTime() / 1000)}:R>` : 'unknown';
          embed.addFields({
            name: '📸 Instagram Screenshots',
            value: `${mediaCount} screenshot(s) uploaded • Latest: ${timeAgo}`,
            inline: false
          });
        } else {
          embed.addFields({
            name: '📸 Instagram Screenshots',
            value: '🔒 Media hidden in public channel',
            inline: false
          });
        }
      }

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`barbie-opener:${contactId}`)
          .setLabel('Get Opener Suggestion')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`barbie-delete:${contactId}`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (err) {
      logger.error('BarbieViewModal: failed', { error: err?.message, stack: err?.stack });
      await interaction.editReply('❌ Failed to load contact.').catch(() => {});
    }
  }
};
