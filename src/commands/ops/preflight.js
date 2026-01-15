/**
 * Preflight Command
 * Admin-only health diagnostics
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { adminOnly } = require('../../utils/plainTextReplies');
const PreflightService = require('../../services/ops/PreflightService');

const logger = createLogger('PreflightCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('preflight')
    .setDescription('Admin: Run health diagnostics')
    .addStringOption(opt =>
      opt.setName('section')
        .setDescription('Section to check')
        .addChoices(
          { name: 'All (default)', value: 'all' },
          { name: 'Environment', value: 'env' },
          { name: 'Database', value: 'db' },
          { name: 'Channels & Roles', value: 'assets' },
          { name: 'Commands', value: 'commands' },
          { name: 'Schedulers', value: 'schedulers' },
          { name: 'Leaderboards', value: 'leaderboards' }
        )
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('dry')
        .setDescription('Include dry-run previews (wingman/duels)')
        .setRequired(false)
    ),

  async execute(interaction, services) {
    let hasDeferred = false;

    try {
      // ---- ADMIN CHECK SEGURO ----
      let isAdmin = false;

      // 1) Usar permissionGuard si existe y tiene isAdmin
      if (services?.permissionGuard && typeof services.permissionGuard.isAdmin === 'function') {
        try {
          isAdmin = await services.permissionGuard.isAdmin(interaction.user.id);
        } catch (err) {
          logger.error('Preflight: permissionGuard.isAdmin threw', {
            error: err.message
          });
        }
      }

      // 2) Fallback a permisos nativos de Discord
      if (!isAdmin) {
        const hasAdminPerm =
          interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || false;
        const isOwner =
          interaction.guild && interaction.guild.ownerId === interaction.user.id;

        isAdmin = hasAdminPerm || isOwner;
      }

      // 3) Si NO es admin, respondemos y salimos
      if (!isAdmin) {
        await interaction.reply({
          content: adminOnly(),
          flags: 1 << 6 // ephemeral
        });
        return;
      }

      // ---- RATE LIMIT ----
      if (services?.rateLimiter?.isRateLimited(interaction.user.id, 'preflight')) {
        await interaction.reply({
          content: '⏱️ Slow down. Try again shortly.',
          flags: 1 << 6
        });
        return;
      }

      // ---- DEFER REPLY SEGURO ----
      try {
        await interaction.deferReply({ flags: 1 << 6 }); // ephemeral
        hasDeferred = true;
      } catch (err) {
        const msg = err?.message || '';
        const code = err?.code;

        if (code === 10062 || msg.includes('Unknown interaction')) {
          logger.warn('Preflight: interaction invalid while deferring', {
            code,
            message: msg
          });
          return;
        }

        throw err;
      }

      // ------------------------------------------------------------------
      //  LÓGICA ORIGINAL DE PREFLIGHT (sin cambios de fondo)
      // ------------------------------------------------------------------
      const section = interaction.options.getString('section') || 'all';
      const includeDry = interaction.options.getBoolean('dry') || false;

      // Run checks
      const results = await PreflightService.runFullPreflight(
        interaction.client,
        services
      );

      // Build output
      let output = '**🧪 Preflight Diagnostics**\n\n';

      // Environment
      if (section === 'all' || section === 'env') {
        output += '**Environment:**\n';
        results.env.critical.forEach(r => {
          output += `${r.note} ${r.var}\n`;
        });
        output += '\n**Faction Vars:**\n';
        results.env.faction.forEach(r => {
          output += `${r.note} ${r.var}\n`;
        });
        output += '\n**Wingman Vars:**\n';
        results.env.wingman.forEach(r => {
          output += `${r.note} ${r.var}\n`;
        });
        output += '\n';
      }

      // Database
      if (section === 'all' || section === 'db') {
        output += '**Database:**\n';
        output += `${results.db.note}\n`;
        output += `${results.migrations.note}\n`;
        output += '\n';
      }

      // Guild Assets
      if (section === 'all' || section === 'assets') {
        output += '**Channels:**\n';
        if (results.guildAssets.channels) {
          results.guildAssets.channels.forEach(c => {
            output += `${c.note} ${c.name}\n`;
          });
        }
        output += '\n**Faction Roles:**\n';
        if (results.guildAssets.roles) {
          results.guildAssets.roles.forEach(r => {
            output += `${r.note} ${r.name}\n`;
          });
        }
        output += '\n';
      }

      // Commands
      if (section === 'all' || section === 'commands') {
        output += '**Commands:**\n';
        output += `${results.commands.note}\n`;
        if (results.commands.drift) {
          output += `Fix: Restart bot to sync registry\n`;
        }
        output += '\n';
      }

      // Schedulers
      if (section === 'all' || section === 'schedulers') {
        output += '**Schedulers:**\n';
        output += `Duels: ${results.schedulers.duels.note}\n`;
        output += `Wingman: ${results.schedulers.wingman.note}\n`;
        output += '\n';
      }

      // Leaderboards
      if (section === 'all' || section === 'leaderboards') {
        output += '**Leaderboards:**\n';
        if (results.leaderboards) {
          output += `${results.leaderboards.note}\n`;
        }
        output += '\n';
      }

      // Dry runs
      if (includeDry) {
        output += '**Dry Runs:**\n\n';
        
        if (results.wingmanDry) {
          output += `Wingman: ${results.wingmanDry.note}\n`;
          if (results.wingmanDry.preview) {
            output += `${results.wingmanDry.preview}\n`;
          }
        }
        
        if (results.duelsDry) {
          output += `Duels: ${results.duelsDry.note}\n`;
        }
        
        output += '\n';
      }

      // Overall status
      const overallPass = results.env.allPass && 
                         results.db.pass && 
                         results.migrations.pass &&
                         results.commands.pass;

      output += `**Overall:** ${overallPass ? '✅ All critical checks passed' : '⚠️ Issues detected'}\n`;

      // (si esto llega a pasar de 2000 chars, podrías luego chunkearlo,
      //  pero por ahora respetamos el comportamiento original)
      await interaction.editReply(output);

      logger.info('Preflight executed', {
        adminId: interaction.user.id,
        section,
        overallPass
      });

    } catch (error) {
      logger.error('Preflight failed', { error: error.message });

      const payload = {
        content: '❌ Preflight diagnostics failed. Check logs.',
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
          logger.warn('Preflight: interaction invalid while sending error reply', {
            code: code2,
            message: msg2
          });
        } else {
          logger.error('Preflight: failed to send error reply', {
            error: err2.message
          });
        }
      }
    }
  }
};
