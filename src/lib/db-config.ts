import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
// Type definitions
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle } from 'drizzle-orm/neon-http';

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

// Database connectivity verification (no migrations at runtime)
async function verifyDatabaseConnectivity(dbInstance: DrizzleInstance): Promise<void> {
  try {
    // Simple query to verify database connection and schema exists
    await dbInstance.execute(sql`SELECT 1`);
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Database connectivity check failed:', error);
    throw new Error(
      'Database connection failed. Ensure migrations have been run during deployment. ' +
        'In development, run `pnpm run db:migrate`. In production, check your deployment build logs.',
    );
  }
}

// Initialize database connection (server-side only)
// This is now called synchronously at module load time above
async function initializeDatabase() {
  if (!globalForDb.__dbInitialized) {
    // If not initialized synchronously, try async initialization as fallback
    const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL or NETLIFY_DATABASE_URL environment variable is required. Make sure @netlify/neon is properly configured.',
      );
    }

    // Dynamic imports to avoid bundling in client
    const [schemaModule] = await Promise.all([import('~/db/schema')]);

    const schema = schemaModule;

    // Create Neon HTTP client
    const sql = neon(connectionString);
    const dbInstance = drizzle(sql, { schema }) as DrizzleInstance;
    // Add the $client property for compatibility with seed functions
    dbInstance.$client = sql;
    await verifyDatabaseConnectivity(dbInstance);
    globalForDb.__dbInstance = dbInstance;
    globalForDb.__dbInitialized = true;
  }
}

// Synchronous database initialization for startup
export async function initDatabaseSync(): Promise<void> {
  if (globalForDb.__dbInitialized) {
    return; // Already initialized
  }

  try {
    // Load environment variables
    const { config } = await import('dotenv');
    config({ path: '.env.local' });

    const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL or NETLIFY_DATABASE_URL environment variable is required');
    }

    // Import schema
    const schema = await import('~/db/schema');

    // Create Neon HTTP client
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(connectionString);

    // Create database instance
    const { drizzle } = await import('drizzle-orm/neon-http');
    const dbInstance = drizzle(sql, { schema }) as DrizzleInstance;
    // Add the $client property for compatibility with seed functions
    dbInstance.$client = sql;

    // Verify database connectivity (migrations should be run at build time)
    await verifyDatabaseConnectivity(dbInstance);
    globalForDb.__dbInstance = dbInstance;
    globalForDb.__dbInitialized = true;

    console.log('✅ Database initialized synchronously');
  } catch (error) {
    console.error('❌ Failed to initialize database synchronously:', error);
    throw error;
  }
}

// Synchronous database access
export function getDatabaseSync(): DrizzleInstance {
  const dbInstance = globalForDb.__dbInstance;

  if (!globalForDb.__dbInitialized || !dbInstance) {
    throw new Error('Database not initialized. Call initDatabaseSync() first.');
  }

  return dbInstance;
}

// Initialize the database (call this at startup)
export async function initDatabase(): Promise<void> {
  await initializeDatabase();
}

// Cleanup database connection (Neon HTTP handles this automatically)
export function cleanupDatabase(): void {
  globalForDb.__dbInstance = undefined;
  globalForDb.__dbInitialized = false;
  globalForDb.__dbMigrated = false;
}
