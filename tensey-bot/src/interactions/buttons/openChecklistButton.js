// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Open checklist button handler
// ═══════════════════════════════════════════════════════════════════════════════

const ChecklistService = require('../../services/ChecklistService');
const ChecklistEmbedBuilder = require('../../embeds/ChecklistEmbedBuilder');

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const pageData = ChecklistService.getChecklistPage(userId, 0);
    
    const embed = ChecklistEmbedBuilder.buildChecklistEmbed(pageData);
    const buttons = ChecklistEmbedBuilder.buildNavigationButtons(pageData);
    
    await interaction.reply({
      embeds: [embed],
      components: buttons,
      ephemeral: true
    });
  }
};

