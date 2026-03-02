import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set');
  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Send a transactional email via Resend.
 * Returns { id } on success or { error } on failure (does not throw).
 */
export async function sendEmail(options: {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  tags?: { name: string; value: string }[];
}): Promise<{ id?: string; error?: string }> {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: options.from || 'FlipOps <notifications@flipops.io>',
    to: options.to,
    subject: options.subject,
    html: options.html,
    tags: options.tags,
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}

/**
 * Add a contact to a Resend Audience for future email sequences.
 * Returns { id } on success or { error } on failure (does not throw).
 */
export async function addToAudience(options: {
  email: string;
  firstName?: string;
  lastName?: string;
  audienceId?: string;
}): Promise<{ id?: string; error?: string }> {
  const resend = getResendClient();
  const audienceId = options.audienceId || process.env.RESEND_AUDIENCE_ID;
  if (!audienceId) return { error: 'No audience ID configured' };

  const { data, error } = await resend.contacts.create({
    audienceId,
    email: options.email,
    firstName: options.firstName,
    lastName: options.lastName,
    unsubscribed: false,
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}
