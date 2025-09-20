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
          account: schema.account,
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

// Export a getter function instead of the instance directly to avoid module load time evaluation
export const auth = getAuth();
export const authHandler = auth.handler;
