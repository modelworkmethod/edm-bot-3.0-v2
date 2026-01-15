/**
 * Wingman Matcher Service
 * Weekly pairing system with thread creation in matchups channel
 */

const { createLogger } = require('../../utils/logger');
const { query, queryRow, queryRows } = require('../../database/postgres');
const { ChannelType, PermissionsBitField } = require('discord.js');
const wingmanConfig = require('../../config/wingmanConfig');

const logger = createLogger('WingmanMatcher');

class WingmanMatcher {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Get eligible members for pairing
   */
  async getEligibleMembers(guild) {
    try {
      let members = [];

      // If role filter specified, get members with that role
      if (wingmanConfig.eligibleRoleId) {
        const role = guild.roles.cache.get(wingmanConfig.eligibleRoleId);
        if (role) {
          members = Array.from(role.members.values());
        } else {
          logger.warn('Eligible role not found', { roleId: wingmanConfig.eligibleRoleId });
        }
      } else {
        // Get all non-bot members
        await guild.members.fetch();
        members = Array.from(guild.members.cache.values()).filter(m => !m.user.bot);
      }

      // Apply level filter if configured
      if (wingmanConfig.minLevel > 0) {
        const eligibleWithLevel = [];

        for (const member of members) {
          try {
            const profile = await this.userService.getUserProfile(member.id);
            if (profile && profile.user && profile.user.level >= wingmanConfig.minLevel) {
              eligibleWithLevel.push(member);
            }
          } catch (e) {
            // Skip if profile fetch fails
          }
        }

        members = eligibleWithLevel;
      }

      logger.info('Eligible members found', { count: members.length });
      return members;

    } catch (error) {
      logger.error('Failed to get eligible members', { error: error.message });
      return [];
    }
          // ✅ Active players filter (DB-based)
      if (wingmanConfig.activeOnly) {
        members = await this.filterActiveMembers(members, wingmanConfig.activeDays || 14);
      }

      logger.info('Eligible members found', { count: members.length });
      return members;

  }

  /**
   * Build pairs with repeat avoidance
   */
  async buildPairs(members, options = {}) {
    try {
      if (members.length < 2) {
        return { pairs: [], unpaired: members };
      }

      // Get recent pairs to avoid repeats
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (wingmanConfig.lookbackWeeks * 7));

      const recentPairs = await queryRows(
        `SELECT DISTINCT user_a_id, user_b_id
         FROM wingman_pairs wp
         JOIN wingman_runs wr ON wp.run_id = wr.id
         WHERE wr.created_at >= $1`,
        [cutoffDate]
      );

      const pairSet = new Set(
        recentPairs.map(p => `${p.user_a_id}:${p.user_b_id}`)
      );

      // Shuffle members
      const shuffled = [...members].sort(() => Math.random() - 0.5);

      // Build pairs avoiding repeats
      const pairs = [];
      const used = new Set();

      for (let i = 0; i < shuffled.length - 1; i++) {
        if (used.has(shuffled[i].id)) continue;

        for (let j = i + 1; j < shuffled.length; j++) {
          if (used.has(shuffled[j].id)) continue;

          const [a, b] = [shuffled[i].id, shuffled[j].id].sort();
          const pairKey = `${a}:${b}`;

          if (!pairSet.has(pairKey)) {
            pairs.push({
              userA: shuffled[i],
              userB: shuffled[j],
              userAId: shuffled[i].id,
              userBId: shuffled[j].id
            });
            used.add(shuffled[i].id);
            used.add(shuffled[j].id);
            break;
          }
        }
      }

      // Handle unpaired members
      const unpaired = shuffled.filter(m => !used.has(m.id));

      // Handle odd count based on config
      if (unpaired.length === 1 && pairs.length > 0) {
        const oddMember = unpaired[0];

        if (wingmanConfig.oddMode === 'triad') {
          // Add to last pair to make a trio
          const lastPair = pairs[pairs.length - 1];
          lastPair.userC = oddMember;
          lastPair.userCId = oddMember.id;
          logger.info('Created triad for odd member', { userId: oddMember.id });
          return { pairs, unpaired: [] };
        } else if (wingmanConfig.oddMode === 'carry') {
          // Leave unpaired, prioritize next week (future enhancement)
          logger.info('Carrying unpaired member to next week', { userId: oddMember.id });
          return { pairs, unpaired: [oddMember] };
        } else if (wingmanConfig.oddMode === 'skip') {
          // Skip this member
          logger.info('Skipping unpaired member', { userId: oddMember.id });
          return { pairs, unpaired: [oddMember] };
        }
      }

      return { pairs, unpaired };

    } catch (error) {
      logger.error('Failed to build pairs', { error: error.message });
      throw error;
    }
  }

    /**
   * Filter members to only "active players"
   * Definition (DB-based, reliable):
   * - user submitted stats recently (user_daily) in last N days
   */
  async filterActiveMembers(members, activeDays = 14) {
    try {
      if (!members || members.length === 0) return [];

      const ids = members.map(m => m.id);

      // last N days in DATE terms (user_daily.day is usually YYYY-MM-DD)
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() - activeDays);

      // If day is stored as TEXT 'YYYY-MM-DD', we compare as date
      const rows = await queryRows(
        `
        SELECT DISTINCT user_id
        FROM user_daily
        WHERE user_id = ANY($1::text[])
          AND (day::date) >= ($2::date)
        `,
        [ids, cutoff]
      ).catch(() => []);

      const activeSet = new Set(rows.map(r => String(r.user_id)));
      return members.filter(m => activeSet.has(m.id));
    } catch (e) {
      logger.warn('Active filter failed, returning original members', { error: e?.message });
      return members; // fallback: no rompas wingman
    }
  }

    /**
     * Create wingman run record (idempotent per run_key)
     * If the run already exists, reuse it (UPSERT) so reruns don't crash.
     */
    async createRun(runKey, scheduledAt) {
      try {
        const run = await queryRow(
          `
          INSERT INTO wingman_runs (run_key, scheduled_at)
          VALUES ($1, $2)
          ON CONFLICT (run_key)
          DO UPDATE SET
            scheduled_at = EXCLUDED.scheduled_at
          RETURNING *;
          `,
          [runKey, scheduledAt]
        );

        logger.info('Created/Reused wingman run', { runId: run.id, runKey });
        return run;

      } catch (error) {
        logger.error('Failed to create run', { error: error.message });
        throw error;
      }
    }


    /**
     * Persist pairs to database (idempotent)
     * If a pair already exists for this run, do nothing and continue.
     */
    async persistPairs(runId, pairs) {
      try {
        const pairRecords = [];

        for (const pair of pairs) {
          const [userA, userB] = [pair.userAId, pair.userBId].sort();

          const record = await queryRow(
            `
            INSERT INTO wingman_pairs (run_id, user_a_id, user_b_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (run_id, user_a_id, user_b_id)
            DO UPDATE SET run_id = EXCLUDED.run_id
            RETURNING *;
            `,
            [runId, userA, userB]
          );

          pairRecords.push(record);
        }

        logger.info('Persisted pairs (idempotent)', { runId, count: pairRecords.length });
        return pairRecords;

      } catch (error) {
        logger.error('Failed to persist pairs', { error: error.message });
        throw error;
      }
    }


  /**
   * Create private threads in matchups channel
   */
  async createPrivateThreads(guild, runId, pairs) {
    try {
      const channel = guild.channels.cache.get(wingmanConfig.matchupsChannelId);

      if (!channel) {
        throw new Error(`Matchups channel ${wingmanConfig.matchupsChannelId} not found`);
      }

      if (channel.type !== ChannelType.GuildText) {
        throw new Error(`Channel ${channel.name} is not a text channel (type: ${channel.type})`);
      }

      // ✅ FIX: guild.members.me can be null depending on cache/state
      const me = await guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.CreatePrivateThreads)) {
        throw new Error('Bot lacks CreatePrivateThreads permission');
      }

      const runKey = wingmanConfig.currentRunKey();
      const results = [];

      for (const pair of pairs) {
        try {
          // Create short names for thread
          const shortA = pair.userA.user.username.substring(0, 10);
          const shortB = pair.userB.user.username.substring(0, 10);
          const threadName = `wingman-${runKey}-${shortA}-${shortB}`.substring(0, 100);

          // Create private thread
          const thread = await channel.threads.create({
            name: threadName,
            type: ChannelType.PrivateThread,
            reason: `Wingman pairing for ${runKey}`
          });

          // Add both users as thread members
          await thread.members.add(pair.userA.id);
          await thread.members.add(pair.userB.id);

          if (pair.userC) {
            await thread.members.add(pair.userC.id);
          }

          // ✅ FIX: use proper mentions (avoid [object Object])
          const mentionA = `<@${pair.userA.id}>`;
          const mentionB = `<@${pair.userB.id}>`;
          const mentionC = pair.userC ? `<@${pair.userC.id}>` : null;

          // Post kickoff message
          const kickoffMsg = pair.userC
            ? `🤝 **Wingman Trio for ${runKey}**\n\n` +
              `Partners: ${mentionA}, ${mentionB}, ${mentionC}\n\n` +
              `**Mission:** Support each other this week!\n` +
              `**Alpha Rule:** First person to message = Alpha (lead), others = Beta (support)\n\n` +
              `Share your goals, wins, and challenges. Check in daily!`
            : `🤝 **Wingman Pair for ${runKey}**\n\n` +
              `Partners: ${mentionA} & ${mentionB}\n\n` +
              `**Mission:** Support each other this week!\n` +
              `**Alpha Rule:** First to message = Alpha (lead), last = Beta (support)\n\n` +
              `Share your goals, wins, and challenges. Check in daily!`;

          await thread.send(kickoffMsg);

          // Update pair record with thread ID
          await query(
            `UPDATE wingman_pairs
             SET thread_id = $1
             WHERE run_id = $2 AND user_a_id = $3 AND user_b_id = $4`,
            [thread.id, runId, ...[pair.userAId, pair.userBId].sort()]
          );

          results.push({ pair, thread, success: true });

          logger.info('Created wingman thread', {
            threadId: thread.id,
            threadName,
            users: [pair.userA.id, pair.userB.id, pair.userC?.id].filter(Boolean)
          });

        } catch (error) {
          logger.error('Failed to create thread for pair', {
            error: error.message,
            users: [pair.userA.id, pair.userB.id]
          });
          results.push({ pair, error: error.message, success: false });
        }
      }

      return results;

    } catch (error) {
      logger.error('Failed to create private threads', { error: error.message });
      throw error;
    }
  }

  /**
   * Post weekly summary in matchups channel
   */
  async postWeeklySummary(guild, runId, pairs, threadResults) {
    try {
      const channel = guild.channels.cache.get(wingmanConfig.matchupsChannelId);

      if (!channel) {
        throw new Error('Matchups channel not found');
      }

      const runKey = wingmanConfig.currentRunKey();

      let summary = `**🤝 Wingman Matchups - ${runKey}**\n\n`;
      summary += `**${pairs.length} pair${pairs.length === 1 ? '' : 's'}** created this week:\n\n`;

      for (const result of threadResults) {
        if (result.success && result.thread) {
          const { userA, userB, userC } = result.pair;
          if (userC) {
            summary += `• ${userA.user.username}, ${userB.user.username}, ${userC.user.username} → <#${result.thread.id}>\n`;
          } else {
            summary += `• ${userA.user.username} & ${userB.user.username} → <#${result.thread.id}>\n`;
          }
        }
      }

      summary += `\n**Mission:** Support your wingman this week! Check your private thread above.`;

      // Post summary
      const message = await channel.send(summary);

      // Pin this message
      await message.pin();

      // ✅ FIX: use fetchMe() instead of guild.members.me (can be null)
      const me = await guild.members.fetchMe();

      // Unpin older wingman messages
      const pinnedMessages = await channel.messages.fetchPinned();
      for (const [id, msg] of pinnedMessages) {
        if (
          msg.id !== message.id &&
          msg.author?.id === me.id &&
          msg.content?.includes('Wingman Matchups -')
        ) {
          try {
            await msg.unpin();
          } catch (e) {
            // Ignore if already unpinned
          }
        }
      }

      // Update run with message ID
      await query(
        `UPDATE wingman_runs SET matchups_message_id = $1, pinned = true WHERE id = $2`,
        [message.id, runId]
      );

      logger.info('Posted weekly summary', { runId, messageId: message.id });
      return message;

    } catch (error) {
      logger.error('Failed to post weekly summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Announce in general channel
   */
  async announceInGeneral(guild, runId, pairs, summaryMessage) {
    try {
      const generalChannelId = wingmanConfig.generalChannelId;

      if (!generalChannelId) {
        logger.warn('Wingman general announcement skipped (generalChannelId not set)');
        return;
      }

      const channel = guild.channels.cache.get(generalChannelId);
      if (!channel) {
        logger.warn('General channel not found', { channelId: generalChannelId });
        return;
      }

      const runKey = wingmanConfig.currentRunKey();
      const matchupsChannel = guild.channels.cache.get(wingmanConfig.matchupsChannelId);

      let announcement = `🤝 **Wingman Matchups for ${runKey}**\n\n`;
      announcement += `**${pairs.length} wingman pair${pairs.length === 1 ? '' : 's'}** created!\n\n`;

      if (matchupsChannel) {
        announcement += `Check your private thread in ${matchupsChannel} for your partner and mission.\n`;
      } else {
        announcement += `Check the matchups channel for your private thread.\n`;
      }

      if (summaryMessage) {
        announcement += `\nFull list: ${summaryMessage.url}`;
      }

      await channel.send(announcement);

      logger.info('Posted general announcement', { runId, channelId: generalChannelId });

    } catch (error) {
      logger.error('Failed to announce in general', { error: error.message });
      // Non-critical
    }
  }

  /**
   * DM participants with thread link and mission
   */
  async dmParticipants(guild, pairs, threadResults) {
    try {
      for (const result of threadResults) {
        if (!result.success || !result.thread) continue;

        const { userA, userB, userC } = result.pair;
        const thread = result.thread;
        const runKey = wingmanConfig.currentRunKey();

        const dmTemplate = (user, partners) =>
          `🤝 **Wingman Assignment - ${runKey}**\n\n` +
          `You've been paired with: **${partners}**\n\n` +
          `Your private thread: ${thread.url}\n\n` +
          `**Mission:** Support each other this week!\n` +
          `**Alpha Rule:** First to message in the thread = Alpha (lead)\n\n` +
          `Share goals, check in daily, and celebrate wins together!`;

        // DM each participant
        const participants = [
          { user: userA, partners: userC ? `${userB.user.username} & ${userC.user.username}` : userB.user.username },
          { user: userB, partners: userC ? `${userA.user.username} & ${userC.user.username}` : userA.user.username }
        ];

        if (userC) {
          participants.push({ user: userC, partners: `${userA.user.username} & ${userB.user.username}` });
        }

        for (const { user, partners } of participants) {
          try {
            await user.send(dmTemplate(user, partners));
            logger.debug('Sent wingman DM', { userId: user.id });
          } catch (error) {
            logger.warn('Failed to DM participant', {
              userId: user.id,
              error: error.message
            });
          }
        }
      }

      logger.info('DM notifications sent', { pairCount: threadResults.length });

    } catch (error) {
      logger.error('Failed to DM participants', { error: error.message });
      // Non-critical, continue
    }
  }

  /**
   * Mark alpha/beta on first message (called from message handler)
   */
  async markAlphaOnFirstMessage(message) {
    try {
      // Check if this is a wingman thread
      const pair = await queryRow(
        `SELECT * FROM wingman_pairs WHERE thread_id = $1 AND alpha_user_id IS NULL`,
        [message.channel.id]
      );

      if (!pair) return;

      // Mark alpha and beta
      const alphaId = message.author.id;
      const betaId = pair.user_a_id === alphaId ? pair.user_b_id : pair.user_a_id;

      await query(
        `UPDATE wingman_pairs SET alpha_user_id = $1, beta_user_id = $2 WHERE id = $3`,
        [alphaId, betaId, pair.id]
      );

      logger.info('Marked alpha/beta for wingman thread', {
        threadId: message.channel.id,
        alphaId,
        betaId
      });

    } catch (error) {
      logger.error('Failed to mark alpha/beta', { error: error.message });
    }
  }
}

module.exports = WingmanMatcher;
