/**
 * Breakthroughs Command
 * Lists detected breakthrough moments from journal entries
 */

const { SlashCommandBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('BreakthroughsCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('breakthroughs')
    .setDescription('View your breakthrough moments from journal entries')
    .addStringOption(option =>
      option.setName('range')
        .setDescription('Time range to search')
        .addChoices(
          { name: 'Last 7 days', value: '7d' },
          { name: 'Last 30 days', value: '30d' },
          { name: 'All time', value: 'all' }
        )
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of breakthrough')
        .addChoices(
          { name: 'All breakthroughs', value: 'all' },
          { name: 'High confidence (8+)', value: 'confidence' },
          { name: 'Low tension (≤3)', value: 'tension' }
        )
        .setRequired(false)
    ),

  async execute(interaction, services) {
    const ephemeral = !interaction.guild;

    try {
      // 🔹 Rate limit check (permitimos sync o async)
      if (services && services.rateLimiter) {
        let limited = false;

        try {
          const maybePromise = services.rateLimiter.isRateLimited(
            interaction.user.id,
            'breakthroughs'
          );
          limited = typeof maybePromise?.then === 'function'
            ? await maybePromise
            : maybePromise;
        } catch (rlError) {
          logger.warn('Breakthroughs: rateLimiter error, continuing anyway', {
            error: rlError.message,
          });
        }

        if (limited) {
          // usamos flags para evitar el warning de "ephemeral deprecated"
          await interaction.reply({
            content: 'Slow down a bit and try again shortly.',
            flags: 1 << 6, // EPHEMERAL
          });
          return;
        }
      }

      // 🔹 deferReply seguro
      let deferred = false;
      try {
        await interaction.deferReply({ flags: ephemeral ? (1 << 6) : undefined });
        deferred = true;
      } catch (err) {
        const msg = err?.message || '';
        const code = err?.code;

        const isInteractionStateError =
          code === 10062 || // Unknown interaction
          code === 40060 || // Interaction already acknowledged
          msg.includes('Unknown interaction') ||
          msg.includes('already been acknowledged');

        if (isInteractionStateError) {
          logger.warn('Breakthroughs: interaction invalid while deferring', {
            code,
            message: msg,
          });
          return;
        }

        throw err;
      }

      const range = interaction.options.getString('range') || '30d';
      const type = interaction.options.getString('type') || 'all';

      // 🔹 Validar CTJ service
      if (!services || !services.ctjService) {
        if (deferred) {
          await interaction.editReply(
            'CTJ service not available. Please try again later.'
          );
        } else {
          await interaction.reply({
            content: 'CTJ service not available. Please try again later.',
            flags: 1 << 6,
          });
        }
        return;
      }

      // 🔹 Obtener breakthroughs desde el servicio
      const result = await services.ctjService.getBreakthroughs(
        interaction.user.id,
        { range, type, limit: 10 }
      );

      if (!result.success) {
        await interaction.editReply(
          'Failed to retrieve breakthroughs. Please try again.'
        );
        return;
      }

      // El servicio devuelve el resultado de query():
      // puede ser { rows: [...] } o un array directo si se cambia a queryRows en el futuro
      const raw = result.breakthroughs;
      const breakthroughs = Array.isArray(raw?.rows)
        ? raw.rows
        : Array.isArray(raw)
        ? raw
        : [];

      // 🔹 No breakthroughs encontrados
      if (!breakthroughs || breakthroughs.length === 0) {
        await interaction.editReply(
          'No breakthroughs found for the selected range. Keep journaling!'
        );
        return;
      }

      const rangeText =
        range === '7d'
          ? 'Last 7 days'
          : range === '30d'
          ? 'Last 30 days'
          : 'All time';

      let reply = `**🎉 Your Breakthroughs (${rangeText})**\n\n`;

      for (let i = 0; i < breakthroughs.length; i++) {
        const bt = breakthroughs[i];
        const date = bt.submitted_at
          ? new Date(bt.submitted_at).toLocaleDateString()
          : 'Unknown date';

        const preview = bt.entry_text
          ? bt.entry_text.length > 150
            ? bt.entry_text.substring(0, 150) + '...'
            : bt.entry_text
          : '(no notes)';

        reply += `**${i + 1}. ${date}**\n`;
        reply += `Confidence: ${bt.confidence ?? 'N/A'} | Tension: ${
          bt.tension ?? 'N/A'
        } | Score: ${bt.breakthrough_score ?? 'N/A'}\n`;
        reply += `${preview}\n\n`;

        // 🔹 Protección extra contra el límite de 2000 caracteres
        if (reply.length > 1800 && i < breakthroughs.length - 1) {
          reply += `…and more breakthroughs not shown to keep the message readable.`;
          break;
        }
      }

      reply += `\nShowing up to ${breakthroughs.length} breakthrough${
        breakthroughs.length === 1 ? '' : 's'
      }.`;      

      await interaction.editReply(reply);

      logger.info('Breakthroughs retrieved', {
        userId: interaction.user.id,
        count: breakthroughs.length,
        range,
        type,
      });
    } catch (error) {
      const msg = error?.message || '';
      const code = error?.code;

      const isInteractionStateError =
        code === 10062 || // Unknown interaction
        code === 40060 || // Interaction already acknowledged
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged');

      if (isInteractionStateError) {
        logger.warn('Breakthroughs: interaction no longer valid in error path', {
          code,
          message: msg,
        });
        return;
      }

      logger.error('Failed to retrieve breakthroughs', { error: msg });

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(
            'An error occurred retrieving breakthroughs. Please try again.'
          );
        } else {
          await interaction.reply({
            content:
              'An error occurred retrieving breakthroughs. Please try again.',
            flags: 1 << 6,
          });
        }
      } catch (e) {
        logger.warn('Breakthroughs: failed to send error reply', {
          error: e.message,
        });
      }
    }
  },
};
