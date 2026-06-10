import Nylas from 'nylas';

// Initialize Nylas client
const nylasConfig = {
  apiKey: process.env.NYLAS_API_KEY || '',
  apiUri: process.env.NYLAS_API_URI || 'https://api.us.nylas.com',
};

const nylas = new Nylas(nylasConfig);

export { nylas };

/**
 * Get the default grant ID from environment (for development/single-user setups)
 */
export function getDefaultGrantId(): string | null {
  return process.env.NYLAS_GRANT_ID || null;
}

// Types for email messages
export interface EmailParticipant {
  name?: string;
  email: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: EmailParticipant[];
  to: EmailParticipant[];
  cc?: EmailParticipant[];
  bcc?: EmailParticipant[];
  date: number; // Unix timestamp
  body: string;
  snippet: string;
  unread: boolean;
  starred: boolean;
  folders?: string[];
  attachments?: {
    id: string;
    filename: string;
    contentType: string;
    size: number;
  }[];
}

export interface EmailThread {
  id: string;
  subject: string;
  participants: EmailParticipant[];
  lastMessageDate: number;
  messageCount: number;
  unread: boolean;
  snippet: string;
  messages?: EmailMessage[];
}

export interface SendEmailOptions {
  grantId: string;
  to: EmailParticipant[];
  subject: string;
  body: string;
  cc?: EmailParticipant[];
  bcc?: EmailParticipant[];
  replyToMessageId?: string;
  attachments?: {
    filename: string;
    contentType: string;
    content: string; // Base64 encoded
  }[];
}

/**
 * Get the OAuth URL to connect a user's email account
 */
export function getAuthUrl(redirectUri: string, state?: string): string {
  const authUrl = nylas.auth.urlForOAuth2({
    clientId: process.env.NYLAS_CLIENT_ID || process.env.NYLAS_API_KEY || '',
    redirectUri,
    loginHint: undefined,
    state,
  });
  return authUrl;
}

/**
 * Exchange auth code for grant (after OAuth callback)
 */
export async function exchangeCodeForGrant(code: string, redirectUri: string) {
  try {
    const response = await nylas.auth.exchangeCodeForToken({
      clientId: process.env.NYLAS_CLIENT_ID || process.env.NYLAS_API_KEY || '',
      redirectUri,
      code,
    });
    return {
      success: true,
      grantId: response.grantId,
      email: response.email,
    };
  } catch (error) {
    console.error('Nylas auth exchange error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to exchange code',
    };
  }
}

/**
 * Get messages for a connected email account
 */
export async function getMessages(
  grantId: string,
  options?: {
    limit?: number;
    pageToken?: string;
    unread?: boolean;
    from?: string;
    to?: string;
    subject?: string;
    receivedAfter?: number;
    receivedBefore?: number;
  }
) {
  try {
    const queryParams: Record<string, any> = {
      limit: options?.limit || 50,
    };

    if (options?.pageToken) queryParams.pageToken = options.pageToken;
    if (options?.unread !== undefined) queryParams.unread = options.unread;
    if (options?.from) queryParams.from = options.from;
    if (options?.to) queryParams.to = options.to;
    if (options?.subject) queryParams.subject = options.subject;
    if (options?.receivedAfter) queryParams.receivedAfter = options.receivedAfter;
    if (options?.receivedBefore) queryParams.receivedBefore = options.receivedBefore;

    const response = await nylas.messages.list({
      identifier: grantId,
      queryParams,
    });

    return {
      success: true,
      messages: response.data,
      nextPageToken: response.nextCursor,
    };
  } catch (error) {
    console.error('Nylas get messages error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch messages',
      messages: [],
    };
  }
}

/**
 * Get a single message by ID
 */
export async function getMessage(grantId: string, messageId: string) {
  try {
    const message = await nylas.messages.find({
      identifier: grantId,
      messageId,
    });

    return {
      success: true,
      message: message.data,
    };
  } catch (error) {
    console.error('Nylas get message error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch message',
    };
  }
}

/**
 * Get email threads
 */
export async function getThreads(
  grantId: string,
  options?: {
    limit?: number;
    pageToken?: string;
    unread?: boolean;
    from?: string;
    to?: string;
    subject?: string;
  }
) {
  try {
    const queryParams: Record<string, any> = {
      limit: options?.limit || 25,
    };

    if (options?.pageToken) queryParams.pageToken = options.pageToken;
    if (options?.unread !== undefined) queryParams.unread = options.unread;
    if (options?.from) queryParams.from = options.from;
    if (options?.to) queryParams.to = options.to;
    if (options?.subject) queryParams.subject = options.subject;

    const response = await nylas.threads.list({
      identifier: grantId,
      queryParams,
    });

    return {
      success: true,
      threads: response.data,
      nextPageToken: response.nextCursor,
    };
  } catch (error) {
    console.error('Nylas get threads error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch threads',
      threads: [],
    };
  }
}

/**
 * Get a single thread with all messages
 */
export async function getThread(grantId: string, threadId: string) {
  try {
    const thread = await nylas.threads.find({
      identifier: grantId,
      threadId,
    });

    return {
      success: true,
      thread: thread.data,
    };
  } catch (error) {
    console.error('Nylas get thread error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch thread',
    };
  }
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions) {
  try {
    const response = await nylas.messages.send({
      identifier: options.grantId,
      requestBody: {
        to: options.to,
        subject: options.subject,
        body: options.body,
        cc: options.cc,
        bcc: options.bcc,
        replyToMessageId: options.replyToMessageId,
        attachments: options.attachments?.map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          content: att.content,
        })),
      },
    });

    return {
      success: true,
      message: response.data,
    };
  } catch (error) {
    console.error('Nylas send email error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Get messages with a specific contact (vendor)
 * Useful for the vendor messaging feature
 */
export async function getMessagesWithContact(
  grantId: string,
  contactEmail: string,
  options?: {
    limit?: number;
    pageToken?: string;
  }
) {
  try {
    // Get messages where contact is in from OR to
    const [fromMessages, toMessages] = await Promise.all([
      nylas.messages.list({
        identifier: grantId,
        queryParams: {
          from: [contactEmail],
          limit: options?.limit || 25,
          pageToken: options?.pageToken,
        },
      }),
      nylas.messages.list({
        identifier: grantId,
        queryParams: {
          to: [contactEmail],
          limit: options?.limit || 25,
        },
      }),
    ]);

    // Combine and dedupe messages
    const allMessages = [...fromMessages.data, ...toMessages.data];
    const uniqueMessages = allMessages.reduce((acc, msg) => {
      if (!acc.find((m: any) => m.id === msg.id)) {
        acc.push(msg);
      }
      return acc;
    }, [] as any[]);

    // Sort by date descending
    uniqueMessages.sort((a, b) => (b.date || 0) - (a.date || 0));

    return {
      success: true,
      messages: uniqueMessages.slice(0, options?.limit || 50),
    };
  } catch (error) {
    console.error('Nylas get messages with contact error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch messages',
      messages: [],
    };
  }
}

/**
 * Mark a message as read
 */
export async function markAsRead(grantId: string, messageId: string) {
  try {
    await nylas.messages.update({
      identifier: grantId,
      messageId,
      requestBody: {
        unread: false,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Nylas mark as read error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark as read',
    };
  }
}

/**
 * Create a draft email
 */
export async function createDraft(
  grantId: string,
  options: {
    to: EmailParticipant[];
    subject: string;
    body: string;
    cc?: EmailParticipant[];
    bcc?: EmailParticipant[];
    replyToMessageId?: string;
  }
) {
  try {
    const response = await nylas.drafts.create({
      identifier: grantId,
      requestBody: {
        to: options.to,
        subject: options.subject,
        body: options.body,
        cc: options.cc,
        bcc: options.bcc,
        replyToMessageId: options.replyToMessageId,
      },
    });

    return {
      success: true,
      draft: response.data,
    };
  } catch (error) {
    console.error('Nylas create draft error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create draft',
    };
  }
}
