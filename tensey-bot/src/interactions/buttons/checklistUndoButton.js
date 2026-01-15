// ═══════════════════════════════════════════════════════════════════════════════
// Checklist undo button handler - Reverse last completion
// ═══════════════════════════════════════════════════════════════════════════════

const TenseyProgressService = require('../../services/TenseyProgressService');
const ChecklistEmbedBuilder = require('/../../embeds/ChecklistEmbedBuilder');
const { challenges } = require('../../config/challenges');

module.exports = {
  async execute(interaction) {
    try {
      // Undo last completion
      const undone = await TenseyProgressService.undoLastCompletion(interaction.user.id);

      if (!undone) {
        // No update here (button still needs an ACK) -> safest is ephemeral reply
        await interaction.reply({
          content: '❌ Nothing to undo! You haven’t completed any challenges yet.',
          flags: 1 << 6
        }).catch(() => {});
        return;
      }

      const undoneIdx = Number(undone.challengeIdx);
      const page = Math.max(0, Math.min(56, Math.floor(undoneIdx / 10)));

      // Get updated progress
      const userProgress = TenseyProgressService.getUserProgress(interaction.user.id);

      // Rebuild embed on the page that contains the undone challenge
      const { embed, components } = ChecklistEmbedBuilder.build(page, userProgress);

      // Update the checklist message (ACK)
      await interaction.update({
        embeds: [embed],
        components
      });

      // Confirmation (ephemeral)
      const challenge = challenges[undoneIdx];
      const count = TenseyProgressService.getCompletionCount(interaction.user.id);
      const total = challenges.length || 567;

      const text = challenge?.text ? `"${challenge.text}"` : '';

      await interaction.followUp({
        content: `↩️ **Undid Challenge ${undoneIdx + 1}**\n${text}\n\n📊 New Progress: **${count}/${total}**`,
        flags: 1 << 6
      }).catch(() => {});
    } catch (error) {
      console.error('Undo button error:', error);

      // If update already happened, reply may fail; fallback to followUp
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: '❌ An error occurred. Please try again.',
            flags: 1 << 6
          });
        } else {
          await interaction.reply({
            content: '❌ An error occurred. Please try again.',
            flags: 1 << 6
          });
        }
      } catch {}
    }
  }
};
