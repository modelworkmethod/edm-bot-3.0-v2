/**
 * Command Registry
 * Registers all slash commands with Discord
 */

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { createLogger } = require('../utils/logger');
const settings = require('../config/settings');

const logger = createLogger('CommandRegistry');

/**
 * Sort options so that required options always come before optional,
 * recursively for sub-options. Discord enforces this.
 */
function sortOptionsRequiredFirst(options, ctxPath, logger) {
  if (!Array.isArray(options)) return options;

  let seenOptional = false;
  let hadToFix = false;

  for (const opt of options) {
    if (opt.required) {
      if (seenOptional) hadToFix = true;
    } else {
      seenOptional = true;
    }
  }

  if (hadToFix) {
    logger.warn('Fixing option order (required must come first)', { at: ctxPath });
  }

  const required = options.filter(o => !!o.required);
  const optional = options.filter(o => !o.required);
  const sorted = [...required, ...optional];

  for (const opt of sorted) {
    if (Array.isArray(opt.options) && opt.options.length > 0) {
      opt.options = sortOptionsRequiredFirst(opt.options, `${ctxPath}.${opt.name}`, logger);
    }
  }

  return sorted;
}

function normalizeCommandJson(jsonDef, logger) {
  const name = jsonDef?.name || '<unknown>';
  if (Array.isArray(jsonDef.options) && jsonDef.options.length > 0) {
    jsonDef.options = sortOptionsRequiredFirst(jsonDef.options, `/${name}`, logger);
  }
  return jsonDef;
}

class CommandRegistry {
  /**
   * @param {import('discord.js').Client} client
   * @param {string|string[]} commandDirs
   */
  constructor(client, commandDirs = path.join(__dirname)) {
    this.client = client;
    this.commandMap = new Map();

    const dirs = Array.isArray(commandDirs) ? commandDirs : [commandDirs];
    this.commandDirs = dirs.map(d =>
      path.isAbsolute(d) ? d : path.join(process.cwd(), d)
    );

    logger.info('Command directories set', { commandDirs: this.commandDirs });
  }

  /**
   * Safely require a command module and validate its shape.
   */
  static safeLoadCommand(fullPath, fileName) {
    try {
      const mod = require(fullPath);
      const cmd = mod?.default || mod;

      if (!cmd || typeof cmd !== 'object') {
        logger.warn('Command file does not export a valid object', { file: fileName });
        return null;
      }
      if (!cmd.data || typeof cmd.data.toJSON !== 'function') {
        logger.warn('Command is missing .data or it is not a SlashCommandBuilder', { file: fileName });
        return null;
      }
      if (typeof cmd.execute !== 'function') {
        logger.warn('Command is missing .execute function', { file: fileName });
        return null;
      }

      return cmd;
    } catch (err) {
      logger.error('Failed to load command file', { file: fileName, error: err.message });
      return null;
    }
  }

  /**
   * Recursively walk a directory and return all .js command file paths.
   */
  static walkDirForCommands(baseDir) {
    const out = [];
    const stack = [baseDir];

    while (stack.length) {
      const current = stack.pop();
      const entries = fs.readdirSync(current, { withFileTypes: true });

      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (
          entry.isFile() &&
          entry.name.endsWith('.js') &&
          !['commandRegistry.js', 'index.js'].includes(entry.name)
        ) {
          out.push(full);
        }
      }
    }

    return out;
  }

  /**
   * Discover commands from the command directories.
   * Fills this.commandMap and returns JSON definitions for registration.
   * @returns {Array<object>}
   */
  discoverCommands() {
    const jsonDefs = [];

    for (const dir of this.commandDirs) {
      const files = CommandRegistry.walkDirForCommands(dir);
      logger.info('Discovering commands in folder', { folder: dir, fileCount: files.length });

      for (const full of files) {
        const fileName = path.basename(full);
        const cmd = CommandRegistry.safeLoadCommand(full, fileName);
        if (!cmd) continue;

        try {
          const rawJson = cmd.data.toJSON();
          const json = normalizeCommandJson(rawJson, logger);
          const cmdName = json.name;

          if (this.commandMap.has(cmdName)) {
            logger.warn('Duplicate command name detected; skipping duplicate', {
              name: cmdName,
              file: fileName
            });
            continue;
          }

          jsonDefs.push(json);
          this.commandMap.set(cmdName, cmd);
          logger.info('Loaded command', { name: cmdName, file: fileName });
        } catch (e) {
          logger.error('Failed to serialize command data', { file: fileName, error: e.message });
        }
      }
    }

    if (jsonDefs.length === 0) {
      logger.warn('No valid commands were found to register');
    } else {
      logger.info('Total commands discovered', { count: jsonDefs.length });
    }

    return jsonDefs;
  }

  /**
   * Register discovered commands with Discord via REST.
   */
  async registerWithDiscord(jsonDefs) {
    if (!Array.isArray(jsonDefs) || jsonDefs.length === 0) return 0;

    const rest = new REST({ version: '10' }).setToken(settings.discord.token);
    const guildId = settings.discord.guildId;
    const clientId = settings.discord.clientId;

    logger.info('Registering slash commands via REST', {
      scope: guildId ? 'guild' : 'global',
      count: jsonDefs.length,
    });

    const normalizedDefs = jsonDefs.map(d => normalizeCommandJson(d, logger));

    let data;
    if (guildId) {
      data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: normalizedDefs },
      );
    } else {
      data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: normalizedDefs },
      );
    }

    logger.info('Slash commands registered successfully', { count: data.length });
    return data.length;
  }

  /**
   * Discover commands, register them with Discord, and attach them to client.
   */
  async registerAll() {
    const jsonDefs = this.discoverCommands();
    await this.registerWithDiscord(jsonDefs);

    // Attach the command map to the client
    this.client.__commands = this.commandMap;
    this.client.commands = this.commandMap;

    logger.info('Command map attached to client', {
      count: this.commandMap.size,
      names: Array.from(this.commandMap.keys()),
    });

    return this.commandMap;
  }
}

/**
 * Helper used by bot-v3.js
 */
async function registerCommands(client /*, config */) {
  const registry = new CommandRegistry(client, path.join(__dirname));
  const commandMap = await registry.registerAll();
  // Por si acaso, volvemos a asegurar
  client.commands = commandMap;
  return registry;
}

module.exports = {
  CommandRegistry,
  registerCommands,
};
