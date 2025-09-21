import { redirect } from '@tanstack/react-router';
import { verifyAdminAccessServerFn } from '~/features/auth/auth.server';
import { getDashboardDataServerFn } from '~/lib/server-functions';

/**
 * Auth guard for routes that require authentication
 * Redirects to login page if not authenticated
 */
export const authGuard = async ({ location }: { location: { href: string } }) => {
  try {
    // Use existing server function that does auth checking internally
    await getDashboardDataServerFn();
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
    // Use existing server function that does admin auth checking
    await verifyAdminAccessServerFn();
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
