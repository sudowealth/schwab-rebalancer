import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary';
import { NotFound } from './components/NotFound';
import { routeTree } from './routeTree.gen';

export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 30_000, // 30 seconds
    defaultPreloadGcTime: 5 * 60_000, // 5 minutes
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
