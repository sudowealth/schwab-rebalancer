import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { RebalancingGroup } from '~/features/auth/schemas';
import { useSchwabConnection } from '~/features/schwab/hooks/use-schwab-connection';
import { queryKeys } from '~/lib/query-keys';
import {
  checkModelsExistServerFn,
  checkSchwabCredentialsServerFn,
  checkSecuritiesExistServerFn,
  getPortfolioMetricsServerFn,
  getPositionsServerFn,
  getRebalancingGroupsWithBalancesServerFn,
  getSleevesServerFn,
  getTransactionsServerFn,
} from '~/lib/server-functions';

interface LoaderData {
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

  // Detect Schwab OAuth callback and refresh data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthCallback = urlParams.has('code') && urlParams.has('state');

    if (hasOAuthCallback) {
      console.log('🔄 [Dashboard] Detected Schwab OAuth callback, refreshing dashboard data...');
      console.log('🔄 [Dashboard] URL params:', {
        code: `${urlParams.get('code')?.substring(0, 10)}...`,
        state: urlParams.get('state'),
      });

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Invalidate all dashboard queries to ensure fresh data after Schwab connection
      console.log('🔄 [Dashboard] Invalidating all dashboard queries...');
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
        refetchType: 'active', // Only refetch active queries
      });

      console.log('✅ [Dashboard] Dashboard data refresh initiated after Schwab OAuth callback');
    }
  }, [queryClient]);

  // Calculate derived state
  const hasAccounts =
    loaderData && 'accountsCount' in loaderData ? loaderData.accountsCount > 0 : false;

  // Use Schwab connection hook for OAuth status (same as OnboardingTracker)
  const { isConnected: schwabOAuthComplete } = useSchwabConnection(
    loaderData.schwabCredentialsStatus,
    loaderData.schwabOAuthStatus,
  );

  // Use reactive queries for onboarding status (same as OnboardingTracker)
  const { data: reactiveSecuritiesStatus } = useQuery({
    queryKey: queryKeys.onboarding.securities(),
    queryFn: () => checkSecuritiesExistServerFn(),
    initialData: loaderData.securitiesStatus,
    staleTime: 1000 * 60 * 5,
  });

  const { data: reactiveModelsStatus } = useQuery({
    queryKey: queryKeys.onboarding.models(),
    queryFn: () => checkModelsExistServerFn(),
    initialData: loaderData.modelsStatus,
    staleTime: 1000 * 60 * 5,
  });

  const { data: reactiveSchwabCredentialsStatus } = useQuery({
    queryKey: queryKeys.onboarding.schwab(),
    queryFn: () => checkSchwabCredentialsServerFn(),
    initialData: loaderData.schwabCredentialsStatus,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });

  // Use reactive queries for rebalancing groups status
  const { data: reactiveRebalancingGroupsStatus } = useQuery({
    queryKey: queryKeys.dashboard.groups(),
    queryFn: getRebalancingGroupsWithBalancesServerFn,
    initialData: loaderData.rebalancingGroups,
    staleTime: 1000 * 60 * 2,
    select: (groups) => ({
      hasGroups: groups && groups.length > 0,
      groupsCount: groups ? groups.length : 0,
    }),
  });

  // For the dashboard, we also want to show rebalancing groups if we have accounts
  // and the user has completed onboarding (has models, etc.)
  // We'll use a simple approach: show if we have accounts and either have groups or are still loading
  const shouldShowRebalancingSection = hasAccounts;

  // Execute queries with consistent configuration
  const positionsResult = useQuery({
    queryKey: queryKeys.dashboard.positions(),
    queryFn: getPositionsServerFn,
    initialData: [],
    enabled: shouldShowRebalancingSection,
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster refresh after Schwab sync)
  });

  const metricsResult = useQuery({
    queryKey: queryKeys.dashboard.metrics(),
    queryFn: getPortfolioMetricsServerFn,
    initialData: {
      totalMarketValue: 0,
      totalCostBasis: 0,
      unrealizedGain: 0,
      unrealizedGainPercent: 0,
      realizedGain: 0,
      realizedGainPercent: 0,
      totalGain: 0,
      totalGainPercent: 0,
      ytdHarvestedLosses: 0,
      harvestablelosses: 0,
      harvestingTarget: {
        year1Target: 0.03,
        steadyStateTarget: 0.02,
        currentProgress: 0,
      },
    },
    enabled: shouldShowRebalancingSection,
    staleTime: 1000 * 60 * 2,
  });

  const transactionsResult = useQuery({
    queryKey: queryKeys.dashboard.transactions(),
    queryFn: getTransactionsServerFn,
    initialData: [],
    enabled: shouldShowRebalancingSection,
    staleTime: 1000 * 60 * 2,
  });

  const sleevesResult = useQuery({
    queryKey: queryKeys.dashboard.sleeves(),
    queryFn: getSleevesServerFn,
    initialData: [],
    enabled: shouldShowRebalancingSection,
    staleTime: 1000 * 60 * 2,
  });

  const rebalancingGroupsResult = useQuery({
    queryKey: queryKeys.dashboard.groups(),
    queryFn: getRebalancingGroupsWithBalancesServerFn,
    initialData: loaderData.rebalancingGroups,
    enabled: shouldShowRebalancingSection,
    staleTime: 1000 * 60 * 2,
  });

  // Extract data
  const positions = positionsResult.data;
  const metrics = metricsResult.data;
  const transactions = transactionsResult.data;
  const sleeves = sleevesResult.data;
  const rebalancingGroups = rebalancingGroupsResult.data;

  // Enhanced loading state management
  const isLoading =
    positionsResult.isPending ||
    metricsResult.isPending ||
    transactionsResult.isPending ||
    sleevesResult.isPending ||
    rebalancingGroupsResult.isPending;

  // Individual loading states for more granular control
  const isLoadingPositions = positionsResult.isPending;
  const isLoadingMetrics = metricsResult.isPending;
  const isLoadingTransactions = transactionsResult.isPending;
  const isLoadingSleeves = sleevesResult.isPending;
  const isLoadingRebalancingGroups = rebalancingGroupsResult.isPending;

  // Background refetch states (useful for showing subtle loading indicators)
  const isRefetching =
    (positionsResult.isFetching && !positionsResult.isPending) ||
    (metricsResult.isFetching && !metricsResult.isPending) ||
    (transactionsResult.isFetching && !transactionsResult.isPending) ||
    (sleevesResult.isFetching && !sleevesResult.isPending) ||
    (rebalancingGroupsResult.isFetching && !rebalancingGroupsResult.isPending);

  return {
    // Loading states
    isLoading,
    isRefetching,
    loadingStates: {
      positions: isLoadingPositions,
      metrics: isLoadingMetrics,
      transactions: isLoadingTransactions,
      sleeves: isLoadingSleeves,
      rebalancingGroups: isLoadingRebalancingGroups,
    },

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
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
    },
  };
}
