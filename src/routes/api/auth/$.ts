import { createServerFileRoute } from '@tanstack/react-start/server';
import { authHandler } from '../../../lib/auth.server';

export const ServerRoute = createServerFileRoute('/api/auth/$').methods({
  GET: ({ request }) => {
    return authHandler(request);
  },
  POST: ({ request }) => {
    return authHandler(request);
  },
});
