/**
 * Manual Archetype Check Trigger Command
 * Allows admins to manually trigger the daily archetype balance check
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('TriggerArchetypeCheck');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trigger-archetype-check')
    .setDescription('Manually trigger the daily archetype balance check (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      logger.info(`Manual archetype check triggered by ${interaction.user.tag}`);
      
      // Import and run the auto-flagging system
      const ArchetypeAutoFlagging = require('../../jobs/archetypeAutoFlagging');
      const autoFlagging = new ArchetypeAutoFlagging(interaction.client);
      
      // Run the check
      await autoFlagging.manualTrigger();
      
      await interaction.editReply({
        content: '✅ Archetype balance check triggered successfully!\n' +
                 'Check the coaching channel for results.\n\n' +
                 'If no message appears, it means all users are currently balanced! 🎉'
      });
      
    } catch (error) {
      logger.error('Error triggering archetype check:', error);
      await interaction.editReply({
        content: '❌ Failed to trigger archetype check.\n' +
                 'Error: ' + error.message + '\n\n' +
                 'Check console logs for details.'
      });
    }
  }
};

