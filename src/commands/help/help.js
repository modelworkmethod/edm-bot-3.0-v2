/**
 * Help Command
 * AI-powered onboarding chatbot
 */

const { SlashCommandBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const OnboardingChatbot = require('../../services/onboarding/OnboardingChatbot');

const logger = createLogger('HelpCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with the bot')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('What do you need help with?')
        .setRequired(false)
    ),

  async execute(interaction, services) {
    const question = interaction.options.getString('question');
    const chatbot = new OnboardingChatbot();

    let response;
    if (question) {
      response = await chatbot.handleQuestion(question, interaction.user.id);
    } else {
      response = chatbot.getQuickStart();
      const embed = {
        color: 0x00FF00,
        title: response.title,
        description: response.description,
        fields: [{
          name: 'Quick Start:',
          value: response.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
        }]
      };
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [response], ephemeral: true });
  }
};

