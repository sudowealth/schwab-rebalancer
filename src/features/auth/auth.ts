import { neon } from '@neondatabase/serverless';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '~/db/schema';

// Create database connection synchronously
const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL or NETLIFY_DATABASE_URL environment variable is required');
}

// Create the database instance synchronously
// The actual connection happens lazily when queries are executed
const sql = neon(connectionString);
const dbInstance = drizzle(sql, { schema });

// Initialize Better Auth with database instance
const authInstance = betterAuth({
  database: drizzleAdapter(dbInstance, {
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
