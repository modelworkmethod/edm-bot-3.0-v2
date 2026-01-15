// ═══════════════════════════════════════════════════════════════════════════════
// TEMP STUB — DO NOT SHIP
// Interaction router
// ═══════════════════════════════════════════════════════════════════════════════

const logger = require('../../utils/logger');
const CommandRegistry = require('../../commands');

// ✅ IMPORTANTE: importa tu contenedor real de services
// Ajusta la ruta si tu proyecto lo tiene en otro lado.
const services = require('../../services'); 

class InteractionRouter {
  static async route(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        await this.handleCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButton(interaction);
      } else if (interaction.isModalSubmit()) {
        await this.handleModal(interaction);
      }
    } catch (err) {
      logger.error('Interaction routing error', { err, type: interaction.type });
    }
  }

  static async handleCommand(interaction) {
    const commands = CommandRegistry.getCommands();
    const command = commands.find(cmd => cmd.data.name === interaction.commandName);

    if (!command) {
      logger.warn('Unknown command', { commandName: interaction.commandName });
      return;
    }

    // ✅ ahora sí pasamos services
    await command.execute(interaction, services);
  }

  static async handleButton(interaction) {
    const customId = interaction.customId;
    let handler;

    // ✅ Leaderboard buttons (V2 UI)
    if (customId === 'refresh-leaderboard') {
      handler = require('../buttons/refreshLeaderboardButton');
    } else if (customId === 'view-my-scorecard') {
      handler = require('../buttons/viewMyScorecardButton');
    }

    // ✅ Barbie Menu Buttons
    else if (customId && customId.startsWith('barbie-menu:')) {
      handler = require('../buttons/barbieMenuButton');
    }

    // Checklist handlers
    else if (customId.startsWith('checklist_toggle_')) {
      handler = require('../buttons/checklistToggleButton');
    } else if (customId.startsWith('checklist_nav_')) {
      handler = require('../buttons/checklistNavigationButton');
    } else if (customId === 'checklist_undo') {
      handler = require('../buttons/checklistUndoButton');
    } else if (customId.startsWith('checklist_info_')) {
      handler = require('../buttons/checklistInfoButton');
    } else if (customId.startsWith('checklist_page_')) {
      handler = require('../buttons/checklistNavigationButton');
    } else if (customId.startsWith('checklist_level_')) {
      handler = require('../buttons/checklistNavigationButton');
    }

    // legacy / otros
    else if (customId === 'open-checklist' || customId.startsWith('open-checklist')) {
      handler = require('../buttons/openChecklistButton');
    } else if (customId === 'open-leaderboard' || customId.startsWith('open-leaderboard')) {
      handler = require('../buttons/openLeaderboardButton');
    } else if (customId.startsWith('leaderboard-nav')) {
      handler = require('../buttons/leaderboardNavigationButton');
    } else if (customId === 'barbie-menu:add') {
      handler = require('../buttons/barbieMenuAddButton');
    } else if (customId === 'barbie-menu:view') {
      handler = require('../buttons/barbieMenuViewButton');
    } else if (customId === 'refresh-leaderboard') {
      handler = require('../buttons/refreshLeaderboardButton');
    } else if (customId === 'view-my-scorecard') {
      handler = require('../buttons/viewMyScorecardButton'); // si existe
    } if (customId === 'refresh-leaderboard' || customId.startsWith('refresh-leaderboard:')) {
        handler = require('../buttons/refreshLeaderboardButton');
      }



    if (handler) {
      // ✅ ahora sí pasamos services también a botones
      await handler.execute(interaction, services);
    } else {
      logger.warn('Unknown button action', { customId });
    }
  }

  static async handleModal(interaction) {
    const customId = interaction.customId;
    let handler;

    if (customId === 'barbie-view-modal') {
      handler = require('../modals/barbieViewModal');
    } else if (customId === 'barbie-add-modal') {
      handler = require('../modals/barbieAddModal');
    }

    if (!handler) {
      logger.warn('Unknown modal submit', { customId });
      return;
    }

    await handler.execute(interaction, services);
  }
}

module.exports = InteractionRouter;

