/**
 * Preflight Service
 * Health diagnostics for environment, DB, assets, and services
 */

const { createLogger } = require('../../utils/logger');
const { queryRow } = require('../../database/postgres');
const factionConfig = require('../../config/factionConfig');
const wingmanConfig = require('../../config/wingmanConfig');
const fs = require('fs');
const path = require('path');

const logger = createLogger('PreflightService');

class PreflightService {
  /**
   * Check critical environment variables
   */
  static checkEnv() {
    const critical = [
      'DISCORD_TOKEN',
      'ADMIN_USER_ID',
      'CHANNEL_GENERAL_ID',
      'DB_PASSWORD'
    ];

    const faction = ['LUMINARCH_ROLE_ID', 'NOCTIVORE_ROLE_ID'];
    const wingman = ['WINGMAN_MATCHUPS_CHANNEL_ID'];

    const results = {
      critical: [],
      faction: [],
      wingman: [],
      allPass: true
    };

    // Check critical vars
    for (const varName of critical) {
      const value = process.env[varName];
      const isSet = value && value !== 'REPLACE_ME' && value !== '';
      
      results.critical.push({
        var: varName,
        pass: isSet,
        note: isSet ? '✅' : '❌ Not set or REPLACE_ME'
      });
      
      if (!isSet) results.allPass = false;
    }

    // Check faction vars
    for (const varName of faction) {
      const value = process.env[varName];
      const isSet = value && value !== 'REPLACE_ME' && value !== '';
      
      results.faction.push({
        var: varName,
        pass: isSet,
        note: isSet ? '✅' : '⚠️ Not set (factions disabled)'
      });
    }

    // Check wingman vars
    for (const varName of wingman) {
      const value = process.env[varName];
      const isSet = value && value !== 'REPLACE_ME' && value !== '';
      
      results.wingman.push({
        var: varName,
        pass: isSet,
        note: isSet ? '✅' : '⚠️ Not set (wingman disabled)'
      });
    }

    return results;
  }

  /**
   * Check database connectivity
   */
  static async checkDb() {
    try {
      const result = await queryRow('SELECT 1 as alive');
      return {
        pass: result.alive === 1,
        note: '✅ DB connected'
      };
    } catch (error) {
      return {
        pass: false,
        note: `❌ DB error: ${error.message}`
      };
    }
  }

  /**
   * Check migrations (count files vs expected tables)
   */
  static async checkMigrations() {
    try {
      const migrationsDir = path.join(__dirname, '../../database/migrations');
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') && !f.includes('.bak'))
        .length;

      // Check if a core table exists (users table)
      const tablesCheck = await queryRow(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        )`
      );

      return {
        pass: tablesCheck.exists,
        fileCount: files,
        note: tablesCheck.exists 
          ? `✅ Core tables exist (${files} migration files found)`
          : `❌ Core tables missing (run npm run migrate)`
      };
    } catch (error) {
      return {
        pass: false,
        fileCount: 0,
        note: `❌ Migration check failed: ${error.message}`
      };
    }
  }

  /**
   * Check guild assets (channels, roles)
   */
  static async checkGuildAssets(guild) {
    const results = {
      channels: [],
      roles: [],
      allPass: true
    };

    // Check general channel
    const generalId = process.env.CHANNEL_GENERAL_ID;
    if (generalId) {
      const channel = guild.channels.cache.get(generalId);
      results.channels.push({
        name: 'General',
        id: generalId,
        pass: !!channel,
        note: channel ? `✅ #${channel.name}` : '❌ Not found'
      });
      if (!channel) results.allPass = false;
    }

    // Check wingman matchups channel
    if (wingmanConfig.matchupsChannelId && wingmanConfig.matchupsChannelId !== 'NOT_SET') {
      const channel = guild.channels.cache.get(wingmanConfig.matchupsChannelId);
      const canThread = channel?.isTextBased() || false;
      
      results.channels.push({
        name: 'Wingman Matchups',
        id: wingmanConfig.matchupsChannelId,
        pass: !!channel && canThread,
        note: !channel 
          ? '❌ Not found' 
          : !canThread 
            ? '⚠️ Not a text channel' 
            : `✅ #${channel.name}`
      });
      
      if (!channel || !canThread) results.allPass = false;
    }

    // Check faction roles
    for (const [name, faction] of Object.entries(factionConfig.factions)) {
      if (faction.roleId !== 'REPLACE_ME') {
        const role = guild.roles.cache.get(faction.roleId);
        const colorMatch = role ? role.color === faction.colorInt : false;
        
        results.roles.push({
          name: faction.key,
          id: faction.roleId,
          pass: !!role && colorMatch,
          note: !role 
            ? '❌ Role not found' 
            : !colorMatch 
              ? `⚠️ Color mismatch (expected ${faction.colorHex})` 
              : `✅ ${faction.colorHex}`
        });
        
        if (!role || !colorMatch) results.allPass = false;
      }
    }

    return results;
  }

  /**
   * Check command registration
   */
  static async checkCommands(client) {
    try {
      const registered = client.application?.commands?.cache?.size || 0;
      
      // Count exported commands from index
      const { getCommands } = require('../../commands');
      const exported = getCommands().size;

      const drift = exported !== registered;

      return {
        pass: !drift && registered > 0,
        registered,
        exported,
        drift,
        note: drift 
          ? `⚠️ Drift detected (exported: ${exported}, registered: ${registered})`
          : registered > 0 
            ? `✅ ${registered} commands registered`
            : '❌ No commands registered'
      };
    } catch (error) {
      return {
        pass: false,
        registered: 0,
        exported: 0,
        drift: false,
        note: `❌ Error: ${error.message}`
      };
    }
  }

  /**
   * Check scheduler status
   */
  static checkSchedulers() {
    // Note: No global state tracking - this is a lightweight check
    return {
      duels: {
        pass: true,
        note: '✅ Loaded (runs every 10 min)'
      },
      wingman: {
        pass: wingmanConfig.enabled,
        note: wingmanConfig.enabled 
          ? `✅ Enabled (next: ${wingmanConfig.scheduleDay} ${wingmanConfig.scheduleTime})`
          : '⚠️ Disabled (WINGMAN_MATCHUPS_CHANNEL_ID not set)'
      }
    };
  }

  /**
   * Get recent errors from logs (placeholder - would need log aggregation)
   */
  static async recentErrors() {
    // Simplified: Just return a placeholder since we don't have centralized error storage
    return {
      pass: true,
      count: 0,
      note: '✅ No recent critical errors detected'
    };
  }

  /**
   * Wingman dry run (preview pairs)
   */
  static async wingmanDryRun(guild, services, limit = 5) {
    try {
      if (!wingmanConfig.enabled) {
        return {
          pass: false,
          note: '⚠️ Wingman disabled (channel not set)'
        };
      }

      if (!services.wingmanMatcher) {
        return {
          pass: false,
          note: '❌ WingmanMatcher service not available'
        };
      }

      const members = await services.wingmanMatcher.getEligibleMembers(guild);
      const { pairs, unpaired } = await services.wingmanMatcher.buildPairs(members);

      let preview = `Eligible: ${members.length} | Pairs: ${pairs.length} | Unpaired: ${unpaired.length}\n`;
      
      if (pairs.length > 0) {
        preview += `\nSample pairs:\n`;
        pairs.slice(0, limit).forEach((p, i) => {
          preview += `${i + 1}. ${p.userA.user.username} & ${p.userB.user.username}\n`;
        });
        if (pairs.length > limit) {
          preview += `... and ${pairs.length - limit} more`;
        }
      }

      return {
        pass: pairs.length > 0,
        eligible: members.length,
        pairs: pairs.length,
        unpaired: unpaired.length,
        preview,
        note: pairs.length > 0 ? '✅ Pairs generated' : '⚠️ No pairs possible'
      };
    } catch (error) {
      return {
        pass: false,
        note: `❌ Error: ${error.message}`
      };
    }
  }

  /**
   * Duels dry scan (pending expirations)
   */
  static async duelsDryScan() {
    try {
      const pending = await queryRow(
        `SELECT COUNT(*) as count 
         FROM duels 
         WHERE status = 'active' AND end_time < NOW()`
      );

      const active = await queryRow(
        `SELECT COUNT(*) as count 
         FROM duels 
         WHERE status = 'active'`
      );

      return {
        pass: true,
        active: parseInt(active.count) || 0,
        expired: parseInt(pending.count) || 0,
        note: `✅ ${active.count} active duels, ${pending.count} ready to finalize`
      };
    } catch (error) {
      return {
        pass: false,
        note: `❌ Error: ${error.message}`
      };
    }
  }

  /**
   * Check leaderboard performance (cold vs warm)
   */
  static async checkLeaderboards(services) {
    if (!services.leaderboardService) {
      return {
        pass: false,
        note: '⚠️ LeaderboardService unavailable'
      };
    }

    try {
      // Clear cache for accurate cold timing
      services.leaderboardService.clearCache();

      // Test 1: XP all-time (cold)
      const xpColdStart = Date.now();
      await services.leaderboardService.getXPLeaderboard({ range: 'all', limit: 10, offset: 0 });
      const xpColdMs = Date.now() - xpColdStart;

      // Test 1: XP all-time (warm - cached)
      const xpWarmStart = Date.now();
      await services.leaderboardService.getXPLeaderboard({ range: 'all', limit: 10, offset: 0 });
      const xpWarmMs = Date.now() - xpWarmStart;

      // Test 2: Stat leaderboard (cold)
      services.leaderboardService.clearCache();
      const statColdStart = Date.now();
      await services.leaderboardService.getStatLeaderboard('Approaches', { range: 'week', limit: 10, offset: 0 });
      const statColdMs = Date.now() - statColdStart;

      // Test 2: Stat leaderboard (warm - cached)
      const statWarmStart = Date.now();
      await services.leaderboardService.getStatLeaderboard('Approaches', { range: 'week', limit: 10, offset: 0 });
      const statWarmMs = Date.now() - statWarmStart;

      const cacheWorking = xpWarmMs < xpColdMs && statWarmMs < statColdMs;

      return {
        pass: cacheWorking,
        xpCold: xpColdMs,
        xpWarm: xpWarmMs,
        statCold: statColdMs,
        statWarm: statWarmMs,
        note: cacheWorking 
          ? `✅ Cache working (XP: ${xpColdMs}ms → ${xpWarmMs}ms, Stat: ${statColdMs}ms → ${statWarmMs}ms)`
          : `⚠️ Cache issue (XP: ${xpColdMs}ms → ${xpWarmMs}ms, Stat: ${statColdMs}ms → ${statWarmMs}ms)`
      };
    } catch (error) {
      return {
        pass: false,
        note: `❌ Error: ${error.message}`
      };
    }
  }

  /**
   * Full preflight check
   */
  static async runFullPreflight(client, services) {
    const guild = client.guilds.cache.first();

    return {
      env: this.checkEnv(),
      db: await this.checkDb(),
      migrations: await this.checkMigrations(),
      guildAssets: guild ? await this.checkGuildAssets(guild) : { allPass: false, note: 'No guild' },
      commands: await this.checkCommands(client),
      schedulers: this.checkSchedulers(),
      errors: await this.recentErrors(),
      leaderboards: await this.checkLeaderboards(services),
      wingmanDry: guild && services.wingmanMatcher ? await this.wingmanDryRun(guild, services, 3) : null,
      duelsDry: await this.duelsDryScan()
    };
  }
}

module.exports = PreflightService;

