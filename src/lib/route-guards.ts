import { redirect } from '@tanstack/react-router';
import { checkAdminServerFn, checkAuthServerFn } from '~/lib/server-functions';

/**
 * Auth guard for routes that require authentication
 * Redirects to login page if not authenticated
 */
export const authGuard = async ({ location }: { location: { href: string } }) => {
  try {
    // Use lightweight server function auth check
    await checkAuthServerFn();
    return { authenticated: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Authentication required')) {
      throw redirect({
        to: '/login',
        search: { reset: '', redirect: location.href },
      });
    }
    throw error;
  }
};

/**
 * Auth guard for routes that require admin access
 * Redirects to login page if not authenticated or not admin
 */
export const adminGuard = async ({ location }: { location: { href: string } }) => {
  try {
    // Use lightweight server function admin check
    await checkAdminServerFn();
    return { authenticated: true, isAdmin: true };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Authentication required') ||
        error.message.includes('Admin access required'))
    ) {
      throw redirect({
        to: '/login',
        search: { reset: '', redirect: location.href },
      });
    }
    throw error;
  }
};
