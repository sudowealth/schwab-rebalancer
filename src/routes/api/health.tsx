import { createServerFileRoute } from '@tanstack/react-start/server';
import { healthCheckServerFn } from '~/lib/server-functions';

export const ServerRoute = createServerFileRoute('/api/health').methods({
  GET: async () => {
    // Call the health check server function
    const result = await healthCheckServerFn();

    // Return JSON response
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
});
