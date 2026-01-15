const { createLogger } = require('../../utils/logger');
const BarbieCommand = require('../../commands/barbie/barbie');

const logger = createLogger('BarbieMenuAddButton');

module.exports = {
  async execute(interaction, services) {
    try {
      // IMPORTANTE: aquí NO uses deferReply
      // Solo abre el modal inmediatamente
      await BarbieCommand.handleAdd(interaction, services);
    } catch (err) {
      logger.error('Failed to open Add Barbie modal from menu', { error: err.message });

      // Si ya es inválida, no intentes responder
      const msg = err?.message || '';
      const code = err?.code;
      if (
        code === 10062 ||
        code === 40060 ||
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged')
      ) return;

      await interaction.reply({
        content: '❌ Could not open the Add Barbie form. Please try again.',
        flags: 1 << 6
      }).catch(() => {});
    }
  }
};
