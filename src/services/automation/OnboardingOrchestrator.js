/**
 * Onboarding Orchestrator
 * Coordinates the entire client onboarding automation
 */

const { createLogger } = require('../../utils/logger');
const AirtableClient = require('../airtable/AirtableClient');
const ClaudeAnalyzer = require('../ai/ClaudeAnalyzer');
const ElevenLabsVoice = require('../ai/ElevenLabsVoice');
const EmailService = require('../email/EmailService');

const logger = createLogger('OnboardingOrchestrator');

class OnboardingOrchestrator {
  constructor() {
    this.airtable = new AirtableClient();
    this.claude = new ClaudeAnalyzer();
    this.voice = new ElevenLabsVoice();
    this.email = new EmailService();
  }

  /**
   * Process sales call (triggered by Zapier webhook)
   */
  async processSalesCall(data) {
    try {
      logger.info('Processing sales call', { 
        clientName: data.clientName,
        clientEmail: data.clientEmail 
      });

      const startTime = Date.now();

      // Step 1: Find or create client in Airtable
      const clientId = await this.getOrCreateClient(data);
      if (!clientId) {
        throw new Error('Failed to create/find client');
      }

      // Step 2: AI analyze transcript
      logger.info('Analyzing transcript with Claude AI...');
      const analysisResult = await this.claude.analyzeSalesCall(
        data.transcript,
        data.clientName
      );

      if (!analysisResult.success) {
        throw new Error('AI analysis failed: ' + analysisResult.error);
      }

      const analysis = analysisResult.analysis;

      // Step 3: Update Airtable with personality profile
      logger.info('Updating personality profile...');
      await this.airtable.updatePersonalityProfile(clientId, {
        primaryPattern: analysis.primaryPattern,
        secondaryPattern: analysis.secondaryPattern,
        attachmentStyle: analysis.attachmentStyle,
        coreWounds: analysis.coreWounds.join(', '),
        limitingBeliefs: analysis.limitingBeliefs.join(', '),
        datingGoal: analysis.datingGoal,
        challenges: analysis.challenges.join(', '),
        communicationStyle: analysis.communicationStyle,
        energyLevel: analysis.energyLevel,
        motivationLevel: analysis.motivationLevel,
        aiConfidence: analysis.aiConfidence,
        summary: analysis.summary
      });

      // Step 4: Create call transcript record
      logger.info('Creating call transcript record...');
      await this.airtable.createCallTranscript(clientId, {
        callType: 'Sales',
        fullText: data.transcript,
        fathomUrl: data.fathomUrl,
        aiAnalysis: JSON.stringify(analysis, null, 2),
        keyQuotes: analysis.keyQuotes.join('\n\n'),
        breakthroughs: false
      });

      // Step 5: Generate custom meditation
      logger.info('Generating custom meditation...');
      const meditationResult = await this.claude.generateMeditation({
        name: data.clientName,
        primaryPattern: analysis.primaryPattern,
        secondaryPattern: analysis.secondaryPattern,
        attachmentStyle: analysis.attachmentStyle,
        coreWounds: analysis.coreWounds.join(', '),
        limitingBeliefs: analysis.limitingBeliefs.join(', '),
        challenges: analysis.challenges.join(', ')
      });

      if (!meditationResult.success) {
        throw new Error('Meditation generation failed: ' + meditationResult.error);
      }

      // Step 6: Generate audio with ElevenLabs
      logger.info('Generating audio with ElevenLabs...');
      const audioResult = await this.voice.generateMeditationAudio(
        meditationResult.script,
        data.clientName
      );

      if (!audioResult.success) {
        throw new Error('Audio generation failed: ' + audioResult.error);
      }

      // Step 7: Create meditation record in Airtable
      const meditationId = await this.airtable.createMeditation(clientId, {
        topic: meditationResult.topic,
        script: meditationResult.script,
        audioUrl: audioResult.audioUrl,
        sent: false
      });

      // Step 8: Send email with meditation
      logger.info('Sending meditation email...');
      const emailResult = await this.email.sendMeditationEmail(
        data.clientEmail,
        data.clientName,
        audioResult.audioUrl,
        {
          coreWounds: analysis.coreWounds.join('<br>• ')
        }
      );

      if (emailResult.success) {
        await this.airtable.markMeditationSent(meditationId);
      }

      // Step 9: Send Typeform survey
      if (process.env.TYPEFORM_URL) {
        logger.info('Sending Typeform survey...');
        const typeformUrl = `${process.env.TYPEFORM_URL}?name=${encodeURIComponent(data.clientName)}&email=${encodeURIComponent(data.clientEmail)}`;
        await this.email.sendTypeformSurvey(
          data.clientEmail,
          data.clientName,
          typeformUrl
        );
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

      logger.info('Sales call processing complete', {
        clientId,
        totalTime: `${totalTime}s`,
        analysisConfidence: analysis.aiConfidence
      });

      return {
        success: true,
        clientId,
        analysis,
        meditationUrl: audioResult.audioUrl,
        processingTime: totalTime
      };

    } catch (error) {
      logger.error('Sales call processing failed', { 
        error: error.message,
        stack: error.stack 
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get or create client in Airtable
   */
  async getOrCreateClient(data) {
    // Try to find existing client by email
    let client = await this.airtable.findClientByEmail(data.clientEmail);

    if (client) {
      logger.info('Found existing client', { clientId: client.id });
      
      // Update to "Client" status if was lead
      if (client.status === 'Lead') {
        await this.airtable.convertToClient(client.id);
      }

      return client.id;
    }

    // Create new client
    logger.info('Creating new client', { email: data.clientEmail });
    
    const clientId = await this.airtable.createClient({
      name: data.clientName,
      email: data.clientEmail,
      phone: data.clientPhone || '',
      status: 'Client',
      program: data.program || 'Embodied Dating Mastermind'
    });

    return clientId;
  }

  /**
   * Process ongoing 1:1 call
   */
  async processOngoingCall(data) {
    try {
      logger.info('Processing ongoing call', { clientEmail: data.clientEmail });

      const client = await this.airtable.findClientByEmail(data.clientEmail);
      if (!client) {
        throw new Error('Client not found');
      }

      // Get call history for context
      const callHistory = await this.airtable.getCallHistory(client.id);

      // Analyze with context
      const analysisResult = await this.claude.analyzeOngoingCall(
        data.transcript,
        client,
        callHistory
      );

      if (!analysisResult.success) {
        throw new Error('Analysis failed: ' + analysisResult.error);
      }

      const analysis = analysisResult.analysis;

      // Create transcript record
      await this.airtable.createCallTranscript(client.id, {
        callType: '1:1',
        fullText: data.transcript,
        fathomUrl: data.fathomUrl,
        aiAnalysis: JSON.stringify(analysis, null, 2),
        keyQuotes: analysis.keyQuotes.join('\n\n'),
        breakthroughs: analysis.breakthroughDetected
      });

      // If breakthrough detected, generate celebration meditation
      if (analysis.breakthroughDetected) {
        logger.info('Breakthrough detected! Generating celebration meditation...');
        
        const meditationResult = await this.claude.generateMeditation({
          name: client.name,
          primaryPattern: client.primaryPattern,
          secondaryPattern: client.secondaryPattern,
          attachmentStyle: client.attachmentStyle,
          coreWounds: 'Celebration and Integration',
          limitingBeliefs: 'Transformed beliefs',
          challenges: 'Anchoring new identity'
        });

        if (meditationResult.success) {
          const audioResult = await this.voice.generateMeditationAudio(
            meditationResult.script,
            client.name
          );

          if (audioResult.success) {
            const meditationId = await this.airtable.createMeditation(client.id, {
              topic: 'Breakthrough Integration',
              script: meditationResult.script,
              audioUrl: audioResult.audioUrl,
              sent: false
            });

            await this.email.sendMeditationEmail(
              client.email,
              client.name,
              audioResult.audioUrl,
              { coreWounds: 'Celebrating your breakthrough!' }
            );

            await this.airtable.markMeditationSent(meditationId);
          }
        }
      }

      // Create coaching prompts
      for (const recommendation of analysis.coachingRecommendations) {
        await this.airtable.createCoachingPrompt(client.id, {
          type: 'Coaching tip',
          text: recommendation
        });
      }

      logger.info('Ongoing call processed', {
        clientId: client.id,
        breakthroughDetected: analysis.breakthroughDetected
      });

      return {
        success: true,
        analysis
      };

    } catch (error) {
      logger.error('Ongoing call processing failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sync Discord engagement to Airtable (called daily)
   */
  async syncDiscordEngagement(userId, metrics) {
    try {
      await this.airtable.updateEngagementMetrics(userId, metrics);
      
      logger.info('Discord engagement synced', { userId });

    } catch (error) {
      logger.error('Engagement sync failed', { error: error.message });
    }
  }
}

module.exports = OnboardingOrchestrator;

