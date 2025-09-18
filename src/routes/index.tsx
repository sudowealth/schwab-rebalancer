import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DashboardMetrics } from '../components/dashboard/dashboard-metrics';
import { PositionsTable } from '../components/dashboard/positions-table';
import { RebalancingGroupsTab } from '../components/dashboard/rebalancing-groups-tab';
import { SecurityModal } from '../components/dashboard/security-modal';
import { SleeveModal } from '../components/dashboard/sleeve-modal';
import { TransactionsTable } from '../components/dashboard/transactions-table';
import { OnboardingTracker } from '../components/OnboardingTracker';
import { ExportButton } from '../components/ui/export-button';
import { exportPositionsToExcel, exportTransactionsToExcel } from '../lib/excel-export';
import type { Sleeve } from '../lib/schemas';
// Use server functions for live data so client refetches return real results
import {
  getDashboardDataServerFn,
  getGroupAccountHoldingsServerFn,
  getPortfolioMetricsServerFn,
  getPositionsServerFn,
  getRebalancingGroupsServerFn,
  getSleevesServerFn,
  getTransactionsServerFn,
} from '../lib/server-functions';

// Utility function that replicates the exact loader logic from /rebalancing-groups route
async function loadRebalancingGroupsData() {
  const groups = await getRebalancingGroupsServerFn();

  // Get account holdings for all groups to calculate proper balances
  const updatedGroups = await Promise.all(
    groups.map(async (group) => {
      const accountIds = group.members.map((member) => member.accountId);
      const accountHoldings =
        accountIds.length > 0
          ? await getGroupAccountHoldingsServerFn({
              data: { accountIds },
            })
          : [];

      // Update group members with calculated balances from holdings
      const updatedMembers = group.members.map((member) => {
        const accountData = accountHoldings.find((ah) => ah.accountId === member.accountId);
        return {
          ...member,
          balance: accountData ? accountData.accountBalance : member.balance,
        };
      });

      return {
        ...group,
        members: updatedMembers,
      };
    }),
  );

  return updatedGroups;
}

export const Route = createFileRoute('/')({
  component: DashboardComponent,
  loader: async ({ context: _context }) => {
    try {
      // Fetch all dashboard data in parallel to eliminate waterfalls
      const [dashboardData, rebalancingGroups] = await Promise.all([
        getDashboardDataServerFn(),
        loadRebalancingGroupsData(),
      ]);
      return { ...dashboardData, rebalancingGroups };
    } catch (error) {
      // If authentication error, redirect to login
      if (error instanceof Error && error.message.includes('Authentication required')) {
        throw redirect({ to: '/login', search: { reset: '', redirect: '/' } });
      }
      // Re-throw other errors
      throw error;
    }
  },
});

function DashboardComponent() {
  const loaderData = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'positions' | 'transactions' | 'rebalancing-groups'>(
    'rebalancing-groups',
  );

  // Note: loaderData.user is available as fallback for session?.user if needed

  // Note: Server-side auth check in loader ensures user is authenticated
  // No client-side redirect needed

  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null);
  const [showSleeveModal, setShowSleeveModal] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

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

  const hasAccounts =
    loaderData && 'accountsCount' in loaderData ? loaderData.accountsCount > 0 : false;

  // For the dashboard, we also want to show rebalancing groups if we have accounts
  // and the user has completed onboarding (has models, etc.)
  // We'll use a simple approach: show if we have accounts and either have groups or are still loading
  const shouldShowRebalancingSection = hasAccounts;

  const { data: positions, isLoading: positionsLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: getPositionsServerFn,
    initialData: loaderData.positions,
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster refresh after Schwab sync)
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: getPortfolioMetricsServerFn,
    initialData: loaderData.metrics,
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster refresh after Schwab sync)
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: getTransactionsServerFn,
    initialData: loaderData.transactions,
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster refresh after Schwab sync)
  });

  const { data: sleeves, isLoading: sleevesLoading } = useQuery({
    queryKey: ['sleeves'],
    queryFn: getSleevesServerFn,
    initialData: loaderData.sleeves,
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster refresh after Schwab sync)
  });

  // Use the exact same data loading logic as /rebalancing-groups route
  const { data: rebalancingGroups, isLoading: rebalancingGroupsLoading } = useQuery({
    queryKey: ['rebalancing-groups-dashboard'],
    queryFn: loadRebalancingGroupsData,
    initialData: loaderData.rebalancingGroups,
    staleTime: 1000 * 60 * 2,
  });

  const isLoading =
    positionsLoading ||
    metricsLoading ||
    transactionsLoading ||
    sleevesLoading ||
    rebalancingGroupsLoading;

  const handleTickerClick = (ticker: string) => {
    setSelectedTicker(ticker);
    setShowSecurityModal(true);
  };

  const handleSleeveClick = (sleeveId: string) => {
    setSelectedSleeve(sleeveId);
    setShowSleeveModal(true);
  };

  if (isLoading) {
    return (
      <div className="px-4 py-8">
        <div className="animate-pulse">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="h-4 bg-gray-300 rounded mb-2" />
                <div className="h-8 bg-gray-300 rounded" />
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="h-4 bg-gray-300 rounded mb-2" />
                <div className="h-8 bg-gray-300 rounded" />
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="h-4 bg-gray-300 rounded mb-2" />
                <div className="h-8 bg-gray-300 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            {(() => {
              // Calculate if onboarding is complete (same logic as OnboardingTracker)
              const securitiesComplete = loaderData.securitiesStatus?.hasSecurities || false;
              const schwabCredentialsComplete =
                loaderData.schwabCredentialsStatus?.hasCredentials || false;
              const schwabOAuthComplete = loaderData.schwabOAuthStatus?.hasCredentials || false;
              const modelsComplete = loaderData.modelsStatus?.hasModels || false;
              const rebalancingGroupsComplete =
                loaderData.rebalancingGroupsStatus?.hasGroups || false;

              const isFullyOnboarded =
                securitiesComplete &&
                schwabCredentialsComplete &&
                schwabOAuthComplete &&
                modelsComplete &&
                rebalancingGroupsComplete;

              return isFullyOnboarded ? (
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900">Getting Started</h1>
                  <p className="text-sm text-gray-600">
                    Complete these steps to start rebalancing your portfolio at Schwab
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Onboarding Tracker - shows progress through setup steps */}
      <OnboardingTracker
        schwabCredentialsStatusProp={loaderData.schwabCredentialsStatus}
        schwabOAuthStatusProp={loaderData.schwabOAuthStatus}
        rebalancingGroupsStatus={loaderData.rebalancingGroupsStatus}
        securitiesStatusProp={loaderData.securitiesStatus}
        modelsStatusProp={loaderData.modelsStatus}
      />

      {shouldShowRebalancingSection && <DashboardMetrics metrics={metrics} />}

      {/* Positions and Transactions */}
      {shouldShowRebalancingSection && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Portfolio Information
                </h3>
                <div className="flex space-x-2">
                  {activeTab === 'positions' && positions && positions.length > 0 && (
                    <ExportButton
                      onExport={() => exportPositionsToExcel(positions)}
                      label="Export Positions"
                    />
                  )}
                  {activeTab === 'transactions' && transactions && transactions.length > 0 && (
                    <ExportButton
                      onExport={() => exportTransactionsToExcel(transactions)}
                      label="Export Transactions"
                    />
                  )}
                </div>
              </div>
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('rebalancing-groups')}
                    className={`shrink-0 py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                      activeTab === 'rebalancing-groups'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="hidden sm:inline">Rebalancing Groups</span>
                    <span className="sm:hidden">Groups</span>
                    <span className="ml-1">({rebalancingGroups?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('positions')}
                    className={`shrink-0 py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                      activeTab === 'positions'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="hidden sm:inline">Positions</span>
                    <span className="sm:hidden">Positions</span>
                    <span className="ml-1">({positions?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('transactions')}
                    className={`shrink-0 py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                      activeTab === 'transactions'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="hidden sm:inline">Transactions</span>
                    <span className="sm:hidden">Txns</span>
                    <span className="ml-1">({transactions?.length || 0})</span>
                  </button>
                </nav>
              </div>
            </div>

            {activeTab === 'rebalancing-groups' && (
              <RebalancingGroupsTab groups={rebalancingGroups || []} />
            )}

            {activeTab === 'positions' && (
              <PositionsTable
                positions={positions || []}
                onTickerClick={handleTickerClick}
                onSleeveClick={handleSleeveClick}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsTable
                transactions={transactions || []}
                onTickerClick={handleTickerClick}
                onSleeveClick={handleSleeveClick}
              />
            )}
          </div>
        </div>
      )}

      <SleeveModal
        isOpen={showSleeveModal}
        onClose={() => setShowSleeveModal(false)}
        sleeve={
          selectedSleeve ? sleeves?.find((s: Sleeve) => s.id === selectedSleeve) || null : null
        }
      />

      <SecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        ticker={selectedTicker}
        sp500Data={[]}
        positions={positions}
        transactions={transactions}
      />
    </div>
  );
}
