import { useQuery } from '@tanstack/react-query';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';
import {
  getGroupAccountHoldingsServerFn,
  getRebalancingGroupAllDataServerFn,
  getRebalancingGroupAnalyticsServerFn,
  getRebalancingGroupMarketDataServerFn,
  getRebalancingGroupSleeveDataServerFn,
  getRebalancingGroupTradesDataServerFn,
} from '~/features/rebalancing/server/groups.server';
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

/**
 * React Query hook for group account holdings
 */
export function useGroupAccountHoldingsQuery(accountIds: string[]) {
  return useQuery({
    queryKey: queryKeys.rebalancing.groups.holdings(accountIds),
    queryFn: async () => {
      const result = await getGroupAccountHoldingsServerFn({
        data: { accountIds },
      });
      return result;
    },
    staleTime: 2 * 60 * 1000, // Data becomes stale after 2 minutes (more volatile)
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: accountIds.length > 0,
  });
}

/**
 * React Query hook for group analytics data
 * Now uses optimized server function that leverages shared base data
 */
export function useRebalancingGroupAnalyticsQuery(groupId: string) {
  return useQuery({
    queryKey: queryKeys.rebalancing.groups.analytics(groupId),
    queryFn: async () => {
      const result = await getRebalancingGroupAnalyticsServerFn({
        data: { groupId },
      });
      return result;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!groupId,
  });
}

/**
 * React Query hook for group sleeve data
 * Now uses optimized server function that leverages shared base data
 */
export function useRebalancingGroupSleeveDataQuery(groupId: string) {
  return useQuery({
    queryKey: queryKeys.rebalancing.groups.sleeveData(groupId),
    queryFn: async () => {
      const result = await getRebalancingGroupSleeveDataServerFn({
        data: { groupId },
      });
      return result;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!groupId,
  });
}

/**
 * React Query hook for market data (S&P 500)
 */
export function useRebalancingGroupMarketDataQuery(groupId: string) {
  return useQuery({
    queryKey: queryKeys.rebalancing.groups.marketData(groupId),
    queryFn: async () => {
      const result = await getRebalancingGroupMarketDataServerFn({
        data: { groupId },
      });
      return result;
    },
    staleTime: 10 * 60 * 1000, // Market data changes less frequently
    gcTime: 60 * 60 * 1000, // Keep longer
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!groupId,
  });
}

/**
 * React Query hook for trades and positions data
 */
export function useRebalancingGroupTradesDataQuery(groupId: string) {
  return useQuery({
    queryKey: queryKeys.rebalancing.groups.tradesData(groupId),
    queryFn: async () => {
      const result = await getRebalancingGroupTradesDataServerFn({
        data: { groupId },
      });
      return result;
    },
    staleTime: 1 * 60 * 1000, // Trades data is more volatile
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!groupId,
  });
}

/**
 * Type for the rebalancing group query result
 */
export type UseRebalancingGroupQueryResult = ReturnType<typeof useRebalancingGroupQuery>;
