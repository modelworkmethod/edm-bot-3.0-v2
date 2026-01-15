/**
 * Barbie Command
 * Main command for Barbie List management
 * + /barbie menu -> Card + buttons (like submit-stats)
 *   Buttons are handled via interactionRouter (customIds):
 *   - barbie-menu:add
 *   - barbie-menu:list
 *   - barbie-menu:view
 *   - barbie-menu:reminders
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

const logger = createLogger('BarbieCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('barbie')
    .setDescription('Manage your contact list')

    // ✅ NEW: menu
    .addSubcommand(subcommand =>
      subcommand
        .setName('menu')
        .setDescription('Open Barbie quick menu (buttons)')
    )

    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a new contact')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('View your contacts')
        .addStringOption(option =>
          option
            .setName('filter')
            .setDescription('Filter by tag')
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'High Interest', value: 'high-interest' },
              { name: 'Date Prospects', value: 'date-prospect' },
              { name: 'Friends', value: 'friend' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View contact details')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('Contact ID')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reminders')
        .setDescription('See who you should follow up with')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add-media')
        .setDescription('Add Instagram screenshots to a contact')
        .addIntegerOption(option =>
          option
            .setName('contact-id')
            .setDescription('Contact ID to add screenshots to')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('caption')
            .setDescription('Optional caption for the screenshots')
            .setRequired(false)
        )
        .addAttachmentOption(option =>
          option
            .setName('image1')
            .setDescription('Screenshot 1')
            .setRequired(true)
        )
        .addAttachmentOption(option =>
          option
            .setName('image2')
            .setDescription('Screenshot 2 (optional)')
            .setRequired(false)
        )
        .addAttachmentOption(option =>
          option
            .setName('image3')
            .setDescription('Screenshot 3 (optional)')
            .setRequired(false)
        )
        .addAttachmentOption(option =>
          option
            .setName('image4')
            .setDescription('Screenshot 4 (optional)')
            .setRequired(false)
        )
        .addAttachmentOption(option =>
          option
            .setName('image5')
            .setDescription('Screenshot 5 (optional)')
            .setRequired(false)
        )
    ),

  async execute(interaction, services) {
    const subcommand = interaction.options.getSubcommand();

    // ✅ NEW: /barbie menu -> renders the card + buttons
    if (subcommand === 'menu') {
      await this.handleMenu(interaction, services);
      return;
    }

    // /barbie add solo abre modal, NO se difiere respuesta
    if (subcommand === 'add') {
      await this.handleAdd(interaction, services);
      return;
    }

    // Los demás subcomandos responden con mensaje -> usamos deferReply una sola vez
    const ephemeral = true;

    try {
      await interaction.deferReply({ ephemeral });
    } catch (error) {
      logger.error('BarbieCommand: Failed to defer reply', {
        subcommand,
        error: error.message,
      });
      // Si la interacción ya no es válida, no intentamos responder más
      return;
    }

    if (subcommand === 'list') {
      await this.handleList(interaction, services);
    } else if (subcommand === 'view') {
      await this.handleView(interaction, services);
    } else if (subcommand === 'reminders') {
      await this.handleReminders(interaction, services);
    } else if (subcommand === 'add-media') {
      await this.handleAddMedia(interaction, services);
    }
  },

  /**
   * ✅ NEW: Renders the menu card with buttons (like submit-stats)
   * NOTE: Buttons must be routed/handled in interactionRouter.
   */
  async handleMenu(interaction, services) {
    const ephemeral = true;

    try {
      await interaction.deferReply({ ephemeral });
    } catch (error) {
      logger.error('BarbieCommand.handleMenu: Failed to defer reply', {
        error: error.message,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle('💅 Barbie Menu')
      .setDescription('Quick actions for your contact list.\n\nUse the buttons below:')
      .setFooter({ text: 'This menu is private (ephemeral).' });

    const row = new ActionRowBuilder().addComponents(
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

    await interaction.editReply({ embeds: [embed], components: [row] });
  },

  async handleAdd(interaction, services) {
    const {
      ModalBuilder,
      TextInputBuilder,
      TextInputStyle,
      ActionRowBuilder,
    } = require('discord.js');

    try {
      const modal = new ModalBuilder()
        .setCustomId('barbie-add-modal')
        .setTitle('Add New Contact');

      // 👇 Estos IDs DEBEN coincidir con modalHandler.handleBarbieAddModal
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

      // Muy importante: NO hacemos deferReply antes para este subcommand
      await interaction.showModal(modal);
    } catch (error) {
      logger.error('BarbieCommand.handleAdd: failed to show modal', {
        error: error.message,
      });

      const msg = error?.message || '';
      const code = error?.code;

      const isInteractionStateError =
        code === 10062 || // Unknown interaction
        code === 40060 || // Interaction already acknowledged
        msg.includes('Unknown interaction') ||
        msg.includes('already been acknowledged');

      if (isInteractionStateError) {
        // La interacción ya no es válida, no intentamos responder
        return;
      }

      if (!interaction.deferred && !interaction.replied) {
        await interaction
          .reply({
            content:
              '❌ Failed to open the contact form. Please try again.',
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  },

  async handleList(interaction, services) {
    // NO deferReply aquí, ya se hizo en execute
    const filter = interaction.options.getString('filter');
    const BarbieListManager = require('../../services/barbie/BarbieListManager');
    const manager = new BarbieListManager();

    const contacts = await manager.getUserContacts(
      interaction.user.id,
      filter && filter !== 'all' ? { tag: filter } : {}
    );

    if (contacts.length === 0) {
      await interaction.editReply(
        'Your list is empty. Use `/barbie add` to add contacts!'
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle('Your Barbie List')
      .setDescription(`${contacts.length} contacts`)
      .setFooter({ text: 'Use /barbie view <id> to see details' });

    const contactList = contacts
      .slice(0, 25) // Discord field limit
      .map(c => {
        const vibe = c.vibe_rating ? `${c.vibe_rating}/10` : 'N/A';
        const tags =
          c.tags && c.tags.length > 0 ? `[${c.tags.join(', ')}]` : '';
        return `**${c.id}.** ${c.contact_name} - Vibe: ${vibe} ${tags}`;
      })
      .join('\n');

    embed.setDescription(contactList);

    await interaction.editReply({ embeds: [embed] });
  },

  async handleView(interaction, services) {
    // NO deferReply aquí, ya se hizo en execute
    const contactId = interaction.options.getInteger('id');
    const BarbieListManager = require('../../services/barbie/BarbieListManager');
    const manager = new BarbieListManager();

    const contact = await manager.getContact(contactId, interaction.user.id);

    if (!contact) {
      await interaction.editReply('Contact not found.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle(contact.contact_name)
      .addFields(
        {
          name: 'Vibe Rating',
          value: contact.vibe_rating
            ? `${contact.vibe_rating}/10`
            : 'Not rated',
          inline: true,
        },
        {
          name: 'Met At',
          value: contact.met_location || 'Unknown',
          inline: true,
        }
      );

    if (contact.phone_number) {
      embed.addFields({
        name: 'Phone',
        value: contact.phone_number,
        inline: true,
      });
    }

    // Privacy guard for Instagram display
    const isPublicChannel = interaction.channel && interaction.channel.type === 0; // Text channel
    if (contact.instagram_handle) {
      if (contact.is_private && isPublicChannel) {
        embed.addFields({
          name: 'Instagram',
          value: '🔒 Private — IG hidden in public channel',
          inline: true,
        });
      } else {
        embed.addFields({
          name: 'Instagram',
          value: `@${contact.instagram_handle}`,
          inline: true,
        });
      }
    }

    if (contact.notes) {
      embed.addFields({
        name: 'Notes',
        value: contact.notes.substring(0, 1024),
        inline: false,
      });
    }

    if (contact.next_action) {
      embed.addFields({
        name: 'Next Action',
        value: contact.next_action,
        inline: false,
      });
    }

    // Get media count and display teaser
    const mediaCount = await manager.getInstagramMediaCount(contactId);
    if (mediaCount > 0) {
      // Get most recent media for timestamp
      const recentMedia = await manager.getInstagramMedia(contactId, 1);
      const lastUploadTime = recentMedia[0]
        ? new Date(recentMedia[0].uploaded_at)
        : null;

      // Privacy guard for media teaser
      if (!contact.is_private || !isPublicChannel) {
        const timeAgo = lastUploadTime
          ? `<t:${Math.floor(lastUploadTime.getTime() / 1000)}:R>`
          : 'unknown';
        embed.addFields({
          name: '📸 Instagram Screenshots',
          value: `${mediaCount} screenshot(s) uploaded • Latest: ${timeAgo}`,
          inline: false,
        });
      } else {
        // Hide media info in public channels for private contacts
        embed.addFields({
          name: '📸 Instagram Screenshots',
          value: '🔒 Media hidden in public channel',
          inline: false,
        });
      }
    }

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`barbie-opener:${contactId}`)
        .setLabel('Get Opener Suggestion')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`barbie-delete:${contactId}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
    );

    const componentRows = [buttons];

    // Add Instagram buttons if handle exists and not private in public channel
    if (contact.instagram_handle && (!contact.is_private || !isPublicChannel)) {
      const instagramButtons = new ActionRowBuilder().addComponents(
        // Link button: SOLO URL, SIN customId
        new ButtonBuilder()
          .setLabel('View Instagram')
          .setStyle(ButtonStyle.Link)
          .setURL(
            contact.instagram_url ||
              `https://www.instagram.com/${contact.instagram_handle}`
          ),

        // Analyze button: SOLO customId, SIN URL
        new ButtonBuilder()
          .setCustomId(`barbie-ig-analyze:${contactId}`)
          .setLabel('Analyze IG (beta)')
          .setStyle(ButtonStyle.Secondary)
      );

      componentRows.push(instagramButtons);
    }

    // Add vision analysis button if media exists
    if (mediaCount > 0 && (!contact.is_private || !isPublicChannel)) {
      const visionButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`barbie-ig-vision:${contactId}`)
          .setLabel('Analyze IG Screenshots (beta)')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📸')
      );

      componentRows.push(visionButtons);
    }

    await interaction.editReply({
      embeds: [embed],
      components: componentRows,
    });
  },

  async handleViewById(interaction, services, contactId) {
  const BarbieListManager = require('../../services/barbie/BarbieListManager');
  const manager = new BarbieListManager();

  const contact = await manager.getContact(contactId, interaction.user.id);

  if (!contact) {
    await interaction.editReply('Contact not found.');
    return;
  }

  // === (Aquí pega EXACTAMENTE lo mismo que tu handleView actual) ===
  // Solo cambia: ya no hagas `interaction.options.getInteger('id')`
  // Usa `contactId` que llega por parámetro.

  // (Tu mismo embed + botones + guards de privacidad + mediaCount)
  // ... (igualito)
},


  async handleReminders(interaction, services) {
    // NO deferReply aquí, ya se hizo en execute
    const BarbieListManager = require('../../services/barbie/BarbieListManager');
    const manager = new BarbieListManager();

    const reminders = await manager.getFollowUpReminders(interaction.user.id, 3);

    if (reminders.length === 0) {
      await interaction.editReply(
        "No follow-ups needed! You're on top of it."
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('Follow-Up Reminders')
      .setDescription('Contacts you should reach out to:');

    for (const contact of reminders.slice(0, 10)) {
      const daysSince = contact.last_contacted
        ? Math.floor(
            (Date.now() - new Date(contact.last_contacted)) /
              (1000 * 60 * 60 * 24)
          )
        : 'Never';

      embed.addFields({
        name: `${contact.contact_name} (Vibe: ${contact.vibe_rating}/10)`,
        value: `Last contacted: ${
          daysSince === 'Never' ? 'Never' : `${daysSince} days ago`
        }\nNext: ${contact.next_action || 'No action set'}`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async handleAddMedia(interaction, services) {
    // NO deferReply aquí, ya se hizo en execute
    try {
      const contactId = interaction.options.getInteger('contact-id');
      const caption = interaction.options.getString('caption') || null;
      const userId = interaction.user.id;

      // Extract image attachments from options
      const imageAttachments = [];
      for (let i = 1; i <= 5; i++) {
        const attachment = interaction.options.getAttachment(`image${i}`);
        if (attachment) {
          // Validate it's an image
          if (
            !attachment.contentType ||
            !attachment.contentType.startsWith('image/')
          ) {
            await interaction.editReply(
              `❌ Attachment ${i} is not an image. Only image files are supported.`
            );
            return;
          }
          imageAttachments.push(attachment);
        }
      }

      // Validate we have at least 1 image
      if (imageAttachments.length === 0) {
        await interaction.editReply(
          '❌ Please attach at least 1 screenshot to this command.'
        );
        return;
      }

      // Validate max 5 images
      if (imageAttachments.length > 5) {
        await interaction.editReply(
          '❌ Maximum 5 screenshots allowed per upload.'
        );
        return;
      }

      const BarbieListManager = require('../../services/barbie/BarbieListManager');
      const manager = new BarbieListManager();

      // Verify contact exists and belongs to user
      const contact = await manager.getContact(contactId, userId);
      if (!contact) {
        await interaction.editReply(
          "❌ Contact not found or you don't have permission to add media to it."
        );
        return;
      }

      // Sanitize caption if provided
      let sanitizedCaption = null;
      if (caption) {
        const { sanitizeCaption } = require('../../utils/social');
        sanitizedCaption = sanitizeCaption(caption);
      }

      // Prepare media items
      const mediaItems = imageAttachments.map(att => ({
        attachment_url: att.url,
        caption: sanitizedCaption,
        width: att.width || null,
        height: att.height || null,
      }));

      // Store media
      const results = await manager.addInstagramMedia({
        contactId,
        uploaderUserId: userId,
        messageId: interaction.id,
        items: mediaItems,
      });

      // Build success response
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Instagram Screenshots Added')
        .setDescription(
          `Successfully added ${results.length} screenshot(s) to **${contact.contact_name}**`
        )
        .addFields(
          { name: 'Contact ID', value: `#${contactId}`, inline: true },
          {
            name: 'Screenshots',
            value: `${results.length} image(s)`,
            inline: true,
          }
        );

      if (sanitizedCaption) {
        embed.addFields({
          name: 'Caption',
          value:
            sanitizedCaption.substring(0, 300) +
            (sanitizedCaption.length > 300 ? '...' : ''),
          inline: false,
        });
      }

      embed.setFooter({
        text: 'Use /barbie view to see the media and run analysis',
      });

      await interaction.editReply({ embeds: [embed] });

      logger.info('Instagram media added via command', {
        userId,
        contactId,
        contactName: contact.contact_name,
        mediaCount: results.length,
      });
    } catch (error) {
      logger.error('Failed to add Instagram media', { error: error.message });
      await interaction.editReply(
        '❌ Failed to add screenshots. Please try again.'
      );
    }
  },
};
