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

/**
 * Get database instance with lazy initialization
 * Replaces proxy pattern for better performance
 */
export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabaseClient();
  }
  return dbInstance;
}
