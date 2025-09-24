import { useQuery } from '@tanstack/react-query';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';
import { getRebalancingGroupPageDataServerFn } from '~/features/rebalancing/server/groups.server';
import { queryKeys } from '~/lib/query-keys';

/**
 * React Query hook for fetching rebalancing group data
 *
 * This hook provides proper caching, background refetching, and invalidation
 * for rebalancing group data, following TanStack Start best practices.
 */
export function useRebalancingGroupQuery(groupId: string, initialData?: RebalancingGroupPageData) {
  return useQuery({
    queryKey: queryKeys.rebalancing.groups.detail(groupId),
    queryFn: () => getRebalancingGroupPageDataServerFn({ data: { groupId } }),
    initialData,
    staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Let staleTime control refetching
    refetchOnReconnect: 'always', // Refetch when connection restored
    refetchOnMount: false, // Respect staleTime on mount
    enabled: !!groupId, // Only run query if groupId is provided
  });
}

/**
 * Type for the rebalancing group query result
 */
export type UseRebalancingGroupQueryResult = ReturnType<typeof useRebalancingGroupQuery>;
