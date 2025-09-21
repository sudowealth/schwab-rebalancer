import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { RebalancingGroup } from '~/features/auth/schemas';
import { useSchwabConnection } from '~/features/schwab/hooks/use-schwab-connection';
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
        queryKey: ['positions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['metrics'],
      });
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['sleeves'],
      });

      // Force refetch to bypass staleTime
      console.log('🔄 [Dashboard] Forcing refetch of all dashboard queries...');
      queryClient.refetchQueries({
        queryKey: ['positions'],
      });
      queryClient.refetchQueries({
        queryKey: ['metrics'],
      });
      queryClient.refetchQueries({
        queryKey: ['transactions'],
      });
      queryClient.refetchQueries({
        queryKey: ['sleeves'],
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
    queryKey: ['securities-status'],
    queryFn: () => checkSecuritiesExistServerFn(),
    initialData: loaderData.securitiesStatus,
    staleTime: 1000 * 60 * 5,
  });

  const { data: reactiveModelsStatus } = useQuery({
    queryKey: ['models-status'],
    queryFn: () => checkModelsExistServerFn(),
    initialData: loaderData.modelsStatus,
    staleTime: 1000 * 60 * 5,
  });

  const { data: reactiveSchwabCredentialsStatus } = useQuery({
    queryKey: ['schwab-credentials-status'],
    queryFn: () => checkSchwabCredentialsServerFn(),
    initialData: loaderData.schwabCredentialsStatus,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });

  // Use reactive queries for rebalancing groups status
  const { data: reactiveRebalancingGroupsStatus } = useQuery({
    queryKey: ['rebalancing-groups-dashboard'],
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

  // Lazy-loaded queries for secondary data (initialData removed since loader no longer fetches this data)
  const { data: positions, isLoading: positionsLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: getPositionsServerFn,
    initialData: [], // Start with empty array since loader no longer provides this
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster refresh after Schwab sync)
    enabled: shouldShowRebalancingSection, // Only load if we should show the section
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
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
    }, // Default metrics since loader no longer provides this
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster refresh after Schwab sync)
    enabled: shouldShowRebalancingSection, // Only load if we should show the section
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: getTransactionsServerFn,
    initialData: [], // Start with empty array since loader no longer provides this
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster refresh after Schwab sync)
    enabled: shouldShowRebalancingSection, // Only load if we should show the section
  });

  const { data: sleeves, isLoading: sleevesLoading } = useQuery({
    queryKey: ['sleeves'],
    queryFn: getSleevesServerFn,
    initialData: [], // Start with empty array since loader no longer provides this
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster refresh after Schwab sync)
    enabled: shouldShowRebalancingSection, // Only load if we should show the section
  });

  // Use the exact same data loading logic as /rebalancing-groups route
  const { data: rebalancingGroups, isLoading: rebalancingGroupsLoading } = useQuery({
    queryKey: ['rebalancing-groups-dashboard'],
    queryFn: getRebalancingGroupsWithBalancesServerFn,
    initialData: loaderData.rebalancingGroups,
    staleTime: 1000 * 60 * 2,
    enabled: shouldShowRebalancingSection, // Only load if we should show the section
  });

  const isLoading =
    positionsLoading ||
    metricsLoading ||
    transactionsLoading ||
    sleevesLoading ||
    rebalancingGroupsLoading;

  return {
    // Loading state
    isLoading,

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
        queryKey: ['positions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['metrics'],
      });
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['sleeves'],
      });
    },
  };
}
