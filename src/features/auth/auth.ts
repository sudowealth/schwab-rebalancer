import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from '~/db/schema';
import { getDb } from '~/lib/db-config';

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
  },
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET || 'fallback-secret',
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
