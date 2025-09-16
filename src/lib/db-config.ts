import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';

// Load environment variables
config({ path: '.env.local' });

let sql: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle> | undefined;

// Initialize database connection
function initializeDatabase() {
  if (!sql || !db) {
    const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is required. Make sure @netlify/neon is properly configured.',
      );
    }

    sql = postgres(connectionString);
    db = drizzle(sql, { schema });
  }
}

// Get database instance
export function getDatabase(): ReturnType<typeof drizzle> {
  if (!db) {
    initializeDatabase();
  }
  if (!db) {
    throw new Error('Failed to initialize database');
  }
  return db;
}

// Get raw SQL client for direct queries if needed
export function getSqlClient(): ReturnType<typeof postgres> {
  if (!sql) {
    initializeDatabase();
  }
  if (!sql) {
    throw new Error('Failed to initialize SQL client');
  }
  return sql;
}

// Cleanup database connection (mainly for testing/shutdown)
export function cleanupDatabase(): void {
  if (sql) {
    try {
      sql.end();
      console.log('Database connection cleaned up');
    } catch (error) {
      console.warn('Error cleaning up database connection:', error);
    } finally {
      sql = undefined;
      db = undefined;
    }
  }
}
