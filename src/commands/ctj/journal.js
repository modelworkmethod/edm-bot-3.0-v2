/**
 * Journal Command
 * Opens modal for Confidence-Tension Journal entry
 */

const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('JournalCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('journal')
    .setDescription('Record a Confidence-Tension Journal entry'),

  async execute(interaction, services) {
    try {
      // ❗ IMPORTANTE:
      // - No usamos deferReply aquí.
      // - Para modals, siempre se usa showModal directamente sobre la interacción.

      const modal = new ModalBuilder()
        .setCustomId('ctj:add-entry') // <- debe coincidir con el handler en modalHandler.js
        .setTitle('Confidence-Tension Journal');

      // Date field (optional)
      const dateInput = new TextInputBuilder()
        .setCustomId('date')
        .setLabel('Date (optional, defaults to today)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('YYYY-MM-DD')
        .setRequired(false);

      // Confidence field
      const confidenceInput = new TextInputBuilder()
        .setCustomId('confidence')
        .setLabel('Confidence Level (1-10)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 7')
        .setRequired(true);

      // Tension field
      const tensionInput = new TextInputBuilder()
        .setCustomId('tension')
        .setLabel('Tension Level (1-10)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 4')
        .setRequired(true);

      // Notes field
      const notesInput = new TextInputBuilder()
        .setCustomId('notes')
        .setLabel('Journal Notes')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('What happened today? Any breakthroughs or insights?')
        .setRequired(false)
        .setMaxLength(2000);

      // Add inputs to modal
      modal.addComponents(
        new ActionRowBuilder().addComponents(dateInput),
        new ActionRowBuilder().addComponents(confidenceInput),
        new ActionRowBuilder().addComponents(tensionInput),
        new ActionRowBuilder().addComponents(notesInput)
      );

      await interaction.showModal(modal);

      logger.debug('JournalCommand: journal modal shown', {
        userId: interaction.user.id,
      });
    } catch (error) {
      const msg = error?.message || '';
      const code = error?.code;

      logger.error('JournalCommand: Failed to show journal modal', {
        error: msg,
      });

      const isInteractionStateError =
        code === 10062 || // Unknown interaction
        code === 40060 || // Interaction already acknowledged
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged');

      if (isInteractionStateError) {
        logger.warn(
          'JournalCommand: interaction invalid while showing modal',
          { code, message: msg }
        );
        return;
      }

      // Si el problema es otro (no de estado), intentamos mandar un mensaje de error
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: 'Failed to open journal form. Please try again.',
            flags: 1 << 6, // ephemeral
          });
        }
      } catch (replyErr) {
        logger.warn('JournalCommand: failed to send error reply', {
          error: replyErr.message,
        });
      }
    }
  },
};
