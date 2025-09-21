import { neon } from '@neondatabase/serverless';
// Type definitions
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '~/db/schema';

// Database configuration for TanStack Start + Netlify + Neon

/**
 * Create database client - unified instance for all database operations
 * Drizzle handles connection pooling and lazy connections automatically
 */
function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or NETLIFY_DATABASE_URL environment variable is required');
  }

  // Create database instance - Drizzle handles connection pooling and lazy connections
  const neonClient = neon(connectionString);
  return drizzle(neonClient, { schema });
}

/**
 * Unified database instance for all application database operations
 * Used by both auth and application code
 * Lazy-loaded to ensure environment variables are available
 */
let dbInstance: ReturnType<typeof createDatabaseClient> | null = null;

export const dbProxy = new Proxy({} as ReturnType<typeof createDatabaseClient>, {
  get(_target, prop) {
    if (!dbInstance) {
      dbInstance = createDatabaseClient();
    }
    const value = dbInstance[prop as keyof typeof dbInstance];
    return typeof value === 'function' ? value.bind(dbInstance) : value;
  },
});
