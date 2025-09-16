import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
// Type definitions
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle } from 'drizzle-orm/neon-http';

type DrizzleInstance = NeonHttpDatabase<Record<string, unknown>> & {
  $client: ReturnType<typeof neon>;
};

// Global variables for database connection
declare global {
  var __dbInstance: DrizzleInstance | undefined;
  var __dbInitialized: boolean;
}

// Initialize global variables
global.__dbInstance = undefined;
global.__dbInitialized = false;

// Initialize database connection (server-side only)
async function initializeDatabase() {
  if (!global.__dbInitialized) {
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
    const dbInstance = drizzle(sql, { schema });
    // Add the $client property for compatibility with seed functions
    (dbInstance as any).$client = sql;
    global.__dbInstance = dbInstance as DrizzleInstance;
    global.__dbInitialized = true;
  }
}

// Synchronous versions for existing code (will throw if not initialized)
export function getDatabaseSync(): DrizzleInstance {
  if (!global.__dbInitialized || !global.__dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return global.__dbInstance;
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
  global.__dbInstance = undefined;
  global.__dbInitialized = false;
}
