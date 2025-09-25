import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { Resend } from 'resend';
import * as schema from '~/db/schema';
import { getDb } from '~/lib/db-config';
import { getEnv } from '~/lib/env';

// Import the same base URL logic used by the client
const getAuthBaseURL = () => {
  // Server-side: use the same logic as the client
  if (process.env.NODE_ENV === 'production') {
    // Try platform-specific environment variables
    const platformUrls = [
      process.env.URL, // Netlify, Render, Railway
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null, // Vercel
      process.env.HEROKU_APP_NAME ? `https://${process.env.HEROKU_APP_NAME}.herokuapp.com` : null, // Heroku
      process.env.SITE_URL, // Generic site URL
      process.env.PUBLIC_URL, // Create React App / Next.js
      process.env.BASE_URL, // Generic base URL
    ];

    const platformUrl = platformUrls.find((url) => url && typeof url === 'string');
    if (platformUrl) {
      return platformUrl;
    }

    // No URL detected - production deployments need explicit URL configuration
    throw new Error(
      'Production deployment detected but no base URL found. Set URL, VERCEL_URL, SITE_URL, or other platform-specific URL environment variable.',
    );
  }

  // Development: default to HTTPS for local development (same as client)
  return 'https://127.0.0.1';
};

// Email template for Better Auth password reset
const createPasswordResetEmailTemplate = (resetLink: string, userName?: string) => {
  const name = userName || 'there';

  return {
    subject: 'Reset your Rebalancer password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset your password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Rebalancer</h1>
            <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Portfolio Management Platform</p>
          </div>

          <div style="background: #f8fafc; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Reset your password</h2>
            <p style="margin: 0 0 15px 0; color: #4b5563;">Hi ${name},</p>
            <p style="margin: 0 0 20px 0; color: #4b5563;">
              We received a request to reset your password for your Rebalancer account.
              If you didn't make this request, you can safely ignore this email.
            </p>
            <p style="margin: 0 0 25px 0; color: #4b5563;">
              Click the button below to reset your password. This link will expire in 1 hour for security reasons.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                Reset Password
              </a>
            </div>

            <p style="margin: 25px 0 15px 0; color: #6b7280; font-size: 14px;">
              If the button doesn't work, you can copy and paste this link into your browser:
            </p>
            <p style="margin: 0; color: #2563eb; word-break: break-all; font-size: 14px;">
              ${resetLink}
            </p>
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
              This password reset link will expire in 1 hour.<br>
              If you didn't request this password reset, please ignore this email.
            </p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              © 2024 Rebalancer. All rights reserved.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
Rebalancer - Reset your password

Hi ${name},

We received a request to reset your password for your Rebalancer account.
If you didn't make this request, you can safely ignore this email.

To reset your password, please visit: ${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email.

© 2024 Rebalancer. All rights reserved.
    `,
  };
};

// Custom password reset email sender using Resend
const sendResetPasswordEmail = async (params: {
  user: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null;
  };
  url: string;
  token: string;
}) => {
  const env = getEnv();
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('RESEND_API_KEY not configured for password reset emails');
    throw new Error('Email service not configured');
  }

  const resend = new Resend(apiKey);
  const emailTemplate = createPasswordResetEmailTemplate(params.url, params.user.name);

  try {
    const result = await resend.emails.send({
      from: `Rebalancer <${env.RESEND_EMAIL_SENDER}>`,
      to: params.user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (result.error) {
      console.error('Resend password reset email error:', result.error);
      throw new Error('Failed to send password reset email');
    }

    console.log(`Password reset email sent to ${params.user.email}, Resend ID: ${result.data?.id}`);
  } catch (error) {
    console.error('Password reset email error:', error);
    throw error;
  }
};

// Initialize Better Auth with unified database instance
const authInstance = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.authAccount,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: sendResetPasswordEmail,
  },
  baseURL: getAuthBaseURL(),
  secret: process.env.BETTER_AUTH_SECRET || 'fallback-secret',
  trustedOrigins: [
    // Use consistent URLs based on environment
    ...(process.env.NODE_ENV === 'production'
      ? [getAuthBaseURL()] // Production: use the detected platform URL
      : [
          'http://localhost:3000', // Development server
          'https://127.0.0.1', // Development client (TanStack Start default)
          'https://127.0.0.1:3000', // Alternative development client
        ]),
    // Also include any explicitly set BETTER_AUTH_URL
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  user: {
    // Include role field in user data that gets stored in session
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
      },
    },
  },
});

// Create a proxy that wraps the auth instance
const createAuthProxy = () => {
  return new Proxy({} as ReturnType<typeof betterAuth>, {
    get(_, prop) {
      const value = authInstance[prop as keyof ReturnType<typeof betterAuth>];

      // If it's a function, wrap it to preserve the context
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          return (value as (...args: unknown[]) => unknown).apply(authInstance, args);
        };
      }

      return value;
    },
  });
};

// Create a lazy getter for the auth handler
let authHandlerInstance: ReturnType<typeof betterAuth>['handler'] | null = null;
const getAuthHandler = () => {
  if (!authHandlerInstance) {
    const authInstanceProxy = createAuthProxy();
    authHandlerInstance = authInstanceProxy.handler;
  }
  return authHandlerInstance;
};

// Export a function that returns the auth proxy when called
export const auth = createAuthProxy();

// Export a function that returns the auth handler when called
export const getAuthHandlerLazy = getAuthHandler;
