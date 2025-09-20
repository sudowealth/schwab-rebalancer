import { createServerFileRoute } from '@tanstack/react-start/server';

export const ServerRoute = createServerFileRoute('/api/auth/$').methods({
  GET: async ({ request }) => {
    // Lazy import to avoid database initialization at module load time
    const { getAuthHandlerLazy } = await import('~/features/auth/auth');
    return getAuthHandlerLazy()(request);
  },
  POST: async ({ request }) => {
    // Lazy import to avoid database initialization at module load time
    const { getAuthHandlerLazy } = await import('~/features/auth/auth');
    return getAuthHandlerLazy()(request);
  },
});
