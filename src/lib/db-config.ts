import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../db/schema';

// Load environment variables
config({ path: '.env.local' });

// Database connection pool for Turso
interface DatabasePool {
  db: ReturnType<typeof drizzle>;
  client: ReturnType<typeof createClient>;
  lastUsed: number;
  connections: number;
}

let dbPool: DatabasePool | null = null;
const MAX_IDLE_TIME = 30000; // 30 seconds

// Create a database connection with retry logic
export function createDatabase(): ReturnType<typeof drizzle> {
  const url = process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN environment variables are required');
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const client = createClient({
        url,
        authToken,
      });

      return drizzle(client, { schema });
    } catch (error) {
      attempts++;
      console.warn(`Database connection attempt ${attempts} failed:`, error);

      if (attempts >= maxAttempts) {
        throw new Error(
          `Failed to connect to Turso database after ${maxAttempts} attempts: ${error}`,
        );
      }

      // Wait before retrying
      const delay = 2 ** attempts * 100; // Exponential backoff in ms
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait - not ideal but keeps function sync
      }
    }
  }

  throw new Error('Unexpected error in database connection');
}

// Get database with connection pooling
export function getDatabase(): ReturnType<typeof drizzle> {
  try {
    // Check if we have a cached connection that's still valid
    if (dbPool && Date.now() - dbPool.lastUsed < MAX_IDLE_TIME) {
      dbPool.lastUsed = Date.now();
      dbPool.connections++;
      return dbPool.db;
    }

    // Clean up old connection if it exists
    if (dbPool) {
      cleanupDatabase();
    }

    // Create new connection
    const db = createDatabase();
    const url = process.env.TURSO_CONNECTION_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error(
        'TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN environment variables are required',
      );
    }

    const client = createClient({
      url,
      authToken,
    });

    dbPool = {
      db,
      client,
      lastUsed: Date.now(),
      connections: 1,
    };

    return db;
  } catch (error) {
    console.error('Failed to get database connection:', error);
    throw error;
  }
}

// Cleanup database connection
export function cleanupDatabase(): void {
  if (dbPool) {
    try {
      // Turso client doesn't need explicit closing
      console.log('Database connection cleaned up');
    } catch (error) {
      console.warn('Error cleaning up database connection:', error);
    } finally {
      dbPool = null;
    }
  }
}

// Graceful shutdown handler - prevent duplicate listeners during hot reload
const g = globalThis as typeof globalThis & {
  __dbListenersRegistered?: boolean;
  __dbCleanupInterval?: ReturnType<typeof setInterval>;
};

if (!g.__dbListenersRegistered) {
  process.on('SIGINT', cleanupDatabase);
  process.on('SIGTERM', cleanupDatabase);
  process.on('exit', cleanupDatabase);
  g.__dbListenersRegistered = true;
}

// Periodic cleanup of idle connections - prevent duplicate intervals during hot reload
if (!g.__dbCleanupInterval) {
  g.__dbCleanupInterval = setInterval(() => {
    if (dbPool && Date.now() - dbPool.lastUsed > MAX_IDLE_TIME) {
      console.log('Cleaning up idle database connection');
      cleanupDatabase();
    }
  }, MAX_IDLE_TIME);
}
