/**
 * Zapier Webhook Endpoints
 * Receives data from Zapier automations
 */

const express = require('express');
const router = express.Router();
const { createLogger } = require('../../utils/logger');
const OnboardingOrchestrator = require('../../services/automation/OnboardingOrchestrator');

const logger = createLogger('ZapierWebhooks');

// Webhook authentication
const authenticateWebhook = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.ZAPIER_WEBHOOK_KEY) {
    logger.warn('Unauthorized webhook attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

/**
 * POST /api/webhooks/sales-call
 * Triggered by Zapier when new sales call recorded
 */
router.post('/sales-call', authenticateWebhook, async (req, res) => {
  try {
    logger.info('Sales call webhook received', { 
      clientEmail: req.body.clientEmail 
    });

    const orchestrator = new OnboardingOrchestrator();
    
    const result = await orchestrator.processSalesCall({
      clientName: req.body.clientName,
      clientEmail: req.body.clientEmail,
      clientPhone: req.body.clientPhone,
      transcript: req.body.transcript,
      fathomUrl: req.body.fathomUrl,
      program: req.body.program
    });

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }

    res.json({
      success: true,
      clientId: result.clientId,
      meditationUrl: result.meditationUrl,
      processingTime: result.processingTime,
      analysisConfidence: result.analysis.aiConfidence
    });

  } catch (error) {
    logger.error('Sales call webhook failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/webhooks/ongoing-call
 * Triggered by Zapier for 1:1 coaching calls
 */
router.post('/ongoing-call', authenticateWebhook, async (req, res) => {
  try {
    logger.info('Ongoing call webhook received', { 
      clientEmail: req.body.clientEmail 
    });

    const orchestrator = new OnboardingOrchestrator();
    
    const result = await orchestrator.processOngoingCall({
      clientEmail: req.body.clientEmail,
      transcript: req.body.transcript,
      fathomUrl: req.body.fathomUrl
    });

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }

    res.json({
      success: true,
      breakthroughDetected: result.analysis.breakthroughDetected,
      analysis: result.analysis
    });

  } catch (error) {
    logger.error('Ongoing call webhook failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/webhooks/typeform-response
 * Triggered when client completes intake form
 */
router.post('/typeform-response', authenticateWebhook, async (req, res) => {
  try {
    logger.info('Typeform response received', { 
      email: req.body.email 
    });

    const AirtableClient = require('../../services/airtable/AirtableClient');
    const airtable = new AirtableClient();

    const client = await airtable.findClientByEmail(req.body.email);
    
    if (client) {
      // Compare AI predictions vs self-report
      const discrepancies = [];

      if (req.body.personalityPattern !== client.primaryPattern) {
        discrepancies.push({
          field: 'Personality Pattern',
          aiPrediction: client.primaryPattern,
          selfReport: req.body.personalityPattern
        });
      }

      if (req.body.attachmentStyle !== client.attachmentStyle) {
        discrepancies.push({
          field: 'Attachment Style',
          aiPrediction: client.attachmentStyle,
          selfReport: req.body.attachmentStyle
        });
      }

      // Log discrepancies for review
      if (discrepancies.length > 0) {
        logger.info('Typeform discrepancies detected', {
          clientId: client.id,
          discrepancies
        });
      }

      res.json({
        success: true,
        discrepancies
      });
    } else {
      res.status(404).json({ error: 'Client not found' });
    }

  } catch (error) {
    logger.error('Typeform webhook failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/webhooks/test
 * Test endpoint
 */
router.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Zapier webhooks are working' 
  });
});

module.exports = router;

