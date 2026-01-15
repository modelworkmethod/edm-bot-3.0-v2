/**
 * Reset Stats Command
 * Admin command to reset a user's stats (XP + affinities + daily + stats)
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('ResetStatsCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-stats')
    .setDescription('Reset all stats for a user (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to reset stats for')
        .setRequired(true)
    ),

  async execute(interaction, services) {
    const isAdmin =
      interaction.user.id === config.admin.userId ||
      interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      try {
        await interaction.reply({
          content: '❌ Admin only command.',
          flags: 1 << 6, // EPHEMERAL
        });
      } catch (err) {
        logger.warn('ResetStatsCommand: failed to reply (no admin)', {
          code: err.code,
          message: err.message,
        });
      }
      return;
    }

    // ✅ Defer (usa ephemeral para máxima compatibilidad)
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (err) {
      if (err.code === 10062 || /Unknown interaction/i.test(err.message || '')) {
        logger.warn('ResetStatsCommand: interaction no longer valid after trigger', {
          code: err.code,
          message: err.message,
        });
        return;
      }
      logger.error('ResetStatsCommand: failed to defer reply', { error: err.message });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user');

      const repos = services?.repositories || {};
      const userRepo = repos.user;
      const statsRepo = repos.stats;

      if (!userRepo || typeof userRepo.raw !== 'function') {
        throw new Error('ResetStatsCommand: repositories.user.raw not available');
      }
      if (!statsRepo || typeof statsRepo.raw !== 'function') {
        throw new Error('ResetStatsCommand: repositories.stats.raw not available');
      }

      logger.warn('Resetting user stats', {
        adminId: interaction.user.id,
        userId: targetUser.id,
      });

      // ✅ Transacción para que no quede “a medias”
      await userRepo.raw('BEGIN');

      // ✅ UPSERT: si Julian no existe en `users`, lo crea y lo deja en 0
      const upsertRes = await userRepo.raw(
        `
        INSERT INTO users (user_id, xp, warrior_affinity, mage_affinity, templar_affinity)
        VALUES ($1, 0, 0, 0, 0)
        ON CONFLICT (user_id)
        DO UPDATE SET
          xp = 0,
          warrior_affinity = 0,
          mage_affinity = 0,
          templar_affinity = 0
        RETURNING user_id
        `,
        [targetUser.id]
      );

      // ✅ Borra stats agregados
      const delStatsRes = await statsRepo.raw(
        `DELETE FROM user_stats WHERE user_id = $1`,
        [targetUser.id]
      );

      // ✅ Borra diarios
      const delDailyRes = await statsRepo.raw(
        `DELETE FROM user_daily WHERE user_id = $1`,
        [targetUser.id]
      );

      await userRepo.raw('COMMIT');

      // Nota: dependiendo del driver, rowCount puede venir o no.
      const statsDeleted = typeof delStatsRes?.rowCount === 'number' ? delStatsRes.rowCount : null;
      const dailyDeleted = typeof delDailyRes?.rowCount === 'number' ? delDailyRes.rowCount : null;

      await interaction.editReply({
        content:
          `✅ Stats reset for **${targetUser.username}**.\n` +
          `• XP + affinities set to **0**\n` +
          `• user_stats deleted: **${statsDeleted ?? 'OK'}**\n` +
          `• user_daily deleted: **${dailyDeleted ?? 'OK'}**`,
      });

      logger.info('Reset stats completed', {
        adminId: interaction.user.id,
        userId: targetUser.id,
        statsDeleted,
        dailyDeleted,
        upsertOk: Boolean(upsertRes?.rows?.[0]?.user_id),
      });

    } catch (error) {
      // rollback best-effort
      try {
        const repos = services?.repositories || {};
        if (repos.user?.raw) await repos.user.raw('ROLLBACK');
      } catch {}

      logger.error('Failed to reset stats', { error: error.message });

      try {
        await interaction.editReply({
          content: '❌ Failed to reset stats. Check logs for details.',
        });
      } catch (replyError) {
        logger.error('ResetStatsCommand: failed to send error reply', {
          error: replyError.message,
        });
      }
    }
  }
};
