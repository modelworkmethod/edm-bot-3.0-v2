/**
 * Automation Logger
 * Logs all automation events for monitoring
 */

const { createLogger } = require('../../utils/logger');
const { query } = require('../../database/postgres');

const logger = createLogger('AutomationLogger');

class AutomationLogger {
  /**
   * Log automation event
   */
  async logEvent(eventType, data) {
    try {
      await query(
        `INSERT INTO automation_logs
         (event_type, event_id, client_email, client_id, status, 
          processing_time_ms, details, error_message, triggered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          eventType,
          data.eventId || null,
          data.clientEmail || null,
          data.clientId || null,
          data.status || 'success',
          data.processingTime || null,
          data.details || null,
          data.error || null,
          data.triggeredBy || 'unknown'
        ]
      );

      logger.info('Automation event logged', { 
        eventType, 
        status: data.status 
      });

    } catch (error) {
      logger.error('Failed to log automation event', { 
        error: error.message 
      });
    }
  }

  /**
   * Log sales call processing
   */
  async logSalesCall(clientEmail, clientId, success, processingTime, details, error = null) {
    await this.logEvent('sales_call_processed', {
      clientEmail,
      clientId,
      status: success ? 'success' : 'failed',
      processingTime,
      details,
      error,
      triggeredBy: 'zapier'
    });
  }

  /**
   * Log ongoing call processing
   */
  async logOngoingCall(clientEmail, clientId, success, processingTime, details, error = null) {
    await this.logEvent('ongoing_call_processed', {
      clientEmail,
      clientId,
      status: success ? 'success' : 'failed',
      processingTime,
      details,
      error,
      triggeredBy: 'zapier'
    });
  }

  /**
   * Log meditation generation
   */
  async logMeditationGenerated(clientEmail, success, processingTime, audioUrl, error = null) {
    await this.logEvent('meditation_generated', {
      clientEmail,
      status: success ? 'success' : 'failed',
      processingTime,
      details: audioUrl,
      error,
      triggeredBy: 'automation'
    });
  }

  /**
   * Log email sent
   */
  async logEmailSent(clientEmail, emailType, success, error = null) {
    await this.logEvent('email_sent', {
      clientEmail,
      status: success ? 'success' : 'failed',
      details: emailType,
      error,
      triggeredBy: 'automation'
    });
  }

  /**
   * Log webhook request
   */
  async logWebhookRequest(endpoint, method, authenticated, statusCode, responseTime, payload = null) {
    try {
      await query(
        `INSERT INTO webhook_requests
         (endpoint, method, authenticated, status_code, response_time_ms, 
          request_payload, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          endpoint,
          method,
          authenticated,
          statusCode,
          responseTime,
          payload ? JSON.stringify(payload).substring(0, 5000) : null
        ]
      );

    } catch (error) {
      logger.error('Failed to log webhook request', { error: error.message });
    }
  }
}

module.exports = AutomationLogger;

