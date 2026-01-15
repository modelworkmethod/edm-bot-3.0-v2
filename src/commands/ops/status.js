/**
 * Status Command
 * Admin-only quick health summary
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { adminOnly } = require('../../utils/plainTextReplies');
const wingmanConfig = require('../../config/wingmanConfig');

const logger = createLogger('StatusCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Admin: Quick bot health summary'),

  async execute(interaction, services) {
    const userId = interaction.user.id;
    let hasDeferred = false;

    try {
      // ---------- ADMIN CHECK SEGURO ----------
      let isAdmin = false;

      // 1) permissionGuard.isAdmin si existe
      if (services?.permissionGuard) {
        const pg = services.permissionGuard;

        if (typeof pg.isAdmin === 'function') {
          try {
            isAdmin = await pg.isAdmin(userId);
          } catch (err) {
            logger.error('Status: permissionGuard.isAdmin threw', {
              error: err.message
            });
          }
        } else if (typeof pg.isAdminUser === 'function') {
          // por si tu implementación la llama distinto
          try {
            isAdmin = await pg.isAdminUser(userId);
          } catch (err) {
            logger.error('Status: permissionGuard.isAdminUser threw', {
              error: err.message
            });
          }
        } else {
          logger.warn('Status: PermissionGuard has no valid admin-check method.');
        }
      }

      // 2) Fallback: permisos nativos de Discord / owner
      if (!isAdmin) {
        const hasAdminPerm =
          interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || false;
        const isOwner =
          interaction.guild && interaction.guild.ownerId === userId;

        isAdmin = hasAdminPerm || isOwner;
      }

      // 3) Si no es admin, mensaje y salimos
      if (!isAdmin) {
        await interaction.reply({
          content: adminOnly(),
          flags: 1 << 6 // ephemeral
        });
        return;
      }

      // ---------- RATE LIMIT ----------
      if (services?.rateLimiter?.isRateLimited(userId, 'status')) {
        await interaction.reply({
          content: '⏱️ Slow down. Try again shortly.',
          flags: 1 << 6
        });
        return;
      }

      // ---------- DEFER REPLY (SEGURO) ----------
      try {
        await interaction.deferReply({ flags: 1 << 6 }); // ephemeral
        hasDeferred = true;
      } catch (err) {
        const msg = err?.message || '';
        const code = err?.code;
        if (code === 10062 || msg.includes('Unknown interaction')) {
          logger.warn('StatusCommand: interaction invalid while deferring', {
            code,
            message: msg
          });
          return;
        }
        throw err;
      }

      const client = interaction.client;
      const uptime = Math.floor(process.uptime());
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      // Build status
      let status = '**🤖 Bot Status**\n\n';

      // Uptime
      status += `**Uptime:** ${hours}h ${minutes}m\n`;

      // Guild info (primer servidor donde está)
      const guild = client.guilds.cache.first();
      if (guild) {
        status += `**Guild:** ${guild.name} (${guild.memberCount} members)\n`;
      }

      // Commands
      const cmdCount = client.application?.commands?.cache?.size || 0;
      status += `**Commands:** ${cmdCount} registered\n`;

      // Database
      try {
        const { queryRow } = require('../../database/postgres');
        await queryRow('SELECT 1');
        status += `**Database:** ✅ Connected\n`;
      } catch (e) {
        status += `**Database:** ❌ Error: ${e.message}\n`;
      }

      // Schedulers
      status += `\n**Schedulers:**\n`;
      status += `• Duels Finalizer: Every 10 min\n`;

      if (wingmanConfig.enabled) {
        const nextRun = wingmanConfig.nextRunDate();
        const hoursUntil = nextRun
          ? Math.floor((nextRun - new Date()) / 1000 / 60 / 60)
          : null;
        status += `• Wingman Matcher: ${wingmanConfig.scheduleDay} ${wingmanConfig.scheduleTime}`;
        if (hoursUntil !== null) {
          status += ` (in ~${hoursUntil}h)`;
        }
        status += '\n';
      } else {
        status += `• Wingman Matcher: Disabled\n`;
      }

      // Services
      status += `\n**Services:**\n`;
      const serviceNames = services
        ? Object.keys(services).filter(k =>
            !['repositories', 'rateLimiter', 'permissionGuard'].includes(k)
          )
        : [];
      status += `• ${serviceNames.length} services loaded\n`;

      // Quick health
      status += `\n**Health:** ✅ Operational\n`;
      status += `\nRun \`/preflight\` for detailed diagnostics.`;

      await interaction.editReply(status);

      logger.info('Status checked', { adminId: userId });
    } catch (error) {
      logger.error('Status check failed', { error: error.message });

      const payload = {
        content: '❌ Status check failed.',
        flags: 1 << 6
      };

      try {
        if (hasDeferred || interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch (err2) {
        const msg2 = err2?.message || '';
        const code2 = err2?.code;
        if (code2 === 10062 || msg2.includes('Unknown interaction')) {
          logger.warn('StatusCommand: interaction invalid while sending error reply', {
            code: code2,
            message: msg2
          });
        } else {
          logger.error('StatusCommand: failed to send error reply', {
            error: err2.message
          });
        }
      }
    }
  }
};
