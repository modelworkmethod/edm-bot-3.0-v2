// ═══════════════════════════════════════════════════════════════════════════════
// Barbie Menu Button Handler
// customIds:
// - barbie-menu:add
// - barbie-menu:list
// - barbie-menu:view
// - barbie-menu:reminders
// - barbie-menu:back
// ═══════════════════════════════════════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('BarbieMenuButton');

function buildMenuEmbed() {
  return new EmbedBuilder()
    .setColor(config.branding.colorHex)
    .setTitle('💅 Barbie Menu')
    .setDescription('Quick actions for your contact list.\n\nUse the buttons below:')
    .setFooter({ text: 'This menu is private (ephemeral).' });
}

function buildMenuRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('barbie-menu:add')
      .setLabel('➕ Add Barbie')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('barbie-menu:list')
      .setLabel('📋 List')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('barbie-menu:view')
      .setLabel('🔎 View')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('barbie-menu:reminders')
      .setLabel('⏰ Reminders')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildBackRow(primary = 'list') {
  // primary: 'list' | 'reminders'
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('barbie-menu:back')
      .setLabel('⬅️ Back')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('barbie-menu:list')
      .setLabel('📋 List')
      .setStyle(primary === 'list' ? ButtonStyle.Primary : ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('barbie-menu:view')
      .setLabel('🔎 View')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('barbie-menu:add')
      .setLabel('➕ Add')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('barbie-menu:reminders')
      .setLabel('⏰ Reminders')
      .setStyle(primary === 'reminders' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
}

// ✅ Para botones: update() es lo correcto (evita duplicar mensajes ephemeral)
async function safeUpdate(interaction, payload) {
  try {
    return await interaction.update(payload);
  } catch (e) {
    // Si no se puede update (casos raros), intentamos editReply como fallback
    try {
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply(payload);
      }
    } catch {}
  }
}

module.exports = {
  async execute(interaction) {
    const customId = interaction.customId || '';
    const action = customId.split(':')[1];

    try {
      if (!action) {
        await interaction.reply({ content: '❌ Invalid menu action.', flags: 1 << 6 }).catch(() => {});
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // ADD (open modal) ✅ NO defer / NO update / NO reply before showModal
      // ─────────────────────────────────────────────────────────────
      if (action === 'add') {
        const modal = new ModalBuilder()
          .setCustomId('barbie-add-modal')
          .setTitle('Add New Contact');

        const nameInput = new TextInputBuilder()
          .setCustomId('barbie_name')
          .setLabel('Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const phoneInput = new TextInputBuilder()
          .setCustomId('barbie_phone')
          .setLabel('Phone Number (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const instagramInput = new TextInputBuilder()
          .setCustomId('barbie_instagram')
          .setLabel('Instagram (handle or URL, optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('@username or instagram.com/username');

        const vibeInput = new TextInputBuilder()
          .setCustomId('barbie_vibe')
          .setLabel('Vibe Rating (1-10, optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const notesInput = new TextInputBuilder()
          .setCustomId('barbie_notes')
          .setLabel('Notes (what you talked about, etc.)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(phoneInput),
          new ActionRowBuilder().addComponents(instagramInput),
          new ActionRowBuilder().addComponents(vibeInput),
          new ActionRowBuilder().addComponents(notesInput)
        );

        await interaction.showModal(modal);
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // VIEW (open modal) ✅ NO defer / NO update / NO reply before showModal
      // ─────────────────────────────────────────────────────────────
      if (action === 'view') {
        const modal = new ModalBuilder()
          .setCustomId('barbie-view-modal')
          .setTitle('View Contact');

        const idInput = new TextInputBuilder()
          .setCustomId('barbie_view_id')
          .setLabel('Contact ID')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. 12');

        modal.addComponents(new ActionRowBuilder().addComponents(idInput));

        await interaction.showModal(modal);
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // LIST / REMINDERS / BACK -> ✅ update() el mismo mensaje (NO duplica)
      // ─────────────────────────────────────────────────────────────

      // LIST
      if (action === 'list') {
        const BarbieListManager = require('../../services/barbie/BarbieListManager');
        const manager = new BarbieListManager();

        const contacts = await manager.getUserContacts(interaction.user.id, {});

        if (!contacts || contacts.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(config.branding.colorHex)
            .setTitle('Your Barbie List')
            .setDescription('Your list is empty.\n\nClick **Add Barbie** to create your first contact.')
            .setFooter({ text: 'Tip: keep it simple—name + notes is enough.' });

          await safeUpdate(interaction, {
            content: '',
            embeds: [embed],
            components: [buildBackRow('list')]
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(config.branding.colorHex)
          .setTitle('Your Barbie List')
          .setFooter({ text: 'Tip: click View to open a contact by ID' });

        const contactList = contacts
          .slice(0, 25)
          .map(c => {
            const vibe = c.vibe_rating ? `${c.vibe_rating}/10` : 'N/A';
            const tags = c.tags && c.tags.length > 0 ? `[${c.tags.join(', ')}]` : '';
            return `**${c.id}.** ${c.contact_name} — Vibe: ${vibe} ${tags}`;
          })
          .join('\n');

        embed.setDescription(contactList);

        await safeUpdate(interaction, {
          content: '',
          embeds: [embed],
          components: [buildBackRow('list')]
        });
        return;
      }

      // REMINDERS
      if (action === 'reminders') {
        const BarbieListManager = require('../../services/barbie/BarbieListManager');
        const manager = new BarbieListManager();

        const reminders = await manager.getFollowUpReminders(interaction.user.id, 3);

        if (!reminders || reminders.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('Follow-Up Reminders')
            .setDescription("No follow-ups needed! You're on top of it.");

          await safeUpdate(interaction, {
            content: '',
            embeds: [embed],
            components: [buildBackRow('reminders')]
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle('Follow-Up Reminders')
          .setDescription('Contacts you should reach out to:');

        for (const contact of reminders.slice(0, 10)) {
          const daysSince = contact.last_contacted
            ? Math.floor((Date.now() - new Date(contact.last_contacted)) / (1000 * 60 * 60 * 24))
            : 'Never';

          embed.addFields({
            name: `${contact.contact_name} (Vibe: ${contact.vibe_rating || 'N/A'}/10)`,
            value: `Last contacted: ${daysSince === 'Never' ? 'Never' : `${daysSince} days ago`}\nNext: ${contact.next_action || 'No action set'}`,
            inline: false
          });
        }

        await safeUpdate(interaction, {
          content: '',
          embeds: [embed],
          components: [buildBackRow('reminders')]
        });
        return;
      }

      // BACK -> menu root
      if (action === 'back') {
        await safeUpdate(interaction, {
          content: '',
          embeds: [buildMenuEmbed()],
          components: [buildMenuRow()]
        });
        return;
      }

      // Default
      await safeUpdate(interaction, {
        content: '❌ Unknown Barbie menu action.',
        embeds: [buildMenuEmbed()],
        components: [buildMenuRow()]
      });

    } catch (err) {
      const msg = err?.message || '';
      const code = err?.code;

      if (
        code === 10062 ||
        code === 40060 ||
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged')
      ) {
        logger.warn('BarbieMenuButton: interaction no longer valid', { code, msg, customId });
        return;
      }

      logger.error('BarbieMenuButton: failed', {
        error: msg,
        stack: err?.stack,
        customId
      });

      // ✅ Evitar duplicar: si ya es componente, mejor followUp ephemeral
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: '❌ Failed. Try again.', flags: 1 << 6 });
        } else {
          await interaction.reply({ content: '❌ Failed. Try again.', flags: 1 << 6 });
        }
      } catch {}
    }
  }
};
