import { useQuery } from '@tanstack/react-query';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';
import {
  getGroupAccountHoldingsServerFn,
  getRebalancingGroupAnalyticsServerFn,
  getRebalancingGroupMarketDataServerFn,
  getRebalancingGroupPageDataServerFn,
  getRebalancingGroupSleeveDataServerFn,
  getRebalancingGroupTradesDataServerFn,
} from '~/features/rebalancing/server/groups.server';
import { queryKeys } from '~/lib/query-keys';

/**
 * React Query hook for rebalancing group data (full data structure)
 *
 * Provides caching and invalidation capabilities for rebalancing group data.
 * Uses server function for actual data fetching when needed.
 */
export function useRebalancingGroupQuery(groupId: string, initialData?: RebalancingGroupPageData) {
  return useQuery({
    queryKey: queryKeys.rebalancing.groups.detail(groupId),
    queryFn: async () => {
      const result = await getRebalancingGroupPageDataServerFn({
        data: { groupId },
      });
      return result;
    },
    initialData,
    staleTime: 5 * 60 * 1000, // Data becomes stale after 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
    enabled: !!groupId, // Only run query if groupId is provided
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
