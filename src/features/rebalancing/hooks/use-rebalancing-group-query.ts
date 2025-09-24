import { useQuery } from '@tanstack/react-query';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';
import { getRebalancingGroupAllDataServerFn } from '~/features/rebalancing/server/groups.server';
import { transformAccountHoldingsForClient } from '~/features/rebalancing/utils/rebalancing-utils';
import { queryKeys } from '~/lib/query-keys';

/**
 * React Query hook for rebalancing group data (full data structure)
 *
 * Provides caching and invalidation capabilities for rebalancing group data.
 * When initialData is provided (from route loader), acts as a simple data provider.
 * When no initialData, fetches data using the optimized combined server function.
 */
export function useRebalancingGroupQuery(groupId: string, initialData?: RebalancingGroupPageData) {
  return useQuery({
    queryKey: queryKeys.rebalancing.groups.detail(groupId),
    queryFn: async () => {
      // Use the optimized ALL data server function (eliminates multiple round trips)
      const allData = await getRebalancingGroupAllDataServerFn({ data: { groupId } });
      const {
        group,
        accountHoldings,
        sp500Data,
        updatedGroupMembers,
        allocationData,
        holdingsData,
        sleeveMembers,
        sleeveTableData,
        sleeveAllocationData,
        transactions,
        positions,
        proposedTrades,
        groupOrders,
        transformedAccountHoldings, // Now provided by server with caching
      } = allData;

      return {
        group: {
          id: group.id,
          name: group.name,
          isActive: group.isActive,
          members: updatedGroupMembers,
          assignedModel: group.assignedModel,
          createdAt: group.createdAt as Date,
          updatedAt: group.updatedAt as Date,
        },
        accountHoldings: transformAccountHoldingsForClient(accountHoldings),
        sleeveMembers,
        sp500Data,
        transactions,
        positions,
        proposedTrades,
        allocationData,
        holdingsData,
        sleeveTableData,
        sleeveAllocationData,
        groupOrders,
        transformedAccountHoldings, // Server-provided with caching
      } as RebalancingGroupPageData;
    },
    initialData,
    enabled: !initialData, // Only fetch if no initial data provided
    staleTime: 5 * 60 * 1000, // Data becomes stale after 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });
}
