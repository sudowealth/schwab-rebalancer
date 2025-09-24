import { useLocation } from '@tanstack/react-router';
import { useSchwabConnection } from '~/features/schwab/hooks/use-schwab-connection';

/**
 * Global hooks that need to run at the application level
 * These are separated from the root route to maintain clean separation of concerns
 */
export function GlobalHooks() {
  const location = useLocation();

  // Only enable Schwab connection sync triggering on dashboard and related routes
  const shouldRunSchwabConnection =
    location.pathname === '/' ||
    location.pathname.startsWith('/rebalancing-groups/') ||
    location.pathname.startsWith('/settings/') ||
    location.pathname.startsWith('/data-feeds');

  // Always call the hook, but conditionally enable sync triggering
  useSchwabConnection(undefined, undefined, shouldRunSchwabConnection);

  // This component doesn't render anything visible
  return null;
}
