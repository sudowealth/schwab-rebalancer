import { createFileRoute } from '@tanstack/react-router';
import { getWebRequest } from '@tanstack/react-start/server';
import { auth } from '~/lib/auth.server';

export const Route = createFileRoute('/api/auth/$action')({
  async loader({ params }) {
    try {
      const request = getWebRequest();
      if (!request) {
        throw new Response('No request context', { status: 400 });
      }

      // Handle the auth request with Better Auth
      const response = await auth.handler(request);

      // Return the response from Better Auth
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    } catch (error) {
      console.error('Auth API error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
});
