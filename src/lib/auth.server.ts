import { getWebRequest } from '@tanstack/react-start/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { reactStartCookies } from 'better-auth/react-start';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  isAccountLocked,
  recordFailedLoginAttempt,
  recordSuccessfulLogin,
} from './account-lockout';
import { getDatabaseSync } from './db-config';
import { sendPasswordResetEmail } from './email';

const getAuthDatabase = () => {
  // Use Neon Postgres in any environment where credentials are present (including production)
  const hasDatabaseEnv = !!(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL);

  if (hasDatabaseEnv) {
    return getDatabaseSync();
  }

  // Fallback to local dev DB when running locally
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    return getDatabaseSync();
  }

  // Otherwise, we cannot continue in production
  throw new Error('Production database not configured: set NETLIFY_DATABASE_URL in Netlify env.');
};

const createSafeAdapter = () => {
  const db = getAuthDatabase();

  const adapter = drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.authAccount,
      verification: schema.verification,
    },
  });

  return adapter;
};

// Dynamic base URL detection that works in all environments
const getBaseURL = () => {
  // In production, use runtime detection first, then fallback to platform detection
  if (process.env.NODE_ENV === 'production') {
    // Try runtime detection first - most accurate
    try {
      const request = getWebRequest();
      if (request) {
        const url = new URL(request.url);
        const runtimeUrl = `${url.protocol}//${url.host}`;
        console.log(`🔗 Runtime-detected base URL: ${runtimeUrl}`);
        return runtimeUrl;
      }
    } catch {
      // Runtime detection not available, continue to platform detection
      console.log('🔄 Runtime detection not available, trying platform detection...');
    }

    // Fallback: try platform-specific environment variables
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
      console.log(`🔗 Platform-detected base URL: ${platformUrl}`);
      return platformUrl;
    }

    // No URL detected - production deployments need explicit URL configuration
    throw new Error(
      'Production deployment detected but no base URL found. Set URL, VERCEL_URL, SITE_URL, or other platform-specific URL environment variable.',
    );
  }

  // Development: try HTTPS first (for local HTTPS setup), fall back to HTTP
  return 'https://127.0.0.1';
};

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || 'dev-only-secret',
  database: createSafeAdapter(),
  baseURL: getBaseURL(),
  telemetry: {
    enabled: false,
  },
  trustedOrigins: (() => {
    try {
      // Parse allowed origins from environment variable
      const envOrigins = process.env.ALLOWED_ORIGINS;
      let origins: string[];

      if (envOrigins) {
        // Parse comma-separated origins from environment
        origins = envOrigins
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);
      } else {
        // Default origins based on environment
        const nodeEnv = process.env.NODE_ENV || 'development';
        if (nodeEnv === 'production') {
          // Dynamically determine production origins
          origins = [];

          // Always include the detected base URL
          const baseURL = getBaseURL();
          if (baseURL) {
            origins.push(baseURL);

            // Add common variations
            try {
              const url = new URL(baseURL);
              const domain = url.hostname;

              // Add www variant if base URL doesn't have it
              if (!domain.startsWith('www.')) {
                origins.push(`https://www.${domain}`);
              }

              // Add staging variant for common patterns
              if (domain.includes('.')) {
                const parts = domain.split('.');
                if (parts.length >= 2) {
                  const stagingDomain = `staging.${parts.slice(-2).join('.')}`;
                  origins.push(`https://${stagingDomain}`);
                }
              }
            } catch {
              // If URL parsing fails, just use the base URL
            }
          }

          // Fallback if no base URL detected
          if (origins.length === 0) {
            console.warn(
              '⚠️ No production origins detected. Set ALLOWED_ORIGINS environment variable.',
            );
            origins = ['https://localhost:3000']; // Safe fallback
          }
        } else {
          // Development origins
          origins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'https://127.0.0.1', // Local HTTPS via Caddy
          ].filter(Boolean);
        }
      }

      // Add the dynamically detected base URL if it's different
      const baseURL = getBaseURL();
      if (baseURL && !origins.includes(baseURL)) {
        origins.push(baseURL);
      }

      return origins;
    } catch {
      console.warn('⚠️ Auth: Using fallback origins due to config error');
      // Fallback to basic origins
      const origins = ['http://localhost:3000', 'http://localhost:3001', 'https://127.0.0.1'];

      // Add the dynamically detected base URL if it's different
      const baseURL = getBaseURL();
      if (baseURL && !origins.includes(baseURL)) {
        origins.push(baseURL);
      }

      return origins;
    }
  })(),
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false, // Don't allow users to set their own role during signup
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification:
      process.env.NODE_ENV === 'production' && process.env.INDIVIDUAL_USE !== 'true',
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email: string; name: string };
      url: string;
    }) => {
      await sendPasswordResetEmail({
        email: user.email,
        url,
        name: user.name,
      });
    },
  },
  rateLimit: {
    enabled: true,
    storage: 'memory', // Use memory storage for simplicity
    max: 5, // 5 attempts per window
    window: 15 * 60 * 1000, // 15 minutes
  },
  session: {
    expiresIn: 60 * 60 * 2, // 2 hours for better security
    updateAge: 60 * 30, // 30 minutes - more frequent updates
    cookieCache: {
      enabled: false, // Keep disabled for security
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: false, // Not needed for local HTTPS setup
    },
    useSecureCookies: (() => {
      // Use secure cookies in production or when base URL is HTTPS
      const baseURL = getBaseURL();
      return process.env.NODE_ENV === 'production' || baseURL?.startsWith('https');
    })(),
    cookiePrefix: 'auth',
    database: {
      generateId: () => {
        // Use crypto.randomUUID for better entropy
        return crypto.randomUUID();
      },
    },
  },
  cookies: {
    sessionToken: {
      name: 'auth.session-token',
      options: {
        httpOnly: true,
        secure: (() => {
          const baseURL = getBaseURL();
          return process.env.NODE_ENV === 'production' || baseURL?.startsWith('https');
        })(),
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 60 * 60 * 2, // 2 hours to match session expiry
      },
    },
  },
  plugins: [
    reactStartCookies(), // Essential for TanStack Start integration
  ],
});

// Enhanced authentication handler with account lockout (rate limiting handled by Better Auth)
export const authHandler = async (request: Request) => {
  // For sign-in requests, check if account is locked before processing
  if (request.method === 'POST' && request.url.includes('/sign-in')) {
    try {
      // Extract email from request body for lockout check
      const body = await request
        .clone()
        .json()
        .catch(() => ({}));
      const email = body.email;

      if (email) {
        // Check if this email belongs to a locked account
        const users = await getDatabaseSync()
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.email, email))
          .limit(1);

        if (users[0]?.id) {
          const locked = await isAccountLocked(users[0].id);
          if (locked) {
            // Record this as another failed attempt and return lockout error
            const ipAddress =
              request.headers.get('x-forwarded-for') ||
              request.headers.get('x-real-ip') ||
              'unknown';
            const userAgent = request.headers.get('user-agent') || 'unknown';

            await recordFailedLoginAttempt(email, ipAddress, userAgent);

            return new Response(
              JSON.stringify({
                error:
                  'Account is temporarily locked due to too many failed login attempts. Please try again later.',
              }),
              {
                status: 423, // Locked
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }
        }
      }
    } catch (error) {
      // If lockout check fails, continue with normal auth flow
      console.error('Account lockout check failed:', error);
    }
  }

  // Process the authentication request
  const response = await auth.handler(request);

  // Handle authentication responses to track success/failure
  if (request.method === 'POST') {
    try {
      const responseClone = response.clone();
      const responseData = await responseClone.json().catch(() => ({}));

      // Extract request details for logging
      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      if (response.status === 200 && responseData.user) {
        // Successful authentication - reset failed attempts
        await recordSuccessfulLogin(responseData.user.id);
      } else if (response.status >= 400 && request.url.includes('/sign-in')) {
        // Failed authentication - record attempt
        const body = await request
          .clone()
          .json()
          .catch(() => ({}));
        const email = body.email;

        if (email) {
          await recordFailedLoginAttempt(email, ipAddress, userAgent);
        }
      }
    } catch (error) {
      // If response processing fails, just continue
      console.error('Auth response processing failed:', error);
    }
  }

  return response;
};
