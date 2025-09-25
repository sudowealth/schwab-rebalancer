import { createServerFn } from '@tanstack/react-start';
import { Resend } from 'resend';
import { z } from 'zod';
import { getEnv } from '~/lib/env';
import { handleServerError } from '~/lib/error-utils';

// Initialize Resend client
const getResendClient = () => {
  const env = getEnv();
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is required for email functionality');
  }

  return new Resend(apiKey);
};

// Zod schema for testing email functionality
const testEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Server function to test email functionality (admin only)
export const testEmailServerFn = createServerFn({ method: 'POST' })
  .inputValidator(testEmailSchema)
  .handler(async ({ data }) => {
    const { email } = data;

    try {
      // Import requireAdmin here to avoid circular imports
      const { requireAdmin } = await import('./auth-utils');
      await requireAdmin();

      const resend = getResendClient();

      // Send test email
      const result = await resend.emails.send({
        from: 'Rebalancer <noreply@schwab-rebalancer.com>',
        to: email,
        subject: 'Test Email - Rebalancer',
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2>Test Email from Rebalancer</h2>
              <p>This is a test email to verify that the email system is working correctly.</p>
              <p>If you received this email, the Resend integration is functioning properly.</p>
              <p>Sent at: ${new Date().toISOString()}</p>
            </body>
          </html>
        `,
        text: `
Test Email from Rebalancer

This is a test email to verify that the email system is working correctly.

If you received this email, the Resend integration is functioning properly.

Sent at: ${new Date().toISOString()}
        `,
      });

      if (result.error) {
        console.error('Test email error:', result.error);
        throw new Error('Failed to send test email');
      }

      console.log(`Test email sent successfully to ${email}, Resend ID: ${result.data?.id}`);

      return {
        success: true,
        message: 'Test email sent successfully',
        emailId: result.data?.id,
      };
    } catch (error) {
      console.error('Test email error:', error);
      throw handleServerError(error, 'Test email');
    }
  });
