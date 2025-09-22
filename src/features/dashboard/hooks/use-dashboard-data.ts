import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import type {
  PortfolioMetrics,
  Position,
  RebalancingGroup,
  Sleeve,
  SP500Stock,
  Trade,
  Transaction,
} from '~/features/auth/schemas';
import { useSchwabConnection } from '~/features/schwab/hooks/use-schwab-connection';
import { queryInvalidators, queryKeys } from '~/lib/query-keys';
import {
  checkModelsExistServerFn,
  checkSchwabCredentialsServerFn,
  checkSecuritiesExistServerFn,
  getPortfolioMetricsServerFn,
  getPositionsServerFn,
  getSleevesServerFn,
  getTransactionsServerFn,
} from '~/lib/server-functions';

interface LoaderData {
  // Full dashboard data from loader
  positions: Position[];
  metrics: PortfolioMetrics;
  transactions: Transaction[];
  sp500Data: SP500Stock[];
  proposedTrades: Trade[];
  sleeves: Sleeve[];
  indices: Array<{ id: string; name: string }>;
  indexMembers: Array<{ indexId: string; securityId: string }>;
  schwabCredentialsStatus: { hasCredentials: boolean };
  schwabOAuthStatus?: { hasCredentials: boolean };
  accountsCount: number;
  securitiesStatus: { hasSecurities: boolean; securitiesCount: number };
  modelsStatus: { hasModels: boolean; modelsCount: number };
  rebalancingGroupsStatus: { hasGroups: boolean; groupsCount: number };
  rebalancingGroups: RebalancingGroup[];
  user?: { id: string; name?: string; email: string } | null;
}

export function useDashboardData(loaderData: LoaderData) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Detect Schwab OAuth callback and refresh data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthCallback = urlParams.has('code') && urlParams.has('state');
    const hasSchwabConnected = urlParams.has('schwabConnected');

    if (hasOAuthCallback) {
      console.log('🔄 [Dashboard] Detected Schwab OAuth callback, refreshing dashboard data...');
      console.log('🔄 [Dashboard] URL params:', {
        code: `${urlParams.get('code')?.substring(0, 10)}...`,
        state: urlParams.get('state'),
      });

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Use centralized invalidation for Schwab sync
      console.log('🔄 [Dashboard] Invalidating queries after Schwab sync...');
      queryInvalidators.composites.afterSchwabSync(queryClient);
      // Also invalidate the route loader
      router.invalidate();
      console.log('✅ [Dashboard] Dashboard data refresh initiated after Schwab OAuth callback');
    } else if (hasSchwabConnected) {
      console.log(
        '🔄 [Dashboard] Detected Schwab connection redirect, refreshing dashboard data...',
      );

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Use centralized invalidation for Schwab sync
      console.log('🔄 [Dashboard] Invalidating queries after Schwab connection...');
      queryInvalidators.composites.afterSchwabSync(queryClient);
      // Also invalidate the route loader
      router.invalidate();
      console.log('✅ [Dashboard] Dashboard data refresh initiated after Schwab connection');
    }
  }, [queryClient, router]);

  // Calculate derived state
  const hasAccounts =
    loaderData && 'accountsCount' in loaderData ? loaderData.accountsCount > 0 : false;

  // Use Schwab connection hook for OAuth status (same as OnboardingTracker)
  const { isConnected: schwabOAuthComplete } = useSchwabConnection(
    loaderData.schwabCredentialsStatus,
    loaderData.schwabOAuthStatus,
    false, // Disable sync triggering - handled globally in root component
  );

  // Use onboarding queries with optimized settings
  const { data: reactiveSecuritiesStatus } = useQuery({
    queryKey: queryKeys.onboarding.securities(),
    queryFn: checkSecuritiesExistServerFn,
    initialData: loaderData.securitiesStatus,
    staleTime: 2 * 60 * 1000, // 2 minutes for onboarding status
    refetchOnWindowFocus: true,
    refetchOnMount: false, // Use loader data initially
  });

  const { data: reactiveModelsStatus } = useQuery({
    queryKey: queryKeys.onboarding.models(),
    queryFn: checkModelsExistServerFn,
    initialData: loaderData.modelsStatus,
    staleTime: 2 * 60 * 1000, // 2 minutes for onboarding status
    refetchOnWindowFocus: true,
    refetchOnMount: false, // Use loader data initially
  });

  const { data: reactiveSchwabCredentialsStatus } = useQuery({
    queryKey: queryKeys.onboarding.schwab(),
    queryFn: checkSchwabCredentialsServerFn,
    initialData: loaderData.schwabCredentialsStatus,
    staleTime: 2 * 60 * 1000, // 2 minutes for onboarding status
    refetchOnWindowFocus: true,
    refetchOnMount: false, // Use loader data initially
  });

  // Use reactive queries for rebalancing groups status
  const { data: rawRebalancingGroups } = useQuery({
    queryKey: queryKeys.dashboard.groups(),
    queryFn: async () => loaderData.rebalancingGroups, // Use loader data as query function
    initialData: loaderData.rebalancingGroups,
    refetchOnMount: true, // Ensure fresh data after group creation
    staleTime: 5 * 60 * 1000, // 5 minutes default
    gcTime: 10 * 60 * 1000, // 10 minutes default
    refetchOnWindowFocus: true,
  });

  // Transform the data for onboarding status
  const reactiveRebalancingGroupsStatus = rawRebalancingGroups
    ? {
        hasGroups: rawRebalancingGroups.length > 0,
        groupsCount: rawRebalancingGroups.length,
      }
    : { hasGroups: false, groupsCount: 0 };

  // Show rebalancing section only when rebalancing groups exist
  const shouldShowRebalancingSection = reactiveRebalancingGroupsStatus.hasGroups;

  // Execute queries with optimized loader data hydration to prevent waterfalls
  const positionsResult = useQuery({
    queryKey: queryKeys.dashboard.positions(),
    queryFn: getPositionsServerFn,
    initialData: loaderData.positions,
    enabled: shouldShowRebalancingSection,
    refetchOnWindowFocus: 'always',
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes in background
    staleTime: 1 * 60 * 1000, // Consider stale after 1 minute
  });

  const metricsResult = useQuery({
    queryKey: queryKeys.dashboard.metrics(),
    queryFn: getPortfolioMetricsServerFn,
    initialData: loaderData.metrics,
    enabled: shouldShowRebalancingSection,
    refetchOnWindowFocus: 'always',
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes in background
    staleTime: 1 * 60 * 1000, // Consider stale after 1 minute
  });

  const transactionsResult = useQuery({
    queryKey: queryKeys.dashboard.transactions(),
    queryFn: getTransactionsServerFn,
    initialData: loaderData.transactions,
    enabled: shouldShowRebalancingSection,
    refetchOnWindowFocus: 'always',
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes in background
    staleTime: 1 * 60 * 1000, // Consider stale after 1 minute
  });

  const sleevesResult = useQuery({
    queryKey: queryKeys.dashboard.sleeves(),
    queryFn: getSleevesServerFn,
    initialData: loaderData.sleeves,
    enabled: shouldShowRebalancingSection,
    staleTime: 30 * 60 * 1000, // 30 minutes for static data
    gcTime: 60 * 60 * 1000, // 1 hour cache time
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const rebalancingGroupsResult = useQuery({
    queryKey: queryKeys.dashboard.groups(),
    queryFn: async () => loaderData.rebalancingGroups, // Use loader data as query function
    initialData: loaderData.rebalancingGroups,
    enabled: shouldShowRebalancingSection,
    refetchOnWindowFocus: 'always',
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes in background
    staleTime: 1 * 60 * 1000, // Consider stale after 1 minute
  });

  // Extract data
  const positions = positionsResult.data;
  const metrics = metricsResult.data;
  const transactions = transactionsResult.data;
  const sleeves = sleevesResult.data;
  const rebalancingGroups = rebalancingGroupsResult.data;

  // Simplified loading state management - core states only
  const isLoading =
    positionsResult.isPending ||
    metricsResult.isPending ||
    transactionsResult.isPending ||
    sleevesResult.isPending ||
    rebalancingGroupsResult.isPending;

  // Background refetch states for showing subtle loading indicators
  const isRefetching =
    (positionsResult.isFetching && !positionsResult.isPending) ||
    (metricsResult.isFetching && !metricsResult.isPending) ||
    (transactionsResult.isFetching && !transactionsResult.isPending) ||
    (sleevesResult.isFetching && !sleevesResult.isPending) ||
    (rebalancingGroupsResult.isFetching && !rebalancingGroupsResult.isPending);

  return {
    // Loading states - simplified to core states only
    isLoading,
    isRefetching,

    // Status data
    hasAccounts,
    schwabOAuthComplete,
    shouldShowRebalancingSection,

    // Reactive onboarding status
    reactiveSecuritiesStatus,
    reactiveModelsStatus,
    reactiveSchwabCredentialsStatus,
    reactiveRebalancingGroupsStatus,

    // Data
    positions,
    metrics,
    transactions,
    sleeves,
    rebalancingGroups,

    // Utility functions
    invalidateDashboardQueries: () => {
      queryInvalidators.dashboard.all(queryClient);
    },
  };
}
