/**
 * Global auth cache to prevent redundant auth fetches across navigation
 *
 * This cache stores auth state and prevents the root route from fetching
 * user data on every navigation, significantly improving performance.
 */

import type { RouterAuthContext } from '~/router';

interface AuthCache {
  data: RouterAuthContext | null;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// Global auth cache - persists for the session
let authCache: AuthCache | null = null;

const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedAuth(): RouterAuthContext | null {
  if (!authCache) {
    return null;
  }

  // Check if cache is expired
  if (Date.now() - authCache.timestamp > authCache.ttl) {
    authCache = null;
    return null;
  }

  return authCache.data;
}

export function setCachedAuth(auth: RouterAuthContext): void {
  authCache = {
    data: auth,
    timestamp: Date.now(),
    ttl: AUTH_CACHE_TTL,
  };
}

export function clearAuthCache(): void {
  authCache = null;
}

export function isAuthCacheValid(): boolean {
  return authCache !== null && Date.now() - authCache.timestamp <= authCache.ttl;
}
