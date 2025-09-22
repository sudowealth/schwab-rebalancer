import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getDashboardDataServerFn } from '~/lib/server-functions';

export const Route = createFileRoute('/schwab/schwab')({
  component: SchwabLayout,
  beforeLoad: async ({ location }) => {
    // Conditional protection: only protect non-OAuth routes
    if (!location.pathname.includes('/callback')) {
      try {
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
    }
    // Allow anonymous access for OAuth callback
    return { oauthFlow: true };
  },
});

function SchwabLayout() {
  return <Outlet />;
}
