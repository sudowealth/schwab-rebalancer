import { getWebRequest } from '@tanstack/react-start/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { reactStartCookies } from 'better-auth/react-start';
import * as schema from '../db/schema';
import { getDatabase } from './db-config';
import { sendPasswordResetEmail, sendVerificationEmail } from './email';
import { getSecurityConfig } from './security-config';

const getAuthDatabase = () => {
  // Use Neon Postgres in any environment where credentials are present (including production)
  const hasDatabaseEnv = !!(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL);

  if (hasDatabaseEnv) {
    return getDatabase();
  }

  // Fallback to local dev DB when running locally
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    return getDatabase();
  }

  // Otherwise, we cannot continue in production
  throw new Error('Production database not configured: set DATABASE_URL in Netlify env.');
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
      const securityConfig = getSecurityConfig();
      // Security config loaded successfully
      return securityConfig.allowedOrigins;
    } catch {
      console.warn('⚠️ Auth: Using fallback origins due to config error');
      // Fallback to dynamic origins based on environment
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
    requireEmailVerification: process.env.NODE_ENV === 'production',
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
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email: string; name: string };
      url: string;
    }) => {
      await sendVerificationEmail({
        email: user.email,
        url,
        name: user.name,
      });
    },
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
    generateId: () => {
      // Use crypto.randomUUID for better entropy
      return crypto.randomUUID();
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
