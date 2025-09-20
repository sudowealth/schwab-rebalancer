import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from '~/db/schema';
import { getDatabaseSync } from '~/lib/db-config';

// Lazy initialization to avoid database access at module load time
let authInstance: ReturnType<typeof betterAuth> | null = null;

function getAuth() {
  if (!authInstance) {
    authInstance = betterAuth({
      database: drizzleAdapter(getDatabaseSync(), {
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
  }
  return authInstance;
}

// Create a proxy that defers database access until the handler is actually called
const createAuthProxy = () => {
  let cachedAuth: ReturnType<typeof betterAuth> | null = null;

  return new Proxy({} as ReturnType<typeof betterAuth>, {
    get(_, prop) {
      // Defer database access until any property is accessed
      if (!cachedAuth) {
        cachedAuth = getAuth();
      }
      return cachedAuth[prop as keyof ReturnType<typeof betterAuth>];
    },
  });
};

// Create a lazy getter for the auth handler to defer database access
let authHandlerInstance: ReturnType<typeof betterAuth>['handler'] | null = null;
const getAuthHandler = () => {
  if (!authHandlerInstance) {
    const authInstance = createAuthProxy();
    authHandlerInstance = authInstance.handler;
  }
  return authHandlerInstance;
};

// Export getters that defer database access until actually called
export const auth = createAuthProxy();

// Export a function that returns the auth handler when called
export const getAuthHandlerLazy = getAuthHandler;
