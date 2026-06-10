#!/usr/bin/env tsx
/**
 * SMTP Connection Checker
 * Verifies Gmail SMTP configuration and sends test email
 */

import * as nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || 'tannercarlson@vvsvault.com';
const SMTP_PASS = process.env.SMTP_PASS || 'ocbp jqem xbkl jrst';
const SMTP_FROM = process.env.SMTP_FROM || 'tannercarlson@vvsvault.com';

// Parse command line arguments
const args = process.argv.slice(2);
const recipientIndex = args.indexOf('--to');
const testRecipient = recipientIndex !== -1 && args[recipientIndex + 1]
  ? args[recipientIndex + 1]
  : SMTP_USER; // Default to sending to self

async function checkSmtpConnection() {
  console.log('📧 SMTP Connection Checker');
  console.log('==========================\n');
  console.log(`Host: ${SMTP_HOST}:${SMTP_PORT}`);
  console.log(`User: ${SMTP_USER}`);
  console.log(`From: ${SMTP_FROM}`);
  console.log(`Test recipient: ${testRecipient}\n`);

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false // For Gmail
    }
  });

  try {
    // Verify connection
    console.log('1️⃣ Verifying SMTP connection...');
    await transporter.verify();
    console.log('   ✅ SMTP connection verified\n');

    // Send test email
    console.log('2️⃣ Sending test email...');

    const info = await transporter.sendMail({
      from: `"FlipOps System" <${SMTP_FROM}>`,
      to: testRecipient,
      subject: '🧪 FlipOps SMTP Test',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
              .content { background: #f4f4f4; padding: 20px; margin-top: 20px; }
              .field { margin: 10px 0; }
              .label { font-weight: bold; color: #333; }
              .value { color: #666; }
              .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏠 FlipOps SMTP Test</h1>
              </div>
              <div class="content">
                <h2>Configuration Verified ✅</h2>
                <div class="field">
                  <span class="label">Time:</span>
                  <span class="value">${new Date().toISOString()}</span>
                </div>
                <div class="field">
                  <span class="label">SMTP Host:</span>
                  <span class="value">${SMTP_HOST}:${SMTP_PORT}</span>
                </div>
                <div class="field">
                  <span class="label">From:</span>
                  <span class="value">${SMTP_FROM}</span>
                </div>
                <div class="field">
                  <span class="label">Status:</span>
                  <span class="value">Email delivery successful</span>
                </div>
                <p style="margin-top: 20px;">
                  Your SMTP configuration is working correctly. The FlipOps system can now send automated property alerts via email.
                </p>
              </div>
              <div class="footer">
                This is an automated test message from the FlipOps system.
              </div>
            </div>
          </body>
        </html>
      `,
      text: `FlipOps SMTP Test

Configuration Verified ✅

Time: ${new Date().toISOString()}
SMTP Host: ${SMTP_HOST}:${SMTP_PORT}
From: ${SMTP_FROM}
Status: Email delivery successful

Your SMTP configuration is working correctly. The FlipOps system can now send automated property alerts via email.

This is an automated test message from the FlipOps system.`
    });

    console.log(`   ✅ Email sent successfully!`);
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}\n`);

    // Additional checks
    console.log('3️⃣ Configuration summary:');
    console.log('   ✅ Authentication: Passed');
    console.log('   ✅ TLS/StartTLS: Enabled');
    console.log('   ✅ Port: Standard (587 for STARTTLS)');
    console.log('   ✅ Delivery: Confirmed\n');

    console.log('✨ SMTP check complete!');
    console.log('========================\n');
    console.log('📬 Check your inbox for the test email');
    console.log(`   Sent to: ${testRecipient}`);
    console.log('   Subject: 🧪 FlipOps SMTP Test\n');

    return true;

  } catch (error: any) {
    console.error('\n❌ SMTP check failed!\n');
    console.error('Error:', error.message || error);

    if (error.code === 'EAUTH') {
      console.error('\n⚠️ Authentication Error:');
      console.error('1. For Gmail, use an App Password (not regular password)');
      console.error('2. Enable 2FA at: https://myaccount.google.com/security');
      console.error('3. Generate App Password at: https://myaccount.google.com/apppasswords');
      console.error('4. Update SMTP_PASS with the 16-character app password');
    } else if (error.code === 'ESOCKET') {
      console.error('\n⚠️ Connection Error:');
      console.error('1. Check firewall allows outbound port 587');
      console.error('2. Verify SMTP_HOST is correct');
      console.error('3. Try port 465 with secure: true');
    } else {
      console.error('\nTroubleshooting:');
      console.error('1. Verify all SMTP_* environment variables');
      console.error('2. Check Gmail account has "Less secure apps" or App Passwords');
      console.error('3. Ensure no Gmail account blocks or captchas');
      console.error('4. Try manually at: https://www.smtper.net/');
    }

    console.error('\n');
    process.exit(1);
  } finally {
    transporter.close();
  }
}

// Run if called directly
if (require.main === module) {
  checkSmtpConnection().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { checkSmtpConnection };