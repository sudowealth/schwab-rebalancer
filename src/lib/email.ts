import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend() {
  // Only initialize on server side
  if (typeof window !== 'undefined') {
    return null; // We're on the client side
  }

  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendPasswordResetEmail({
  email,
  url,
  name,
}: {
  email: string;
  url: string;
  name?: string;
}) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    return { success: true };
  }

  const resendClient = getResend();
  if (!resendClient) {
    console.error('Resend not initialized - missing RESEND_API_KEY');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: 'Tax Loss Harvesting <noreply@your-domain.com>',
      to: [email],
      subject: 'Reset your password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset Your Password</h2>
          <p>Hi ${name || 'there'},</p>
          <p>We received a request to reset your password. Click the link below to create a new password:</p>
          <p>
            <a href="${url}" style="background-color: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>If you didn't request this password reset, you can safely ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send password reset email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error };
  }
}
