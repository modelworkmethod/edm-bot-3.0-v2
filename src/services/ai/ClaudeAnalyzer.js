/**
 * Claude Analyzer
 * AI analysis of sales calls and coaching sessions
 */

const Anthropic = require('@anthropic-ai/sdk');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('ClaudeAnalyzer');

class ClaudeAnalyzer {
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.error('Missing Anthropic API key');
      throw new Error('Claude API not configured');
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  /**
   * Analyze sales call transcript
   */
  async analyzeSalesCall(transcript, clientName) {
    try {
      logger.info('Analyzing sales call', { clientName });

      const prompt = this.buildSalesCallPrompt(transcript, clientName);

      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;
      
      // Parse JSON response
      const analysis = JSON.parse(responseText);

      logger.info('Sales call analyzed', {
        clientName,
        primaryPattern: analysis.primaryPattern,
        attachmentStyle: analysis.attachmentStyle
      });

      return {
        success: true,
        analysis
      };

    } catch (error) {
      logger.error('Sales call analysis failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build sales call analysis prompt
   */
  buildSalesCallPrompt(transcript, clientName) {
    return `You are an expert relationship and dating coach analyzing a sales call transcript.

CLIENT NAME: ${clientName}

FRAMEWORKS TO USE:

1. FIVE PERSONALITY PATTERNS (from "Characterological Transformation"):
   - RIGID: Overly controlled, fears vulnerability, perfectionist
   - ENDURER: Self-sacrificing, puts others first, difficulty receiving
   - LEAVER: Fears engulfment, needs space, commitment issues
   - MERGER: Fears abandonment, seeks external validation, anxious
   - EMOTIONAL: Chaotic, impulsive, difficulty with structure

2. ATTACHMENT STYLES:
   - SECURE: Comfortable with intimacy and independence
   - ANXIOUS: Fears abandonment, seeks reassurance
   - AVOIDANT: Fears engulfment, values independence
   - FEARFUL-AVOIDANT: Wants intimacy but fears it

TRANSCRIPT:
${transcript}

ANALYZE AND RETURN ONLY VALID JSON (no markdown, no explanation):
{
  "primaryPattern": "One of: Rigid, Endurer, Leaver, Merger, Emotional",
  "secondaryPattern": "Secondary pattern if present, or null",
  "attachmentStyle": "One of: Secure, Anxious, Avoidant, Fearful-Avoidant",
  "coreWounds": ["2-5 core emotional wounds identified"],
  "limitingBeliefs": ["3-7 limiting beliefs about dating/relationships/self"],
  "datingGoal": "Their primary stated or implied goal",
  "challenges": ["3-5 main challenges they face"],
  "strengths": ["3-5 existing strengths they have"],
  "communicationStyle": "How they communicate (1 sentence)",
  "energyLevel": 1-10,
  "motivationLevel": 1-10,
  "aiConfidence": 1-100,
  "coachingFocus": "What to focus on first in coaching (2-3 sentences)",
  "keyQuotes": ["2-5 powerful quotes from the call that reveal their psychology"],
  "summary": "2-3 sentence summary of their situation"
}

CRITICAL: Return ONLY the JSON object, no other text.`;
  }

  /**
   * Generate custom meditation script
   */
  async generateMeditation(clientProfile) {
    try {
      logger.info('Generating meditation', { 
        clientName: clientProfile.name,
        pattern: clientProfile.primaryPattern
      });

      const prompt = this.buildMeditationPrompt(clientProfile);

      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const script = message.content[0].text;

      logger.info('Meditation generated', {
        clientName: clientProfile.name,
        scriptLength: script.length
      });

      return {
        success: true,
        script,
        topic: this.getMeditationTopic(clientProfile)
      };

    } catch (error) {
      logger.error('Meditation generation failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build meditation generation prompt
   */
  buildMeditationPrompt(profile) {
    return `Create a personalized 10-minute Sedona Method guided releasing meditation script.

CLIENT PROFILE:
- Name: ${profile.name}
- Personality Pattern: ${profile.primaryPattern}${profile.secondaryPattern ? '/' + profile.secondaryPattern : ''}
- Attachment Style: ${profile.attachmentStyle}
- Core Wounds: ${profile.coreWounds}
- Limiting Beliefs: ${profile.limitingBeliefs}
- Current Challenges: ${profile.challenges}

SEDONA METHOD STRUCTURE:

1. GROUNDING (90 seconds)
   - Guide them to notice their body
   - Focus on breath
   - Create safety

2. IDENTIFY THE FEELING (2 minutes)
   - Help them locate where they hold the fear/shame/unworthiness
   - Name the specific feeling related to their core wounds
   - Welcome it fully

3. THE QUESTIONS (4 minutes)
   - "Could you let this feeling go?"
   - "Would you let it go?"
   - "When?"
   - Guide them to release NOW

4. REFRAMING (2 minutes)
   - Install new empowering belief specific to their limiting beliefs
   - Future pacing with confidence

5. INTEGRATION (90 seconds)
   - Gratitude
   - Commitment to new way of being
   - Return to present

TONE & STYLE:
- Warm, calm, like a trusted friend
- Use "you" language (second person)
- Speak slowly and deliberately
- Include pauses: [PAUSE 5 SEC] where appropriate
- Be specific to their wounds (don't be generic)
- Address their specific personality pattern challenges

LENGTH: 1500-1800 words for approximately 10 minutes when read slowly.

Write the complete script ready for text-to-speech conversion. Do not include any commentary, just the script.`;
  }

  /**
   * Get meditation topic based on profile
   */
  getMeditationTopic(profile) {
    const topics = {
      'Merger': 'Releasing Need for External Validation',
      'Leaver': 'Opening to Intimacy and Connection',
      'Rigid': 'Softening Control and Embracing Vulnerability',
      'Endurer': 'Receiving Love and Setting Boundaries',
      'Emotional': 'Finding Inner Stability and Grounding'
    };

    return topics[profile.primaryPattern] || 'Releasing Fear and Embracing Authenticity';
  }

  /**
   * Analyze ongoing 1:1 call with context
   */
  async analyzeOngoingCall(transcript, clientProfile, callHistory) {
    try {
      logger.info('Analyzing ongoing call', { clientName: clientProfile.name });

      const prompt = this.buildOngoingCallPrompt(transcript, clientProfile, callHistory);

      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;
      const analysis = JSON.parse(responseText);

      logger.info('Ongoing call analyzed', {
        clientName: clientProfile.name,
        breakthroughs: analysis.breakthroughs
      });

      return {
        success: true,
        analysis
      };

    } catch (error) {
      logger.error('Ongoing call analysis failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build ongoing call analysis prompt
   */
  buildOngoingCallPrompt(transcript, profile, history) {
    const historyContext = history.map(h => 
      `- ${h.callDate}: ${h.aiAnalysis}`
    ).join('\n');

    return `Analyze this coaching call in context of the client's history.

CLIENT PROFILE:
- Name: ${profile.name}
- Pattern: ${profile.primaryPattern}/${profile.secondaryPattern || 'none'}
- Attachment: ${profile.attachmentStyle}
- Core Wounds: ${profile.coreWounds}
- Current Challenges: ${profile.currentChallenges}

PREVIOUS CALL INSIGHTS:
${historyContext || 'First call'}

CURRENT CALL TRANSCRIPT:
${transcript}

ANALYZE AND RETURN JSON:
{
  "progressUpdates": ["What progress has been made since last call"],
  "newInsights": ["New patterns or insights discovered"],
  "breakthroughs": ["Any breakthroughs or aha moments"],
  "breakthroughDetected": true/false,
  "coachingRecommendations": ["What to focus on next session"],
  "resourcesToSend": ["Specific resources/exercises to recommend"],
  "redFlags": ["Any concerning patterns or regression"],
  "keyQuotes": ["Powerful quotes from this call"],
  "updatedChallenges": ["Current challenges (updated if changed)"],
  "energyShift": "How their energy/motivation changed (1 sentence)",
  "nextSessionFocus": "Specific focus for next session (2-3 sentences)"
}

Return ONLY the JSON, no other text.`;
  }

  /**
   * Generate coaching prompt based on client data
   */
  async generateCoachingPrompt(clientProfile, context) {
    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Generate a coaching prompt for this situation:

CLIENT: ${clientProfile.name}
PATTERN: ${clientProfile.primaryPattern}
ATTACHMENT: ${clientProfile.attachmentStyle}
CURRENT CHALLENGES: ${clientProfile.currentChallenges}

CONTEXT: ${context}

Generate a specific, actionable coaching recommendation (2-3 sentences).`
        }]
      });

      return message.content[0].text;

    } catch (error) {
      logger.error('Prompt generation failed', { error: error.message });
      return null;
    }
  }
}

module.exports = ClaudeAnalyzer;

