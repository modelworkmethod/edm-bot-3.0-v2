const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('BarbieMenuViewButton');

module.exports = {
  async execute(interaction) {
    try {
      const modal = new ModalBuilder()
        .setCustomId('barbie-view-modal')
        .setTitle('View Contact');

      const idInput = new TextInputBuilder()
        .setCustomId('barbie_view_id')
        .setLabel('Contact ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Example: 12');

      modal.addComponents(new ActionRowBuilder().addComponents(idInput));

      // Importante: NO defer aquí, solo showModal
      await interaction.showModal(modal);
    } catch (err) {
      logger.error('Failed to show view modal', { error: err.message });

      const msg = err?.message || '';
      const code = err?.code;
      if (
        code === 10062 ||
        code === 40060 ||
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged')
      ) return;

      await interaction.reply({
        content: '❌ Could not open View modal. Try again.',
        flags: 1 << 6
      }).catch(() => {});
    }
  }
};
