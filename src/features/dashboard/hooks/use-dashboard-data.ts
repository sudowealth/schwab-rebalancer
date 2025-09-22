import { useQueryClient } from '@tanstack/react-query';
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
import {
  useBackgroundRefetchManager,
  useCriticalLoaderQuery,
  useLoaderQuery,
  useOnboardingLoaderQuery,
  useStaticLoaderQuery,
} from '~/lib/loader-query-hooks';
import { queryInvalidators, queryKeys } from '~/lib/query-keys';
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
  const refetchManager = useBackgroundRefetchManager();

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
      console.log('✅ [Dashboard] Dashboard data refresh initiated after Schwab connection');
    }
  }, [queryClient]);

  // Calculate derived state
  const hasAccounts =
    loaderData && 'accountsCount' in loaderData ? loaderData.accountsCount > 0 : false;

  // Use Schwab connection hook for OAuth status (same as OnboardingTracker)
  const { isConnected: schwabOAuthComplete } = useSchwabConnection(
    loaderData.schwabCredentialsStatus,
    loaderData.schwabOAuthStatus,
    false, // Disable sync triggering - handled globally in root component
  );

  // Use optimized onboarding loader queries
  const { data: reactiveSecuritiesStatus } = useOnboardingLoaderQuery({
    queryKey: queryKeys.onboarding.securities(),
    queryFn: checkSecuritiesExistServerFn,
    initialData: loaderData.securitiesStatus,
  });

  const { data: reactiveModelsStatus } = useOnboardingLoaderQuery({
    queryKey: queryKeys.onboarding.models(),
    queryFn: checkModelsExistServerFn,
    initialData: loaderData.modelsStatus,
  });

  const { data: reactiveSchwabCredentialsStatus } = useOnboardingLoaderQuery({
    queryKey: queryKeys.onboarding.schwab(),
    queryFn: checkSchwabCredentialsServerFn,
    initialData: loaderData.schwabCredentialsStatus,
  });

  // Use reactive queries for rebalancing groups status with optimized loader query
  const { data: rawRebalancingGroups } = useLoaderQuery({
    queryKey: queryKeys.dashboard.groups(),
    queryFn: getRebalancingGroupsWithBalancesServerFn,
    initialData: loaderData.rebalancingGroups,
  });

  // Transform the data for onboarding status
  const reactiveRebalancingGroupsStatus = rawRebalancingGroups
    ? {
        hasGroups: rawRebalancingGroups.length > 0,
        groupsCount: rawRebalancingGroups.length,
      }
    : { hasGroups: false, groupsCount: 0 };

  // For the dashboard, we also want to show rebalancing groups if we have accounts
  // and the user has completed onboarding (has models, etc.)
  // We'll use a simple approach: show if we have accounts and either have groups or are still loading
  const shouldShowRebalancingSection = hasAccounts;

  // Setup background refetching for critical dashboard data
  useEffect(() => {
    if (shouldShowRebalancingSection) {
      refetchManager.startCriticalRefetching([
        queryKeys.dashboard.positions(),
        queryKeys.dashboard.metrics(),
        queryKeys.dashboard.groups(),
      ]);
    }

    return () => {
      refetchManager.stopAll();
    };
  }, [refetchManager, shouldShowRebalancingSection]);

  // Execute queries with optimized loader data hydration to prevent waterfalls
  const positionsResult = useCriticalLoaderQuery({
    queryKey: queryKeys.dashboard.positions(),
    queryFn: getPositionsServerFn,
    initialData: loaderData.positions,
    enabled: shouldShowRebalancingSection,
  });

  const metricsResult = useCriticalLoaderQuery({
    queryKey: queryKeys.dashboard.metrics(),
    queryFn: getPortfolioMetricsServerFn,
    initialData: loaderData.metrics,
    enabled: shouldShowRebalancingSection,
  });

  const transactionsResult = useCriticalLoaderQuery({
    queryKey: queryKeys.dashboard.transactions(),
    queryFn: getTransactionsServerFn,
    initialData: loaderData.transactions,
    enabled: shouldShowRebalancingSection,
  });

  const sleevesResult = useStaticLoaderQuery({
    queryKey: queryKeys.dashboard.sleeves(),
    queryFn: getSleevesServerFn,
    initialData: loaderData.sleeves,
    enabled: shouldShowRebalancingSection,
  });

  const rebalancingGroupsResult = useCriticalLoaderQuery({
    queryKey: queryKeys.dashboard.groups(),
    queryFn: getRebalancingGroupsWithBalancesServerFn,
    initialData: loaderData.rebalancingGroups,
    enabled: shouldShowRebalancingSection,
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
