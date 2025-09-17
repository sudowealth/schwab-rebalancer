import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/test')({
  async loader() {
    try {
      return new Response(
        JSON.stringify({
          message: 'API test successful',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Test route error:', error);
      throw new Response('Test error', { status: 500 });
    }
  },
});
