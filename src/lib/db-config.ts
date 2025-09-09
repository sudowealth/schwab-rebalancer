import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

// Get the D1 local database path from Wrangler
export function getD1LocalPath(): string {
  // Try to find the actual database file in the .wrangler directory
  const wranglerDir = './.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
  if (fs.existsSync(wranglerDir)) {
    const files = fs.readdirSync(wranglerDir);
    const sqliteFile = files.find((file) => file.endsWith('.sqlite'));
    if (sqliteFile) {
      return path.join(wranglerDir, sqliteFile);
    }
  }
  throw new Error('Failed to find D1 local database path');
}

// Database connection pool
interface DatabasePool {
  db: ReturnType<typeof drizzle>;
  sqlite: Database.Database;
  lastUsed: number;
  connections: number;
}

let dbPool: DatabasePool | null = null;
const MAX_IDLE_TIME = 30000; // 30 seconds
const CONNECTION_TIMEOUT = 10000; // 10 seconds

// Create a database connection with retry logic
export function createDatabase(): ReturnType<typeof drizzle> {
  const dbPath = getD1LocalPath();

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      // Ensure directory exists
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const sqlite = new Database(dbPath, {
        timeout: CONNECTION_TIMEOUT,
        // Remove verbose logging to prevent SQL queries in logs
      });

      // Configure SQLite for better performance
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('synchronous = NORMAL');
      sqlite.pragma('cache_size = 1000');
      sqlite.pragma('temp_store = memory');

      return drizzle(sqlite, { schema });
    } catch (error) {
      attempts++;
      console.warn(`Database connection attempt ${attempts} failed:`, error);

      if (attempts >= maxAttempts) {
        throw new Error(`Failed to connect to database after ${maxAttempts} attempts: ${error}`);
      }

      // Wait before retrying (sync version for simplicity)
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
    const dbPath = getD1LocalPath();
    const sqlite = new Database(dbPath);

    dbPool = {
      db,
      sqlite,
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
      dbPool.sqlite.close();
      console.log('Database connection closed');
    } catch (error) {
      console.warn('Error closing database connection:', error);
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
