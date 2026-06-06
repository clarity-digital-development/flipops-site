import { WebClient } from '@slack/web-api';
import nodemailer from 'nodemailer';

// Slack Configuration
const slackClient = process.env.SLACK_BOT_TOKEN
  ? new WebClient(process.env.SLACK_BOT_TOKEN)
  : null;

const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || 'C09JDCY5SKH';

// Gmail Configuration
const gmailTransporter = process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_ADDRESS,
        pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, ''), // Remove spaces from app password
      },
    })
  : null;

// Notification Types
export enum NotificationType {
  PROPERTY_IMPORTED = 'property_imported',
  HIGH_SCORE_PROPERTY = 'high_score_property',
  IMPORT_ERROR = 'import_error',
  WEBHOOK_ERROR = 'webhook_error',
  BATCH_COMPLETE = 'batch_complete',
}

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Send notification to Slack channel
 */
export async function sendSlackNotification(payload: NotificationPayload) {
  if (!slackClient) {
    console.log('Slack client not configured');
    return;
  }

  try {
    const color =
      payload.priority === 'urgent' ? '#FF0000' :
      payload.priority === 'high' ? '#FFA500' :
      payload.priority === 'medium' ? '#FFFF00' :
      '#00FF00';

    const result = await slackClient.chat.postMessage({
      channel: SLACK_CHANNEL_ID,
      text: payload.title,
      attachments: [
        {
          color,
          title: payload.title,
          text: payload.message,
          fields: payload.data ? Object.entries(payload.data).map(([key, value]) => ({
            title: key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.slice(1),
            value: String(value),
            short: true,
          })) : [],
          footer: 'FlipOps',
          ts: String(Date.now() / 1000),
        },
      ],
    });

    return result;
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}

/**
 * Send notification via Gmail
 */
export async function sendEmailNotification(
  to: string,
  payload: NotificationPayload
) {
  if (!gmailTransporter) {
    console.log('Gmail transporter not configured');
    return;
  }

  try {
    const priorityEmoji =
      payload.priority === 'urgent' ? '🚨' :
      payload.priority === 'high' ? '⚠️' :
      payload.priority === 'medium' ? '📢' :
      '✅';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${priorityEmoji} ${payload.title}</h2>
        <p style="color: #666; font-size: 16px;">${payload.message}</p>

        ${payload.data ? `
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            ${Object.entries(payload.data).map(([key, value]) => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">
                  ${key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.slice(1)}:
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">
                  ${value}
                </td>
              </tr>
            `).join('')}
          </table>
        ` : ''}

        <hr style="margin-top: 30px; border: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          Sent by FlipOps Automation System<br>
          ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    const result = await gmailTransporter.sendMail({
      from: `FlipOps <${process.env.GMAIL_ADDRESS}>`,
      to,
      subject: `${priorityEmoji} ${payload.title}`,
      html,
    });

    return result;
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

/**
 * Send notification to all configured channels
 */
export async function sendNotification(payload: NotificationPayload) {
  const promises = [];

  // Send to Slack
  if (process.env.SLACK_BOT_TOKEN) {
    promises.push(sendSlackNotification(payload));
  }

  // Send to Email
  if (process.env.GMAIL_APP_PASSWORD && process.env.NOTIFICATION_EMAIL) {
    promises.push(sendEmailNotification(process.env.NOTIFICATION_EMAIL, payload));
  }

  // Wait for all notifications to complete
  const results = await Promise.allSettled(promises);

  return results;
}

/**
 * Helper function for property import notifications
 */
export async function notifyPropertyImport(properties: any[], highScoreThreshold = 70) {
  const highScoreProperties = properties.filter(p => p.score >= highScoreThreshold);

  if (highScoreProperties.length > 0) {
    await sendNotification({
      type: NotificationType.HIGH_SCORE_PROPERTY,
      title: `🔥 ${highScoreProperties.length} High-Score Properties Found!`,
      message: `Found properties with scores above ${highScoreThreshold}`,
      data: {
        count: highScoreProperties.length,
        top_address: highScoreProperties[0]?.address,
        top_score: highScoreProperties[0]?.score,
        avg_score: Math.round(
          highScoreProperties.reduce((sum, p) => sum + p.score, 0) / highScoreProperties.length
        ),
      },
      priority: 'high',
    });
  }

  // Send batch complete notification
  await sendNotification({
    type: NotificationType.BATCH_COMPLETE,
    title: `Import Complete: ${properties.length} Properties`,
    message: `Successfully processed ${properties.length} properties`,
    data: {
      total_count: properties.length,
      high_score_count: highScoreProperties.length,
      timestamp: new Date().toISOString(),
    },
    priority: 'medium',
  });
}

/**
 * Helper function for error notifications
 */
export async function notifyError(error: Error, context: string) {
  await sendNotification({
    type: NotificationType.WEBHOOK_ERROR,
    title: `❌ Error in ${context}`,
    message: error.message,
    data: {
      error_type: error.name,
      context,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
    priority: 'urgent',
  });
}