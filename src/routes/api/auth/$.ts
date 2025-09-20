import { createServerFileRoute } from '@tanstack/react-start/server';

export const ServerRoute = createServerFileRoute('/api/auth/$').methods({
  GET: async ({ request }) => {
    // Lazy import to avoid database initialization at module load time
    const { authHandler } = await import('~/lib/auth');
    return authHandler(request);
  },
  POST: async ({ request }) => {
    // Lazy import to avoid database initialization at module load time
    const { authHandler } = await import('~/lib/auth');
    return authHandler(request);
  },
});
