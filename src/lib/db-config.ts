import { neon } from '@neondatabase/serverless';
// Type definitions
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle } from 'drizzle-orm/neon-http';

type DrizzleInstance = NeonHttpDatabase<Record<string, unknown>> & {
  $client: ReturnType<typeof neon>;
};

// Global variables for database connection
declare global {
  // eslint-disable-next-line no-var
  var __dbInstance: DrizzleInstance | undefined;
  // eslint-disable-next-line no-var
  var __dbInitialized: boolean | undefined;
}

const globalForDb = globalThis as typeof globalThis & {
  __dbInstance?: DrizzleInstance;
  __dbInitialized?: boolean;
};

// Initialize global variables only on server side without clobbering existing state
if (typeof window === 'undefined') {
  if (typeof globalForDb.__dbInstance === 'undefined') {
    globalForDb.__dbInstance = undefined;
  }

  if (typeof globalForDb.__dbInitialized === 'undefined') {
    globalForDb.__dbInitialized = false;
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
        'DATABASE_URL environment variable is required. Make sure @netlify/neon is properly configured.',
      );
    }

    // Dynamic imports to avoid bundling in client
    const [schemaModule] = await Promise.all([import('../db/schema')]);

    const schema = schemaModule;

    // Create Neon HTTP client
    const sql = neon(connectionString);
    const dbInstance = drizzle(sql, { schema }) as DrizzleInstance;
    // Add the $client property for compatibility with seed functions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dbInstance as any).$client = sql;
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
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Import schema
    const schema = await import('../db/schema');

    // Create Neon HTTP client
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(connectionString);

    // Create database instance
    const { drizzle } = await import('drizzle-orm/neon-http');
    const dbInstance = drizzle(sql, { schema }) as DrizzleInstance;
    // Add the $client property for compatibility with seed functions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dbInstance as any).$client = sql;

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

// Neon HTTP client doesn't expose raw SQL client in the same way
export function getSqlClientSync(): null {
  // Neon HTTP client doesn't provide direct SQL access for raw queries
  return null;
}

// Initialize the database (call this at startup)
export async function initDatabase(): Promise<void> {
  await initializeDatabase();
}

// Cleanup database connection (Neon HTTP handles this automatically)
export function cleanupDatabase(): void {
  globalForDb.__dbInstance = undefined;
  globalForDb.__dbInitialized = false;
}
