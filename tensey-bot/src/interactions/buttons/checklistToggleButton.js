// ═══════════════════════════════════════════════════════════════════════════════
// Checklist toggle button handler - Mark challenges complete
// ═══════════════════════════════════════════════════════════════════════════════

const TenseyProgressService = require('../../services/TenseyProgressService');
const ChecklistEmbedBuilder = require('/../../embeds/ChecklistEmbedBuilder'); 
const { challenges } = require('../../config/challenges');

module.exports = {
  async execute(interaction) {
    try {
      // Parse custom ID: "checklist_toggle_P0_C2"
      const parts = String(interaction.customId || '').split('_');
      const pageStr = parts[2];      // "P0"
      const challengeStr = parts[3]; // "C2"

      if (!pageStr || !challengeStr || !pageStr.startsWith('P') || !challengeStr.startsWith('C')) {
        // No updates here, just ephemeral error
        await interaction.reply({
          content: '❌ Invalid toggle payload.',
          flags: 1 << 6
        }).catch(() => {});
        return;
      }

      const page = parseInt(pageStr.substring(1), 10);          // 0
      const challenge = parseInt(challengeStr.substring(1), 10); // 2

      if (!Number.isInteger(page) || !Number.isInteger(challenge)) {
        await interaction.reply({
          content: '❌ Invalid page/challenge values.',
          flags: 1 << 6
        }).catch(() => {});
        return;
      }

      // Validate page bounds (0-56) and button index (0-9)
      if (page < 0 || page > 56 || challenge < 0 || challenge > 9) {
        await interaction.reply({
          content: '❌ Invalid page/challenge bounds.',
          flags: 1 << 6
        }).catch(() => {});
        return;
      }

      // Calculate global challenge index (0-based)
      const challengeIdx = (page * 10) + challenge;

      // Validate global bounds (0-566)
      if (challengeIdx < 0 || challengeIdx > 566) {
        await interaction.reply({
          content: '❌ Invalid challenge index.',
          flags: 1 << 6
        }).catch(() => {});
        return;
      }

      // Check if already complete
      const isComplete = TenseyProgressService.isComplete(interaction.user.id, challengeIdx);

      if (isComplete) {
        // We do NOT update the main message; just inform
        await interaction.reply({
          content: '❌ Challenge already complete! Use the **UNDO** button to reverse.',
          flags: 1 << 6 // ephemeral
        }).catch(() => {});
        return;
      }

      // Mark complete
      const success = await TenseyProgressService.markComplete(interaction.user.id, challengeIdx);

      if (!success) {
        await interaction.reply({
          content: '❌ Failed to mark challenge complete. Please try again.',
          flags: 1 << 6
        }).catch(() => {});
        return;
      }

      // Get updated progress (array of completed indices)
      const userProgress = TenseyProgressService.getUserProgress(interaction.user.id);

      // Rebuild embed for the same page
      const { embed, components } = ChecklistEmbedBuilder.build(page, userProgress);

      // Update the checklist message (ACK happens here)
      await interaction.update({
        embeds: [embed],
        components
      });

      // ─────────────────────────────────────────────────────────────
      // Enriched ephemeral confirmation
      // ─────────────────────────────────────────────────────────────
      const challengeNumber = challengeIdx + 1;
      const challengeData = challenges[challengeIdx];
      const challengeText = challengeData ? challengeData.text : null;

      const completedCount = TenseyProgressService.getCompletionCount(interaction.user.id);
      const totalChallenges = challenges.length || 567;
      const xpAward = 100;

      const lines = [
        '✅ **Tensey Completed!** 🎉',
        `> <@${interaction.user.id}> completed **Tensey #${challengeNumber}**`,
        challengeText ? `> “${challengeText}”` : null,
        '',
        `⭐ **XP +${xpAward}** → Share your experience and your 1% gain (what you learned) with us!`,
        `📊 Progress: **${completedCount}/${totalChallenges}**`,
        `Keep going! • #${challengeNumber}`
      ].filter(Boolean);

      await interaction.followUp({
        content: lines.join('\n'),
        flags: 1 << 6 // ephemeral
      }).catch(() => {});
    } catch (error) {
      console.error('Toggle button error:', error);

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
