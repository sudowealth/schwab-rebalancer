// import { redirect } from "@tanstack/react-router";
// import { auth } from "./auth";

/**
 * Simple client-side authentication check for route components
 *
 * This approach puts authentication responsibility on the component level
 * and allows server functions to remain simple for route loader use cases.
 */
export function useAuthGuard() {
  // This hook can be used in components to ensure authentication
  // The actual redirect logic is handled in the component
}

/**
 * For server functions that are called directly (not from route loaders),
 * we can still use the withAuth wrapper pattern.
 *
 * Route loaders should rely on client-side auth checks since TanStack Start
 * server functions called from loaders don't have the same request context.
 */

export const AUTH_STRATEGY = {
  ROUTE_LOADERS: 'client-side-component-check',
  DIRECT_SERVER_FUNCTIONS: 'server-side-with-auth-wrapper',
} as const;
