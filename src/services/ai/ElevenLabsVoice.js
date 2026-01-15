/**
 * ElevenLabs Voice Generator
 * Creates audio from meditation scripts using coach's voice clone
 */

const axios = require('axios');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('ElevenLabsVoice');

class ElevenLabsVoice {
  constructor() {
    if (!process.env.ELEVENLABS_API_KEY) {
      logger.error('Missing ElevenLabs API key');
      throw new Error('ElevenLabs not configured');
    }

    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.voiceId = process.env.ELEVENLABS_VOICE_ID; // Your voice clone ID
    this.apiUrl = 'https://api.elevenlabs.io/v1';
  }

  /**
   * Generate audio from text
   */
  async generateAudio(text, options = {}) {
    try {
      logger.info('Generating audio', { textLength: text.length });

      const response = await axios.post(
        `${this.apiUrl}/text-to-speech/${this.voiceId}`,
        {
          text,
          model_id: options.model || 'eleven_multilingual_v2',
          voice_settings: {
            stability: options.stability || 0.5,
            similarity_boost: options.similarityBoost || 0.75,
            style: options.style || 0.5,
            use_speaker_boost: true
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          responseType: 'arraybuffer'
        }
      );

      logger.info('Audio generated successfully', {
        size: response.data.length
      });

      return {
        success: true,
        audioBuffer: response.data,
        format: 'mp3'
      };

    } catch (error) {
      logger.error('Audio generation failed', {
        error: error.message,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload audio to storage and get URL
   */
  async uploadAudio(audioBuffer, filename) {
    try {
      // In production, upload to S3/Digital Ocean Spaces/Cloudinary
      // For now, we'll use a placeholder URL structure
      
      // Example with AWS S3:
      /*
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3();
      
      const params = {
        Bucket: process.env.S3_BUCKET,
        Key: `meditations/${filename}`,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        ACL: 'public-read'
      };
      
      const result = await s3.upload(params).promise();
      return result.Location;
      */

      // Placeholder - replace with actual upload logic
      const placeholderUrl = `https://your-storage.com/meditations/${filename}`;
      
      logger.info('Audio uploaded', { url: placeholderUrl });

      return placeholderUrl;

    } catch (error) {
      logger.error('Audio upload failed', { error: error.message });
      return null;
    }
  }

  /**
   * Generate meditation audio (convenience method)
   */
  async generateMeditationAudio(script, clientName) {
    const sanitizedName = clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = Date.now();
    const filename = `${sanitizedName}_${timestamp}.mp3`;

    // Generate audio
    const result = await this.generateAudio(script, {
      stability: 0.6, // Slightly more stable for meditation
      similarityBoost: 0.8,
      style: 0.3 // Calmer, less expressive
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Upload audio
    const audioUrl = await this.uploadAudio(result.audioBuffer, filename);

    if (!audioUrl) {
      return { success: false, error: 'Upload failed' };
    }

    return {
      success: true,
      audioUrl,
      filename
    };
  }

  /**
   * Get voice info (for testing)
   */
  async getVoiceInfo() {
    try {
      const response = await axios.get(
        `${this.apiUrl}/voices/${this.voiceId}`,
        {
          headers: {
            'xi-api-key': this.apiKey
          }
        }
      );

      return response.data;

    } catch (error) {
      logger.error('Failed to get voice info', { error: error.message });
      return null;
    }
  }

  /**
   * Get available voices
   */
  async getVoices() {
    try {
      const response = await axios.get(
        `${this.apiUrl}/voices`,
        {
          headers: {
            'xi-api-key': this.apiKey
          }
        }
      );

      return response.data.voices;

    } catch (error) {
      logger.error('Failed to get voices', { error: error.message });
      return [];
    }
  }
}

module.exports = ElevenLabsVoice;

