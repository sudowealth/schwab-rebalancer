import { useQuery } from '@tanstack/react-query';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';
import { queryKeys } from '~/lib/query-keys';

/**
 * React Query hook for rebalancing group data
 *
 * Since we now use direct database calls in route loaders, this hook primarily
 * serves as a cache container for route-loaded data and provides invalidation capabilities.
 * It doesn't make network requests - data comes from the route loader.
 */
export function useRebalancingGroupQuery(groupId: string, initialData?: RebalancingGroupPageData) {
  return useQuery({
    queryKey: queryKeys.rebalancing.groups.detail(groupId),
    queryFn: () => Promise.resolve(initialData || null), // No-op since data comes from route loader
    initialData,
    staleTime: Infinity, // Data never becomes stale since it comes from route loader
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // No refetching needed
    refetchOnReconnect: false, // No network calls to reconnect to
    refetchOnMount: false, // Respect initialData on mount
    enabled: !!groupId, // Only run query if groupId is provided
  });
}

/**
 * Type for the rebalancing group query result
 */
export type UseRebalancingGroupQueryResult = ReturnType<typeof useRebalancingGroupQuery>;
