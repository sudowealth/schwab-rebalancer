import type { QueryClient } from '@tanstack/react-query';
import {
  type QueryKey,
  type UseQueryOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import React from 'react';

/**
 * Optimized Loader Data Hydration Hooks
 *
 * Provides reusable patterns for integrating loader data with React Query
 * to prevent waterfalls and ensure optimal data fetching strategies.
 */

/**
 * Configuration for loader query hooks
 */
interface LoaderQueryConfig<TData = unknown, TError = unknown> {
  /** Query key for the data */
  queryKey: QueryKey;
  /** Server function to fetch fresh data */
  queryFn: () => Promise<TData>;
  /** Initial data from loader */
  initialData: TData | undefined;
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Stale time for the query */
  staleTime?: number;
  /** Cache time for the query (gcTime) */
  gcTime?: number;
  /** Whether to refetch on window focus */
  refetchOnWindowFocus?: boolean | 'always';
  /** Whether to refetch on mount */
  refetchOnMount?: boolean;
  /** Interval for background refetching in milliseconds */
  refetchInterval?: number | false;
  /** Additional query options */
  options?: Partial<UseQueryOptions<TData, TError, TData, QueryKey>>;
}

/**
 * Hook for dashboard data queries with optimized loader hydration
 *
 * Prevents waterfalls by using loader data as initialData and provides
 * intelligent background refetching for critical dashboard data.
 */
export function useLoaderQuery<TData = unknown, TError = unknown>({
  queryKey,
  queryFn,
  initialData,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes default
  gcTime = 10 * 60 * 1000, // 10 minutes default
  refetchOnWindowFocus = true,
  refetchOnMount = false,
  options = {},
}: LoaderQueryConfig<TData, TError>) {
  return useQuery({
    queryKey,
    queryFn,
    initialData,
    enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    refetchOnMount,
    // Enable background refetching for better UX
    refetchInterval: false, // We'll handle this manually for critical data
    refetchIntervalInBackground: true,
    ...options,
  });
}

/**
 * Hook for critical dashboard data with aggressive background refetching
 *
 * Use for data that users expect to be fresh (positions, metrics, etc.)
 */
export function useCriticalLoaderQuery<TData = unknown, TError = unknown>(
  config: Omit<LoaderQueryConfig<TData, TError>, 'refetchOnWindowFocus' | 'refetchInterval'>,
) {
  return useLoaderQuery({
    ...config,
    // More aggressive refetching for critical data
    refetchOnWindowFocus: 'always',
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes in background
    staleTime: 1 * 60 * 1000, // Consider stale after 1 minute
  });
}

/**
 * Hook for onboarding status data with moderate refetching
 *
 * Use for data that changes infrequently but needs to be reactive
 */
export function useOnboardingLoaderQuery<TData = unknown, TError = unknown>(
  config: Omit<LoaderQueryConfig<TData, TError>, 'staleTime' | 'refetchOnWindowFocus'>,
) {
  return useLoaderQuery({
    ...config,
    staleTime: 2 * 60 * 1000, // 2 minutes for onboarding status
    refetchOnWindowFocus: true,
    refetchOnMount: false, // Use loader data initially
  });
}

/**
 * Hook for static/reference data with long cache times
 *
 * Use for data that rarely changes (sleeves, indices, etc.)
 */
export function useStaticLoaderQuery<TData = unknown, TError = unknown>(
  config: Omit<LoaderQueryConfig<TData, TError>, 'staleTime' | 'gcTime' | 'refetchOnWindowFocus'>,
) {
  return useLoaderQuery({
    ...config,
    staleTime: 30 * 60 * 1000, // 30 minutes for static data
    gcTime: 60 * 60 * 1000, // 1 hour cache time
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Background refetch manager for critical dashboard data
 *
 * Provides intelligent background refetching based on user activity and time
 */
export class BackgroundRefetchManager {
  private queryClient: QueryClient;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private visibilityHandler?: () => void;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupVisibilityHandler();
  }

  /**
   * Start background refetching for critical queries
   */
  startCriticalRefetching(queryKeys: QueryKey[], intervalMs: number = 2 * 60 * 1000) {
    const key = JSON.stringify(queryKeys);
    if (this.intervals.has(key)) {
      this.stopRefetching(queryKeys);
    }

    const interval = setInterval(() => {
      // Only refetch if document is visible to save bandwidth (browser only)
      if (typeof document !== 'undefined' && !document.hidden) {
        queryKeys.forEach((queryKey) => {
          this.queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
        });
      }
    }, intervalMs);

    this.intervals.set(key, interval);
  }

  /**
   * Stop background refetching for specific queries
   */
  stopRefetching(queryKeys: QueryKey[]) {
    const key = JSON.stringify(queryKeys);
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
  }

  /**
   * Stop all background refetching
   */
  stopAll() {
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.intervals.clear();
    this.cleanup();
  }

  private setupVisibilityHandler() {
    // Only setup visibility handler in browser environment
    if (typeof document === 'undefined') {
      return;
    }

    this.visibilityHandler = () => {
      if (!document.hidden) {
        // When user returns to tab, do an immediate refetch of critical data
        this.queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              key[0] === 'dashboard' &&
              ['positions', 'metrics', 'groups'].includes(key[1] as string)
            );
          },
          refetchType: 'active',
        });
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private cleanup() {
    // Only cleanup if we have a handler and document exists
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }
  }
}

/**
 * Hook to manage background refetching for dashboard data
 */
export function useBackgroundRefetchManager() {
  const queryClient = useQueryClient();
  const managerRef = React.useRef<BackgroundRefetchManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new BackgroundRefetchManager(queryClient);
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => managerRef.current?.stopAll();
  }, []);

  return managerRef.current;
}
