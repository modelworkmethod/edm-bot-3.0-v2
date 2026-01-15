/**
 * Email Service
 * Sends emails via SendGrid
 */

const sgMail = require('@sendgrid/mail');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('EmailService');

class EmailService {
  constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      logger.warn('SendGrid not configured - emails will be logged only');
      this.enabled = false;
      return;
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.enabled = true;
    this.fromEmail = process.env.FROM_EMAIL || 'coach@yourdomain.com';
    this.fromName = process.env.FROM_NAME || 'Your Name';
  }

  /**
   * Send meditation email
   */
  async sendMeditationEmail(toEmail, clientName, meditationUrl, profile) {
    const subject = '🎯 Your Personal Breakthrough Session - Start Right Now';
    
    const html = this.buildMeditationEmailHTML(clientName, meditationUrl, profile);
    const text = this.buildMeditationEmailText(clientName, meditationUrl, profile);

    return await this.send(toEmail, subject, html, text);
  }

  /**
   * Build meditation email HTML
   */
  buildMeditationEmailHTML(clientName, audioUrl, profile) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 10px; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .cta-button:hover { background: #5568d3; }
    .wounds { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
    .footer { text-align: center; color: #666; font-size: 14px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎯 Your Personal Breakthrough Session</h1>
  </div>
  
  <div class="content">
    <p>Hey ${clientName},</p>
    
    <p><strong>Our call just ended and I'm already fired up about your transformation.</strong></p>
    
    <p>Based on everything you shared, I created something special for you.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${audioUrl}" class="cta-button" style="color: white;">
        🎧 LISTEN TO YOUR GUIDED SESSION
      </a>
    </div>
    
    <p>This is a custom 10-minute releasing meditation designed specifically for what you're working through:</p>
    
    <div class="wounds">
      ${profile.coreWounds ? `<strong>Core Focus Areas:</strong><br>${profile.coreWounds}` : ''}
    </div>
    
    <p><strong>Listen to it RIGHT NOW while everything from our call is still fresh.</strong></p>
    
    <p>This isn't generic. This is YOUR breakthrough session, created just for you based on your specific situation.</p>
    
    <p>This is how we start the real work.</p>
    
    <p>Talk soon,<br><strong>${this.fromName}</strong></p>
  </div>
  
  <div class="footer">
    <p>P.S. Your intake form is coming in a separate email - complete it today.</p>
    <p>P.P.S. Join the brotherhood on Discord (link coming soon).</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Build meditation email plain text
   */
  buildMeditationEmailText(clientName, audioUrl, profile) {
    return `
YOUR PERSONAL BREAKTHROUGH SESSION

Hey ${clientName},

Our call just ended and I'm already fired up about your transformation.

Based on everything you shared, I created something special for you.

→ LISTEN TO YOUR GUIDED SESSION:
${audioUrl}

This is a custom 10-minute releasing meditation designed specifically for what you're working through:

${profile.coreWounds || 'Your specific challenges'}

Listen to it RIGHT NOW while everything from our call is still fresh.

This isn't generic. This is YOUR breakthrough session, created just for you.

This is how we start the real work.

- ${this.fromName}

P.S. Your intake form is coming in a separate email - complete it today.
P.P.S. Join the brotherhood on Discord (link coming soon).
    `;
  }

  /**
   * Send email via SendGrid
   */
  async send(to, subject, html, text) {
    if (!this.enabled) {
      logger.warn('Email not sent (SendGrid not configured)', { to, subject });
      return { success: false, error: 'SendGrid not configured' };
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        text,
        html
      };

      await sgMail.send(msg);

      logger.info('Email sent successfully', { to, subject });

      return { success: true };

    } catch (error) {
      logger.error('Email send failed', {
        error: error.message,
        to,
        subject
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send Typeform survey
   */
  async sendTypeformSurvey(toEmail, clientName, typeformUrl) {
    const subject = '📋 Complete Your Intake Form';
    
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Hey ${clientName},</h2>
  
  <p>One more step to complete your onboarding!</p>
  
  <p>Please fill out this quick intake form to confirm your personality profile and goals:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${typeformUrl}" style="display: inline-block; background: #667eea; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
      Complete Intake Form
    </a>
  </div>
  
  <p>This should only take 5-10 minutes and helps me personalize your coaching.</p>
  
  <p>- ${this.fromName}</p>
</body>
</html>
    `;

    const text = `Hey ${clientName},\n\nComplete your intake form here: ${typeformUrl}\n\nThis helps me personalize your coaching.\n\n- ${this.fromName}`;

    return await this.send(toEmail, subject, html, text);
  }
}

module.exports = EmailService;

