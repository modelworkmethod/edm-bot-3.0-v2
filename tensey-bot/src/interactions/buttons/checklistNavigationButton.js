// ═══════════════════════════════════════════════════════════════════════════════
// Checklist navigation button handler - Handle page and level navigation
// Works for BOTH:
// 1) Persistent channel message (deferUpdate + message.edit)
// 2) Ephemeral "All Lists" flow (deferReply + editReply)
// ═══════════════════════════════════════════════════════════════════════════════

const TenseyProgressService = require('../../services/TenseyProgressService');
const ChecklistEmbedBuilder = require('../../embeds/ChecklistEmbedBuilder');

function parseTargetPage(customId) {
  const parts = String(customId || '').split('_');
  let targetPage;

  if (parts[0] === 'checklist' && parts[1] === 'nav' && parts[2] === 'prev') {
    targetPage = Number(parts[3]) - 1;
  } else if (parts[0] === 'checklist' && parts[1] === 'nav' && parts[2] === 'next') {
    targetPage = Number(parts[3]) + 1;
  } else if (parts[0] === 'checklist' && parts[1] === 'nav' && parts[2] === 'open') {
    targetPage = 0;
  } else if (parts[0] === 'checklist' && parts[1] === 'page') {
    targetPage = Number(parts[2]);
  } else if (parts[0] === 'checklist' && parts[1] === 'level') {
    const level = Number(parts[2]);
    targetPage = getLevelStartPage(level);
  }

  return targetPage;
}

function getLevelStartPage(level) {
  const levelStarts = {
    1: 0,
    2: 5,
    3: 12,
    4: 20,
    5: 30,
    6: 40,
    7: 50,
  };
  return levelStarts[level] ?? 0;
}

async function safeFollowUp(interaction, payload) {
  try {
    await interaction.followUp({ ...payload, ephemeral: true });
  } catch {}
}

async function safeEphemeralEdit(interaction, payload) {
  // Ensure ephemeral context exists
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

  // last resort
  try {
    await interaction.reply({ ...payload, flags: 1 << 6 });
    return true;
  } catch {}

  return false;
}

module.exports = {
  async execute(interaction) {
    try {
      const targetPage = parseTargetPage(interaction.customId);

      // Validate parse + bounds
      if (!Number.isInteger(targetPage) || targetPage < 0 || targetPage > 56) {
        const msg = `❌ Invalid page.`;
        if (!interaction.deferred && !interaction.replied) {
          return await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
        }
        await safeFollowUp(interaction, { content: msg });
        return;
      }

      // Get user progress (array of completed indices)
      const userProgress = TenseyProgressService.getUserProgress(interaction.user.id);

      // Build embed for target page
      const { embed, components } = ChecklistEmbedBuilder.build(targetPage, userProgress);

      // ✅ Decide rendering strategy:
      // - If the interaction already has an ephemeral reply context OR message isn't editable,
      //   render via ephemeral editReply.
      // - Otherwise update the persistent message via deferUpdate + message.edit/update.
      const canEditMessage =
        interaction.message && typeof interaction.message.edit === 'function';

      // Heuristic: if we were invoked from the "All Lists" flow, we usually want ephemeral.
      // Also if the message cannot be edited, go ephemeral.
      const shouldUseEphemeral =
        !canEditMessage ||
        (interaction.deferred && interaction.ephemeral) ||
        false;

      if (shouldUseEphemeral) {
        await safeEphemeralEdit(interaction, {
          embeds: [embed],
          components,
        });
        return;
      }

      // ✅ Persistent message path
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferUpdate();
        }
      } catch {}

      // Edit the message that contains the buttons
      try {
        await interaction.message.edit({
          embeds: [embed],
          components,
        });
        return;
      } catch {}

      // Fallback: try update (only works if not already acknowledged)
      try {
        await interaction.update({
          embeds: [embed],
          components,
        });
        return;
      } catch {}

      // Last resort: followUp ephemeral
      await safeFollowUp(interaction, {
        content: '⚠️ I could not update the checklist message, but here is the new view:',
        embeds: [embed],
        components,
      });

    } catch (error) {
      console.error('Navigation error:', error);

      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: '❌ Navigation failed. Please try again.',
          ephemeral: true,
        }).catch(() => {});
        return;
      }

      await safeFollowUp(interaction, { content: '❌ Navigation failed. Please try again.' });
    }
  },
};
