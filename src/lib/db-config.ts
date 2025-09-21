import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
// Type definitions
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '~/db/schema';

type DrizzleInstance = NeonHttpDatabase<Record<string, unknown>> & {
  $client: ReturnType<typeof neon<false, false>>;
};

// Global variables for database connection
declare global {
  // eslint-disable-next-line no-var
  var __dbInstance: DrizzleInstance | undefined;
  // eslint-disable-next-line no-var
  var __dbInitialized: boolean | undefined;
  // eslint-disable-next-line no-var
  var __dbMigrated: boolean | undefined;
}

const globalForDb = globalThis as typeof globalThis & {
  __dbInstance?: DrizzleInstance;
  __dbInitialized?: boolean;
  __dbMigrated?: boolean;
};

// Initialize global variables only on server side without clobbering existing state
if (typeof window === 'undefined') {
  if (typeof globalForDb.__dbInstance === 'undefined') {
    globalForDb.__dbInstance = undefined;
  }

  if (typeof globalForDb.__dbInitialized === 'undefined') {
    globalForDb.__dbInitialized = false;
  }

  if (typeof globalForDb.__dbMigrated === 'undefined') {
    globalForDb.__dbMigrated = false;
  }
}

/**
 * Database connectivity verification - TanStack Start best practice
 * This should only be called when we actually need to use the database
 */
async function verifyDatabaseConnectivity(dbInstance: DrizzleInstance): Promise<void> {
  try {
    // Simple query to verify database connection and schema exists
    await dbInstance.execute(sql`SELECT 1`);
  } catch (error) {
    console.error('❌ Database connectivity check failed:', error);
    throw new Error(
      'Database connection failed. Ensure migrations have been run during deployment. ' +
        'In development, run `pnpm run db:migrate`. In production, check your deployment build logs.',
    );
  }
}

/**
 * Create a database instance - lazy initialization following TanStack Start patterns
 * This creates connections only when needed, not at startup
 */
export async function createDatabaseInstance(): Promise<DrizzleInstance> {
  const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL or NETLIFY_DATABASE_URL environment variable is required. Make sure @netlify/neon is properly configured.',
    );
  }

  // Dynamic imports to avoid bundling in client
  const schema = await import('~/db/schema');

  // Create Neon HTTP client
  const sql = neon(connectionString);
  const dbInstance = drizzle(sql, { schema }) as DrizzleInstance;

  // Add the $client property for compatibility with seed functions
  dbInstance.$client = sql;

  // Verify connectivity only when we actually need the database
  await verifyDatabaseConnectivity(dbInstance);

  return dbInstance;
}

// Global database instance with lazy initialization
let _dbInstance: DrizzleInstance | null = null;
let _dbInitializing: Promise<DrizzleInstance> | null = null;

/**
 * Get the database instance with lazy initialization
 */
async function getDbInstance(): Promise<DrizzleInstance> {
  // If already initialized, return the instance
  if (_dbInstance) {
    return _dbInstance;
  }

  // If initialization is in progress, wait for it
  if (_dbInitializing) {
    return _dbInitializing;
  }

  // Start initialization
  _dbInitializing = createDatabaseInstance();

  try {
    _dbInstance = await _dbInitializing;
    return _dbInstance;
  } finally {
    _dbInitializing = null;
  }
}

/**
 * Database instance with lazy initialization
 * Usage: await db().select(...)
 */
export async function db(): Promise<DrizzleInstance> {
  return getDbInstance();
}

// Database client factory function following TanStack Start best practices
// Create database instances within server functions when needed
export function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or NETLIFY_DATABASE_URL environment variable is required');
  }

  // Create database instance - Drizzle handles connection pooling and lazy connections
  const neonClient = neon(connectionString);
  return drizzle(neonClient, { schema });
}

// Legacy export for backward compatibility - will be removed
// TODO: Migrate all usage to createDatabaseClient() within server functions
export const dbProxy = createDatabaseClient();

/**
 * @deprecated This function is deprecated. Use await db.select(...) directly instead.
 * This function will be removed in a future version.
 */
export async function dbFunction(): Promise<DrizzleInstance> {
  return getDbInstance();
}

/**
 * @deprecated This function is deprecated. Use await createDatabaseInstance() instead.
 * This function will be removed in a future version.
 */
export function getDatabaseSync(): DrizzleInstance {
  throw new Error(
    'createDatabaseInstance() is deprecated and has been removed. Use await createDatabaseInstance() instead. ' +
      'Database connections should be created lazily within server functions. ' +
      'See db-config.ts for migration guide.',
  );
}

/**
 * Legacy function for backward compatibility
 * This function is now a no-op since we use lazy initialization
 * @deprecated Use await createDatabaseInstance() instead for new code
 */
export async function initDatabaseSync(): Promise<void> {
  // This function is now a no-op since we use lazy initialization
  // but we keep it for backward compatibility
  return Promise.resolve();
}

/**
 * Legacy function for backward compatibility
 * @deprecated Database connections are now managed automatically by Neon HTTP
 */
export async function initDatabase(): Promise<void> {
  return Promise.resolve();
}

/**
 * Legacy function for backward compatibility
 * @deprecated Neon HTTP handles connection cleanup automatically
 */
export function cleanupDatabase(): void {
  // No-op: Neon HTTP handles connection cleanup automatically
}
