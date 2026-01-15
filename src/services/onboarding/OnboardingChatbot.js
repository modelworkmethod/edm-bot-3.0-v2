/**
 * Onboarding Chatbot
 * AI-powered help system for new users
 * 
 * TEMPLATE LOCATION: See OnboardingTemplate.js for customizable content
 */

const { EmbedBuilder } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const config = require('../../config/settings');

// Import modular template
const OnboardingTemplate = require('./OnboardingTemplate');

const logger = createLogger('OnboardingChatbot');

class OnboardingChatbot {
  constructor() {
    this.template = new OnboardingTemplate();
  }

  /**
   * Handle onboarding question
   */
  async handleQuestion(question, userId) {
    const lowerQuestion = question.toLowerCase();

    // Check for keyword matches
    for (const [category, data] of Object.entries(this.template.getCategories())) {
      for (const keyword of data.keywords) {
        if (lowerQuestion.includes(keyword)) {
          return this.formatResponse(category, data);
        }
      }
    }

    // No match found - return general help
    return this.formatResponse('general', this.template.getGeneralHelp());
  }

  /**
   * Format response as embed
   */
  formatResponse(category, data) {
    const embed = new EmbedBuilder()
      .setColor(config.branding.colorHex)
      .setTitle(data.title)
      .setDescription(data.description)
      .setFooter({ text: 'Need more help? Ask another question!' });

    if (data.steps && data.steps.length > 0) {
      embed.addFields({
        name: 'Steps:',
        value: data.steps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
        inline: false
      });
    }

    if (data.examples && data.examples.length > 0) {
      embed.addFields({
        name: 'Examples:',
        value: data.examples.join('\n'),
        inline: false
      });
    }

    if (data.relatedCommands && data.relatedCommands.length > 0) {
      embed.addFields({
        name: 'Related Commands:',
        value: data.relatedCommands.map(cmd => `\`${cmd}\``).join(', '),
        inline: false
      });
    }

    return embed;
  }

  /**
   * Get welcome message for new users
   */
  getWelcomeMessage() {
    return this.template.getWelcomeMessage();
  }

  /**
   * Get quick start guide
   */
  getQuickStart() {
    return this.template.getQuickStart();
  }
}

module.exports = OnboardingChatbot;

