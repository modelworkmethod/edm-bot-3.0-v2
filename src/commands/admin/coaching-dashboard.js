/**
 * Coaching Dashboard Command
 * Admin command to monitor inactive users and engagement
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { createLogger } = require('../../utils/logger');
const { getLocalDayString } = require('../../utils/timeUtils');
const config = require('../../config/settings');
const ArchetypeService = require('../../services/user/ArchetypeService');
const archetypeHistoryRepo = require('../../database/repositories/ArchetypeHistoryRepository');
const {
  getArchetypeIcon,
  generateArchetypeBar
} = require('../../utils/archetypeVisuals');

const logger = createLogger('CoachingDashboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coaching-dashboard')
    .setDescription('View inactive users and engagement metrics (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('filter')
        .setDescription('Filter by inactivity period')
        .addChoices(
          { name: '1+ days inactive', value: '1' },
          { name: '2+ days inactive', value: '2' },
          { name: '3+ days inactive', value: '3' },
          { name: '7+ days inactive', value: '7' },
          { name: 'All inactive', value: 'all' }
        )
    ),

  async execute(interaction, services) {
    // ─────────────────────────────
    // 1) Permisos de admin
    // ─────────────────────────────
    const isAdmin =
      interaction.user.id === config.admin.userId ||
      interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isAdmin) {
      try {
        await interaction.reply({
          content: 'Admin only command.',
          flags: 1 << 6 // ephemeral
        });
      } catch (err) {
        logger.warn('CoachingDashboard: failed to reply no-admin', {
          code: err.code,
          message: err.message
        });
      }
      return;
    }

    let replied = false;

    // ─────────────────────────────
    // 2) Responder rápido para evitar timeout
    // ─────────────────────────────
    try {
      await interaction.reply({
        content: '📊 Loading coaching dashboard...',
        flags: 1 << 6 // ephemeral
      });
      replied = true;
    } catch (err) {
      const msg = err?.message || '';
      const code = err?.code;

      if (code === 10062 || /Unknown interaction/i.test(msg)) {
        logger.warn(
          'CoachingDashboard: interaction invalid while replying',
          { code, message: msg }
        );
        return;
      }

      logger.error('CoachingDashboard: failed to initial reply', {
        error: msg
      });
      return;
    }

    const filter = interaction.options.getString('filter') || '1';
    const today = getLocalDayString();

    try {
      // ─────────────────────────────
      // 3) Obtener usuarios inactivos
      // ─────────────────────────────
      const inactiveUsers = await getInactiveUsers(services, filter, today);

      if (inactiveUsers.length === 0) {
        if (replied) {
          await interaction.editReply({
            content: `✅ No users inactive for ${filter}+ days. Everyone is engaged!`
          });
        }
        return;
      }

      // ─────────────────────────────
      // 4) Enriquecer con arquetipos
      // ─────────────────────────────
      const archetypeService = new ArchetypeService();

      const usersWithArchetype = await Promise.all(
        inactiveUsers.map(async user => {
          try {
            const archetypeData = await archetypeService.calculateUserArchetype(
              user.userId
            );
            const daysSinceChange =
              (await archetypeHistoryRepo.getDaysSinceLastChange(
                user.userId
              )) || 0;

            return {
              ...user,
              archetype: archetypeData.archetype,
              archetypeIcon: getArchetypeIcon(archetypeData.archetype),
              warriorPercent: archetypeData.warriorPercent,
              magePercent: archetypeData.magePercent,
              isBalanced: archetypeData.isBalanced,
              daysSinceChange
            };
          } catch (err) {
            logger.error('Error fetching archetype for user', {
              userId: user.userId,
              error: err.message
            });
            return {
              ...user,
              archetype: 'Unknown',
              archetypeIcon: '❓',
              isBalanced: false,
              warriorPercent: 0,
              magePercent: 0,
              daysSinceChange: 0
            };
          }
        })
      );

      // ─────────────────────────────
      // 5) Métricas generales
      // ─────────────────────────────
      const totalUsers = usersWithArchetype.length;
      const balancedUsers = usersWithArchetype.filter(u => u.isBalanced).length;
      const needsArchetypeAttention = usersWithArchetype.filter(
        u => !u.isBalanced && u.daysSinceChange >= 7
      ).length;
      const criticalArchetypeUsers = usersWithArchetype.filter(
        u => !u.isBalanced && u.daysSinceChange >= 21
      ).length;

      const balancedPct =
        totalUsers > 0
          ? ((balancedUsers / totalUsers) * 100).toFixed(1)
          : '0.0';

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle('📊 Coaching Dashboard - User Overview')
        .setDescription(
          `Showing **${totalUsers}** users inactive for **${filter}+ days**`
        )
        .setFooter({
          text: `${totalUsers} users | ${balancedUsers} balanced | ${needsArchetypeAttention} need archetype attention`
        })
        .setTimestamp();

      // Resumen de arquetipos
      embed.addFields({
        name: '⚖️ Archetype Balance Summary',
        value:
          `✅ Balanced (Templar): **${balancedUsers}** (${balancedPct}%)\n` +
          `⚠️ Needs Attention (7+ days): **${needsArchetypeAttention}**\n` +
          `🔴 Critical (21+ days): **${criticalArchetypeUsers}**`,
        inline: false
      });

      // ─────────────────────────────
      // 6) Agrupar por días inactivos
      // ─────────────────────────────
      const groups = {
        '7days': [],
        '3days': [],
        '2days': [],
        '1day': []
      };

      for (const u of usersWithArchetype) {
        if (u.daysInactive >= 7) groups['7days'].push(u);
        else if (u.daysInactive >= 3) groups['3days'].push(u);
        else if (u.daysInactive >= 2) groups['2days'].push(u);
        else groups['1day'].push(u);
      }

      // 7+ días (críticos)
      if (groups['7days'].length > 0) {
        const criticalList = groups['7days']
          .slice(0, 8)
          .map(u => {
            const balanceIcon =
              u.isBalanced && u.daysSinceChange === 0
                ? '✅'
                : !u.isBalanced && u.daysSinceChange >= 21
                ? '🔴'
                : '⚠️';
            return `${balanceIcon} <@${u.userId}> - ${u.daysInactive}d inactive | ${u.archetypeIcon} ${u.archetype} (${u.daysSinceChange}d in state)`;
          })
          .join('\n');

        embed.addFields({
          name: '🚨 Critical (7+ days inactive)',
          value: criticalList,
          inline: false
        });
      }

      // 3–6 días (alta prioridad)
      if (groups['3days'].length > 0) {
        const highPriorityList = groups['3days']
          .slice(0, 8)
          .map(u => {
            const balanceIcon = u.isBalanced ? '✅' : '⚠️';
            return `${balanceIcon} <@${u.userId}> - ${u.daysInactive}d | ${u.archetypeIcon} ${u.archetype}`;
          })
          .join('\n');

        embed.addFields({
          name: '⚠️ High Priority (3–6 days)',
          value: highPriorityList,
          inline: false
        });
      }

      // 2 días (moderados)
      if (groups['2days'].length > 0 && groups['2days'].length <= 10) {
        const moderateList = groups['2days']
          .map(u => `<@${u.userId}> - ${u.archetypeIcon} ${u.archetype}`)
          .join('\n');

        embed.addFields({
          name: '⏰ Moderate (2 days inactive)',
          value: moderateList,
          inline: false
        });
      }

      // Usuarios que necesitan coaching por arquetipo (7+ días out of balance)
      const archetypeAttentionUsers = usersWithArchetype
        .filter(u => !u.isBalanced && u.daysSinceChange >= 7)
        .slice(0, 5);

      if (archetypeAttentionUsers.length > 0) {
        const attentionList = archetypeAttentionUsers
          .map(u => {
            const visualBar = generateArchetypeBar(
              u.warriorPercent,
              u.magePercent
            );
            return (
              `🔴 <@${u.userId}>\n` +
              `   ${visualBar}\n` +
              `   ${u.archetypeIcon} ${u.archetype} for **${u.daysSinceChange} days**`
            );
          })
          .join('\n\n');

        embed.addFields({
          name: '🎯 Archetype Coaching Priority (7+ days out of balance)',
          value: attentionList || 'None',
          inline: false
        });
      }

      // ─────────────────────────────
      // 7) Botones de acción
      // ─────────────────────────────
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('coaching-send-reminders')
          .setLabel('Send Auto Reminders')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📨'),
        new ButtonBuilder()
          .setCustomId('coaching-export-list')
          .setLabel('Export List')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📋')
      );

      if (replied) {
        await interaction.editReply({
          content: '',
          embeds: [embed],
          components: [buttons]
        });
      }
    } catch (error) {
      logger.error('Failed to load coaching dashboard', { error: error.message });

      const msg = error?.message || '';
      const code = error?.code;
      const isUnknown =
        code === 10062 || /Unknown interaction/i.test(msg);

      if (!replied || isUnknown) {
        return;
      }

      try {
        await interaction.editReply({
          content: '❌ Failed to load dashboard. Check logs.',
        });
      } catch (err2) {
        const m2 = err2?.message || '';
        const c2 = err2?.code;
        if (c2 === 10062 || /Unknown interaction/i.test(m2)) {
          logger.warn(
            'CoachingDashboard: interaction invalid when sending error',
            { code: c2, message: m2 }
          );
        } else {
          logger.error('CoachingDashboard: failed to send error reply', {
            error: m2
          });
        }
      }
    }
  }
};

/**
 * Get inactive users
 */
async function getInactiveUsers(services, filterDays, today) {
  const daysThreshold = filterDays === 'all' ? 1 : parseInt(filterDays, 10);

  const query = `
    SELECT 
      u.user_id,
      u.xp,
      MAX(ud.day) AS last_submission
    FROM users u
    LEFT JOIN user_daily ud ON u.user_id = ud.user_id
    WHERE u.xp > 0
    GROUP BY u.user_id, u.xp
  `;

  const result = await services.repositories.user.raw(query);
  const users = result.rows || [];

  const inactiveUsers = [];

  for (const user of users) {
    const lastSubmission = user.last_submission;

    if (!lastSubmission) {
      // Nunca ha enviado stats → súper inactivo
      inactiveUsers.push({
        userId: user.user_id,
        username: user.user_id,
        daysInactive: 999,
        lastSubmission: null
      });
      continue;
    }

    const daysSince = calculateDaysBetween(lastSubmission, today);

    if (daysSince >= daysThreshold) {
      inactiveUsers.push({
        userId: user.user_id,
        username: user.user_id,
        daysInactive: daysSince,
        lastSubmission
      });
    }
  }

  // Ordenar por más inactivo primero
  return inactiveUsers.sort((a, b) => b.daysInactive - a.daysInactive);
}

/**
 * Calculate days between two date values (yyyy-mm-dd o Date)
 */
function calculateDaysBetween(date1, date2) {
  const toDayString = value => {
    if (!value) return null;

    if (value instanceof Date) {
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, '0');
      const d = String(value.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const d = String(parsed.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return null;
  };

  const s1 = toDayString(date1);
  const s2 = toDayString(date2);

  if (!s1 || !s2) return 0;

  const [y1, m1, d1] = s1.split('-').map(Number);
  const [y2, m2, d2] = s2.split('-').map(Number);

  const v1 = Date.UTC(y1, m1 - 1, d1);
  const v2 = Date.UTC(y2, m2 - 1, d2);

  return Math.floor((v2 - v1) / (1000 * 60 * 60 * 24));
}
