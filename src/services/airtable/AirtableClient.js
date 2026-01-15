/**
 * Airtable Client
 * Connects Discord bot to Airtable Client Brain
 */

const Airtable = require('airtable');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('AirtableClient');

class AirtableClient {
  constructor() {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      logger.error('Missing Airtable credentials');
      throw new Error('Airtable not configured');
    }

    this.base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);
    
    this.tables = {
      clients: this.base('Clients'),
      transcripts: this.base('Call Transcripts'),
      meditations: this.base('Guided Meditations'),
      prompts: this.base('AI Prompts')
    };
  }

  /**
   * Find client by Discord ID
   */
  async findClientByDiscordId(discordId) {
    try {
      const records = await this.tables.clients.select({
        filterByFormula: `{Discord User ID} = '${discordId}'`,
        maxRecords: 1
      }).firstPage();

      if (records.length === 0) return null;

      const record = records[0];
      return {
        id: record.id,
        name: record.get('Name'),
        email: record.get('Email'),
        discordId: record.get('Discord User ID'),
        status: record.get('Status'),
        primaryPattern: record.get('Primary Personality Pattern'),
        secondaryPattern: record.get('Secondary Personality Pattern'),
        attachmentStyle: record.get('Attachment Style'),
        coreWounds: record.get('Core Wounds'),
        limitingBeliefs: record.get('Limiting Beliefs'),
        datingGoal: record.get('Primary Dating Goal'),
        currentChallenges: record.get('Current Challenges'),
        communicationStyle: record.get('Communication Preferences'),
        energyLevel: record.get('Energy Level'),
        motivationLevel: record.get('Motivation Level'),
        riskScore: record.get('Risk Score'),
        lastCallDate: record.get('Last 1:1 Call Date'),
        aiInsights: record.get('AI Insights Summary')
      };

    } catch (error) {
      logger.error('Failed to find client', { error: error.message, discordId });
      return null;
    }
  }

  /**
   * Find client by email
   */
  async findClientByEmail(email) {
    try {
      const records = await this.tables.clients.select({
        filterByFormula: `{Email} = '${email}'`,
        maxRecords: 1
      }).firstPage();

      if (records.length === 0) return null;

      const record = records[0];
      return {
        id: record.id,
        name: record.get('Name'),
        email: record.get('Email'),
        discordId: record.get('Discord User ID'),
        status: record.get('Status')
      };

    } catch (error) {
      logger.error('Failed to find client by email', { error: error.message });
      return null;
    }
  }

  /**
   * Create new client record
   */
  async createClient(data) {
    try {
      const record = await this.tables.clients.create({
        'Name': data.name,
        'Email': data.email,
        'Phone': data.phone || '',
        'Discord User ID': data.discordId || '',
        'Status': data.status || 'Lead',
        'Join Date': new Date().toISOString(),
        'Program': data.program || 'Embodied Dating Mastermind'
      });

      logger.info('Client created in Airtable', { 
        clientId: record.id, 
        name: data.name 
      });

      return record.id;

    } catch (error) {
      logger.error('Failed to create client', { error: error.message });
      return null;
    }
  }

  /**
   * Update client personality profile
   */
  async updatePersonalityProfile(clientId, profile) {
    try {
      await this.tables.clients.update(clientId, {
        'Primary Personality Pattern': profile.primaryPattern,
        'Secondary Personality Pattern': profile.secondaryPattern,
        'Attachment Style': profile.attachmentStyle,
        'Core Wounds': profile.coreWounds,
        'Limiting Beliefs': profile.limitingBeliefs,
        'Primary Dating Goal': profile.datingGoal,
        'Current Challenges': profile.challenges,
        'Communication Preferences': profile.communicationStyle,
        'Energy Level': profile.energyLevel,
        'Motivation Level': profile.motivationLevel,
        'AI Confidence in Analysis': profile.aiConfidence,
        'AI Insights Summary': profile.summary
      });

      logger.info('Personality profile updated', { clientId });

    } catch (error) {
      logger.error('Failed to update profile', { error: error.message });
    }
  }

  /**
   * Update client to "Client" status (from Lead)
   */
  async convertToClient(clientId) {
    try {
      await this.tables.clients.update(clientId, {
        'Status': 'Client',
        'Join Date': new Date().toISOString()
      });

      logger.info('Client status updated to Client', { clientId });

    } catch (error) {
      logger.error('Failed to update status', { error: error.message });
    }
  }

  /**
   * Update Discord engagement metrics
   */
  async updateEngagementMetrics(discordId, metrics) {
    try {
      const client = await this.findClientByDiscordId(discordId);
      if (!client) return;

      await this.tables.clients.update(client.id, {
        'Discord Activity Score': metrics.activityScore,
        'Last Discord Message': new Date().toISOString(),
        'Stats Submission Streak': metrics.streak,
        'Risk Score': metrics.riskScore
      });

      logger.info('Engagement metrics updated', { discordId });

    } catch (error) {
      logger.error('Failed to update engagement', { error: error.message });
    }
  }

  /**
   * Create call transcript record
   */
  async createCallTranscript(clientId, transcript) {
    try {
      const record = await this.tables.transcripts.create({
        'Client': [clientId],
        'Call Date': new Date().toISOString(),
        'Call Type': transcript.callType,
        'Full Transcript': transcript.fullText,
        'Fathom URL': transcript.fathomUrl || '',
        'AI Analysis': transcript.aiAnalysis || '',
        'Key Quotes': transcript.keyQuotes || '',
        'Breakthroughs Detected': transcript.breakthroughs || false
      });

      logger.info('Call transcript created', { 
        transcriptId: record.id,
        clientId 
      });

      return record.id;

    } catch (error) {
      logger.error('Failed to create transcript', { error: error.message });
      return null;
    }
  }

  /**
   * Create meditation record
   */
  async createMeditation(clientId, meditation) {
    try {
      const record = await this.tables.meditations.create({
        'Client': [clientId],
        'Generated Date': new Date().toISOString(),
        'Topic/Focus': meditation.topic,
        'Script': meditation.script,
        'Audio URL': meditation.audioUrl || '',
        'Sent Date': meditation.sent ? new Date().toISOString() : null
      });

      logger.info('Meditation record created', { 
        meditationId: record.id,
        clientId 
      });

      return record.id;

    } catch (error) {
      logger.error('Failed to create meditation', { error: error.message });
      return null;
    }
  }

  /**
   * Mark meditation as sent
   */
  async markMeditationSent(meditationId) {
    try {
      await this.tables.meditations.update(meditationId, {
        'Sent Date': new Date().toISOString()
      });

      logger.info('Meditation marked as sent', { meditationId });

    } catch (error) {
      logger.error('Failed to mark meditation sent', { error: error.message });
    }
  }

  /**
   * Create AI coaching prompt
   */
  async createCoachingPrompt(clientId, prompt) {
    try {
      const record = await this.tables.prompts.create({
        'Client': [clientId],
        'Prompt Type': prompt.type,
        'Prompt Text': prompt.text,
        'Created Date': new Date().toISOString(),
        'Status': 'Pending'
      });

      logger.info('Coaching prompt created', { 
        promptId: record.id,
        clientId 
      });

      return record.id;

    } catch (error) {
      logger.error('Failed to create prompt', { error: error.message });
      return null;
    }
  }

  /**
   * Get pending coaching prompts for client
   */
  async getPendingPrompts(discordId) {
    try {
      const client = await this.findClientByDiscordId(discordId);
      if (!client) return [];

      const records = await this.tables.prompts.select({
        filterByFormula: `AND({Client} = '${client.id}', {Status} = 'Pending')`,
        sort: [{ field: 'Created Date', direction: 'desc' }],
        maxRecords: 5
      }).firstPage();

      return records.map(r => ({
        id: r.id,
        type: r.get('Prompt Type'),
        text: r.get('Prompt Text'),
        createdDate: r.get('Created Date')
      }));

    } catch (error) {
      logger.error('Failed to get prompts', { error: error.message });
      return [];
    }
  }

  /**
   * Mark prompt as sent
   */
  async markPromptSent(promptId) {
    try {
      await this.tables.prompts.update(promptId, {
        'Status': 'Sent'
      });

      logger.info('Prompt marked as sent', { promptId });

    } catch (error) {
      logger.error('Failed to mark prompt sent', { error: error.message });
    }
  }

  /**
   * Get client's full call history
   */
  async getCallHistory(clientId) {
    try {
      const records = await this.tables.transcripts.select({
        filterByFormula: `{Client} = '${clientId}'`,
        sort: [{ field: 'Call Date', direction: 'desc' }],
        maxRecords: 10
      }).firstPage();

      return records.map(r => ({
        id: r.id,
        callDate: r.get('Call Date'),
        callType: r.get('Call Type'),
        aiAnalysis: r.get('AI Analysis'),
        keyQuotes: r.get('Key Quotes'),
        breakthroughs: r.get('Breakthroughs Detected')
      }));

    } catch (error) {
      logger.error('Failed to get call history', { error: error.message });
      return [];
    }
  }
}

module.exports = AirtableClient;

