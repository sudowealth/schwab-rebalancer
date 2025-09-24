import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Lazy import to avoid database initialization at module load time
        const { getAuthHandlerLazy } = await import('~/features/auth/auth');
        const handler = getAuthHandlerLazy();
        return handler(request);
      },
      POST: async ({ request }) => {
        // Lazy import to avoid database initialization at module load time
        const { getAuthHandlerLazy } = await import('~/features/auth/auth');
        const handler = getAuthHandlerLazy();
        return handler(request);
      },
    },
  },
});
