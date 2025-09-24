import { Outlet, useLocation } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { AppNavigation } from '~/components/AppNavigation';
import { GlobalHooks } from '~/components/GlobalHooks';
import { Providers } from '~/components/Providers';
import type { RouterAuthContext } from '~/router';

/**
 * Simple application shell component following TanStack Start best practices
 * Handles the main app layout with navigation and content area
 */
export function AppShell({ auth }: { auth: RouterAuthContext }) {
  const location = useLocation();

  // Hide navigation on auth routes
  const isAuthRoute = ['/login', '/register', '/forgot-password'].includes(location.pathname);

  return (
    <Providers>
      <GlobalHooks />
      <div className="min-h-screen bg-gray-50">
        {!isAuthRoute && <AppNavigation auth={auth} />}
        <main className={`max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 ${isAuthRoute ? 'pt-12' : ''}`}>
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </Providers>
  );
}
