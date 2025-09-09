import { createMiddleware } from '@tanstack/react-start';
import { auth } from '../lib/auth';

/**
 * Authentication middleware for TanStack Start
 *
 * This middleware:
 * 1. Checks for a valid user session using Better Auth
 * 2. Throws error if no valid session exists
 * 3. Passes user context to the next middleware/handler
 * 4. Provides type-safe user context throughout the request lifecycle
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next, context, ...rest }) => {
    try {
      // Get headers from the correct location
      const headers = (rest as { headers?: Headers | Record<string, string> })?.headers;

      if (!headers) {
        console.error('No headers found in middleware parameters');
        throw new Error('Authentication required - no headers');
      }

      console.log('Auth middleware: Found headers, checking session...');
      console.log('Auth middleware: Headers keys:', Object.keys(headers));
      console.log(
        'Auth middleware: Cookie header:',
        'cookie' in headers ? (headers as Record<string, string>).cookie : undefined,
      );

      // Get session from request headers using Better Auth
      const session = await auth.api.getSession({
        headers: headers as Headers,
      });

      console.log('Auth middleware: Session result:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
      });

      // Check if we have a valid user session
      if (!session?.user?.id) {
        console.log('Auth middleware: No valid session found');
        throw new Error('Authentication required');
      }

      console.log('Auth middleware: Valid session found for user:', session.user.id);

      // Pass user context to next middleware/handler
      return next({
        context: {
          ...(context || {}),
          user: {
            id: session.user.id,
            email: session.user.email,
            role: (session.user as { role?: string }).role || 'user',
          },
        },
      });
    } catch (error) {
      // For any auth errors, throw error
      console.error('Authentication middleware error:', error);
      throw new Error('Authentication required');
    }
  },
);

/**
 * Optional: Admin-only middleware that can be chained after authMiddleware
 */
export const adminMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next, context }) => {
    // Assumes authMiddleware has already run and provided user context
    const user = (context as { user?: { role?: string } } | undefined)?.user;

    if (!user || user.role !== 'admin') {
      throw new Error('Admin access required');
    }

    return next({ context });
  },
);

/**
 * Type definitions for middleware context
 */
export interface AuthContext {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

// Re-export for convenience
export { createMiddleware } from '@tanstack/react-start';
