import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { initDatabaseSync } from './lib/db-config';
import { createRouter } from './router';

// Initialize database connection on server startup
// This ensures the database is ready before any routes are loaded
initDatabaseSync().catch((error) => {
  console.error('Failed to initialize database on server startup:', error);
  process.exit(1);
});

export default createStartHandler({
  createRouter,
})(defaultStreamHandler);
