/**
 * Duel Command
 * Player vs Player XP competition with balance requirements
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('DuelCommand');

// Rate limiting map for challenge creation
const challengeCooldowns = new Map();
const CHALLENGE_COOLDOWN_MS = 60000; // 1 minute

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Challenge players to XP duels')
    .addSubcommand(subcommand =>
      subcommand
        .setName('challenge')
        .setDescription('Challenge another player to a duel')
        .addUserOption(option =>
          option
            .setName('opponent')
            .setDescription('The player you want to challenge')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('accept')
        .setDescription('Accept a pending duel challenge')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('Duel ID to accept')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('decline')
        .setDescription('Decline a pending duel challenge')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('Duel ID to decline')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View duel status')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('Specific duel ID (optional, shows active duel if not provided)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View duel history')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to view history for (optional, defaults to yourself)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('record')
        .setDescription('View win/loss record')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to view record for (optional, defaults to yourself)')
            .setRequired(false)
        )
    ),

  async execute(interaction, services) {
    const subcommand = interaction.options.getSubcommand();

    // Decidimos si la respuesta principal es pública o efímera
    const isChallenge = subcommand === 'challenge';
    const ephemeral = !isChallenge; // challenge = público, los demás efímeros

    try {
      await interaction.deferReply({ ephemeral });
    } catch (error) {
      logger.error('DuelCommand: Failed to defer reply', { error: error.message });
      return; // muy importante: no seguimos si la interacción ya no es válida
    }

    switch (subcommand) {
      case 'challenge':
        await this.handleChallenge(interaction, services);
        break;
      case 'accept':
        await this.handleAccept(interaction, services);
        break;
      case 'decline':
        await this.handleDecline(interaction, services);
        break;
      case 'status':
        await this.handleStatus(interaction, services);
        break;
      case 'history':
        await this.handleHistory(interaction, services);
        break;
      case 'record':
        await this.handleRecord(interaction, services);
        break;
    }
  },

  async handleChallenge(interaction, services) {
    // NO deferReply aquí, ya se hizo en execute
    try {
      const challenger = interaction.user;
      const opponent = interaction.options.getUser('opponent');

      // Validate opponent
      if (opponent.bot) {
        await interaction.editReply({ content: '❌ You cannot challenge a bot!' });
        return;
      }

      if (opponent.id === challenger.id) {
        await interaction.editReply({ content: '❌ You cannot challenge yourself!' });
        return;
      }

      // Check rate limit
      const now = Date.now();
      const lastChallenge = challengeCooldowns.get(challenger.id);
      
      if (lastChallenge && (now - lastChallenge) < CHALLENGE_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((CHALLENGE_COOLDOWN_MS - (now - lastChallenge)) / 1000);
        await interaction.editReply({ 
          content: `⏱️ Please wait ${remainingSeconds}s before challenging again.` 
        });
        return;
      }

      // Create duel
      const result = await services.duelManager.createDuel(challenger.id, opponent.id);

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.error}` });
        return;
      }

      // Update cooldown
      challengeCooldowns.set(challenger.id, now);

      // Create challenge embed
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6) // Purple
        .setTitle('⚔️ DUEL CHALLENGE')
        .setDescription(`**${challenger.username}** has challenged **${opponent.username}** to a duel!`)
        .addFields(
          { name: 'Challenger', value: `<@${challenger.id}>`, inline: true },
          { name: 'Opponent', value: `<@${opponent.id}>`, inline: true },
          { name: 'Time to Accept', value: '1 hour', inline: true },
          { 
            name: '📋 Rules', 
            value: '• 24-hour XP competition\n• Maintain 40-60% warrior affinity (Templar balance)\n• Most XP wins (if balanced)\n• Breaking balance = forfeit', 
            inline: false 
          }
        )
        .setFooter({ text: `Duel ID: ${result.duel.id}` })
        .setTimestamp();

      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`duel-accept:${result.duel.id}`)
            .setLabel('Accept ✅')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`duel-decline:${result.duel.id}`)
            .setLabel('Decline ✖️')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`duel-status:${result.duel.id}`)
            .setLabel('View Status')
            .setStyle(ButtonStyle.Secondary)
        );

      // Mensaje en el canal donde se ejecutó el comando
      await interaction.editReply({ 
        content: `<@${opponent.id}>, you have been challenged!`,
        embeds: [embed], 
        components: [buttons] 
      });

      // Confirmación efímera solo para el challenger
      await interaction.followUp({ 
        content: `✅ Challenge sent to ${opponent.username}! They have 1 hour to accept.`, 
        ephemeral: true 
      });

      // === NUEVO: anuncio en canal General ===
      try {
        const generalChannelId =
          (config.channels && (config.channels.general || config.channels.generalId)) ||
          interaction.channelId;

        await services.channelService.sendToChannel(generalChannelId, {
          content:
            `⚔️ **Duel Challenge!**\n` +
            `<@${opponent.id}>, you have been challenged to a duel by <@${challenger.id}>.\n` +
            `Will you accept the challenge? You have **1 hour** to accept and **24 hours** to see who earns more XP!`,
          embeds: [embed],
          components: [buttons]
        });
      } catch (err) {
        logger.error('DuelCommand: Failed to send challenge to general channel', {
          error: err.message
        });
      }

      logger.info('Duel challenge created', { 
        duelId: result.duel.id, 
        challengerId: challenger.id, 
        opponentId: opponent.id 
      });

    } catch (error) {
      logger.error('Failed to create duel challenge', { error: error.message });
      await interaction.editReply({ content: '❌ Failed to create duel. Please try again.' });
    }
  },

async handleAccept(interaction, services) {
    // NO deferReply aquí, ya se hizo en execute (efímero)
    try {
      const duelId = interaction.options.getInteger('id');
      const result = await services.duelManager.acceptDuel(duelId, interaction.user.id);

      if (!result.success) {
        await interaction.editReply(`❌ ${result.error}`);
        return;
      }

      const duel = await services.duelManager.getDuel(duelId);
      const endTime = Math.floor(new Date(duel.end_time).getTime() / 1000);

      // Respuesta al que aceptó
      await interaction.editReply({
        content:
          `✅ Duel accepted! You have 24 hours to earn XP while staying balanced.\n\n` +
          `⏱️ Ends: <t:${endTime}:R>\n` +
          `📊 Stay within 40-60% warrior affinity to avoid forfeit!`,
      });

      // Anuncio en canal General
      const generalChannelId =
        (config.channels && (config.channels.general || config.channels.generalId)) ||
        interaction.channelId;

      try {
        const otherId =
          duel.challenger_id === interaction.user.id
            ? duel.opponent_id
            : duel.challenger_id;

        await services.channelService.sendToChannel(generalChannelId, {
          content: [
            `🎉 **Duel Accepted!** ⚔️🔥`,
            `<@${interaction.user.id}> has **accepted** the duel from <@${otherId}>!`,
            `They now have **24 hours** to battle for XP while staying balanced in the 40–60% warrior range.`,
          ].join('\n'),
        });
      } catch (err) {
        logger.error('DuelCommand: Failed to announce duel accept in general channel', {
          generalChannelId,
          error: err.message,
        });
      }

      logger.info('Duel accepted', { duelId, userId: interaction.user.id });
    } catch (error) {
      logger.error('Failed to accept duel', { error: error.message });
      await interaction.editReply('❌ Failed to accept duel. Please try again.');
    }
  },

async handleDecline(interaction, services) {
    // NO deferReply aquí, ya se hizo en execute (efímero)
    try {
      const duelId = interaction.options.getInteger('id');

      // 🔹 PRIMERO leemos el duelo, antes de marcarlo como declinado
      const duel = await services.duelManager.getDuel(duelId);

      if (!duel) {
        await interaction.editReply('❌ Duel not found or already resolved.');
        return;
      }

      const result = await services.duelManager.declineDuel(duelId, interaction.user.id);

      if (!result.success) {
        await interaction.editReply(`❌ ${result.error}`);
        return;
      }

      // Confirmación al usuario que declinó
      await interaction.editReply('✅ Duel declined.');

      // Anuncio en canal General usando el duelo que ya teníamos
      try {
        const generalChannelId =
          (config.channels && (config.channels.general || config.channels.generalId)) ||
          interaction.channelId;

        const otherId =
          duel.challenger_id === interaction.user.id
            ? duel.opponent_id
            : duel.challenger_id;

        await services.channelService.sendToChannel(generalChannelId, {
          content:
            `⚠️ **Duel Declined**\n` +
            `<@${interaction.user.id}> has declined the duel from <@${otherId}>.\n` +
            `Maybe next time they’ll step into the arena… 🥊`,
        });
      } catch (err) {
        logger.error(
          'DuelCommand: Failed to send decline notice to general channel',
          {
            duelId,
            error: err.message,
          }
        );
      }

      logger.info('Duel declined', { duelId, userId: interaction.user.id });
    } catch (error) {
      logger.error('Failed to decline duel', { error: error.message });
      await interaction.editReply('❌ Failed to decline duel. Please try again.');
    }
  },


async handleStatus(interaction, services) {
  try {
    let duel;
    const duelId = interaction.options.getInteger('id');

    if (duelId) {
      duel = await services.duelManager.getDuel(duelId);

      if (!duel) {
        await interaction.editReply('❌ Duel not found.');
        return;
      }

      if (duel.challenger_id !== interaction.user.id && duel.opponent_id !== interaction.user.id) {
        await interaction.editReply('❌ You are not part of this duel.');
        return;
      }
    } else {
      duel = await services.duelManager.getActiveDuelForUser(interaction.user.id);

      if (!duel) {
        await interaction.editReply('❌ You don\'t have an active duel. Use `/duel challenge` to start one!');
        return;
      }
    }

    // ✅ usa el mismo provider del DuelManager para evitar mismatch
    const [challenger, opponent] = await Promise.all([
      services.duelManager._getUser(duel.challenger_id),
      services.duelManager._getUser(duel.opponent_id),
    ]);

    const challengerXP = Number(challenger?.xp || 0);
    const opponentXP = Number(opponent?.xp || 0);

    const challengerXPGained = challengerXP - Number(duel.challenger_start_xp || 0);
    const opponentXPGained = opponentXP - Number(duel.opponent_start_xp || 0);

    const cW = Number(challenger?.warrior_affinity || 0);
    const cM = Number(challenger?.mage_affinity || 0);
    const oW = Number(opponent?.warrior_affinity || 0);
    const oM = Number(opponent?.mage_affinity || 0);

    const cTotal = cW + cM;
    const oTotal = oW + oM;

    const cWarriorPct = cTotal > 0 ? ((cW / cTotal) * 100).toFixed(1) : '0.0';
    const oWarriorPct = oTotal > 0 ? ((oW / oTotal) * 100).toFixed(1) : '0.0';

    let color = 0x3498db;
    if (duel.status === 'completed') color = 0xf1c40f;
    if (duel.status === 'pending') color = 0x9b59b6;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`⚔️ Duel Status #${duel.id}`)
      .setDescription(`**Status:** ${String(duel.status || '').toUpperCase()}`)
      .addFields(
        {
          name: '👤 Challenger',
          value:
            `<@${duel.challenger_id}>\n` +
            `XP Gained: **${challengerXPGained}**\n` +
            `Warrior: **${cWarriorPct}%** ${duel.challenger_balance_penalty ? '⚠️ UNBALANCED' : (Number(cWarriorPct) >= 40 && Number(cWarriorPct) <= 60 ? '✅' : '')}`,
          inline: true
        },
        {
          name: '👤 Opponent',
          value:
            `<@${duel.opponent_id}>\n` +
            `XP Gained: **${opponentXPGained}**\n` +
            `Warrior: **${oWarriorPct}%** ${duel.opponent_balance_penalty ? '⚠️ UNBALANCED' : (Number(oWarriorPct) >= 40 && Number(oWarriorPct) <= 60 ? '✅' : '')}`,
          inline: true
        }
      )
      .setFooter({ text: 'Balance must stay between 40-60% warrior' });

    if (duel.status === 'active') {
      const endTime = Math.floor(new Date(duel.end_time).getTime() / 1000);
      embed.addFields({ name: '⏱️ Time Remaining', value: `Ends <t:${endTime}:R>`, inline: false });
    }

    if (duel.status === 'completed' && duel.winner_id) {
      embed.addFields({ name: '🏆 Winner', value: `<@${duel.winner_id}>`, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });

    // ✅ opcional: evita duplicar si generalChannelId == interaction.channelId
    try {
      const generalChannelId =
        (config.channels && (config.channels.general || config.channels.generalId)) ||
        interaction.channelId;

      if (generalChannelId !== interaction.channelId) {
        await services.channelService.sendToChannel(generalChannelId, {
          content: `📣 **Duel Status Updated** for Duel #${duel.id}`,
          embeds: [embed],
        });
      }
    } catch (err) {
      logger.error('DuelCommand: Failed to send duel status to general channel', { error: err.message });
    }

  } catch (error) {
    logger.error('Failed to get duel status', { error: error.message });
    await interaction.editReply('❌ Failed to get duel status. Please try again.');
  }
},

  async handleHistory(interaction, services) {
    // NO deferReply aquí, ya se hizo en execute (efímero)
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const history = await services.duelManager.getUserDuelHistory(targetUser.id, 5);

      if (history.length === 0) {
        await interaction.editReply(`${targetUser.username} has no duel history.`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`⚔️ ${targetUser.username}'s Duel History`)
        .setDescription('Last 5 duels:');

      for (const duel of history) {
        const isChallenger = duel.challenger_id === targetUser.id;
        const opponentId = isChallenger ? duel.opponent_id : duel.challenger_id;
        const xpGained = isChallenger 
          ? duel.challenger_final_xp - duel.challenger_start_xp
          : duel.opponent_final_xp - duel.opponent_start_xp;

        const result = duel.winner_id === targetUser.id ? '🏆 WON' : 
                       duel.winner_id === null ? '🤝 DRAW' : '❌ LOST';

        const completedTime = Math.floor(new Date(duel.completed_at).getTime() / 1000);

        embed.addFields({
          name: `Duel #${duel.id} - ${result}`,
          value: `vs <@${opponentId}>\nXP Gained: ${xpGained}\n<t:${completedTime}:R>`,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Failed to get duel history', { error: error.message });
      await interaction.editReply('❌ Failed to get duel history. Please try again.');
    }
  },

  async handleRecord(interaction, services) {
    // NO deferReply aquí, ya se hizo en execute (efímero)
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const record = await services.duelManager.getUserDuelRecord(targetUser.id);

      const totalDuels = record.wins + record.losses + record.draws;
      const winRate = totalDuels > 0 ? ((record.wins / totalDuels) * 100).toFixed(1) : 0;

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f) // Gold
        .setTitle(`⚔️ ${targetUser.username}'s Duel Record`)
        .addFields(
          { name: '🏆 Wins', value: record.wins.toString(), inline: true },
          { name: '❌ Losses', value: record.losses.toString(), inline: true },
          { name: '🤝 Draws', value: record.draws.toString(), inline: true },
          { name: '📊 Win Rate', value: `${winRate}%`, inline: false },
          { name: '📈 Total Duels', value: totalDuels.toString(), inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL());

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Failed to get duel record', { error: error.message });
      await interaction.editReply('❌ Failed to get duel record. Please try again.');
    }
  }
};
