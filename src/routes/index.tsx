import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { OnboardingTracker } from '~/components/OnboardingTracker';
import { ExportButton } from '~/components/ui/export-button';
import type { Sleeve } from '~/features/auth/schemas';
import { DashboardMetrics } from '~/features/dashboard/components/dashboard-metrics';
import { PositionsTable } from '~/features/dashboard/components/positions-table';
import { RebalancingGroupsTab } from '~/features/dashboard/components/rebalancing-groups-tab';
import { SecurityModal } from '~/features/dashboard/components/security-modal';
import { SleeveModal } from '~/features/dashboard/components/sleeve-modal';
import { TransactionsTable } from '~/features/dashboard/components/transactions-table';
import { useDashboardData } from '~/features/dashboard/hooks/use-dashboard-data';
import { useDashboardModals } from '~/features/dashboard/hooks/use-dashboard-modals';
import { useDashboardTabs } from '~/features/dashboard/hooks/use-dashboard-tabs';
import { useOnboardingStatus } from '~/features/dashboard/hooks/use-onboarding-status';
import { useSecuritiesSeeding } from '~/features/data-feeds/hooks/use-securities-seeding';
import { seedSecuritiesDataServerFn } from '~/features/data-feeds/import.server';
import { useExcelExport } from '~/lib/excel-export';
import { authGuard } from '~/lib/route-guards';
import {
  checkSecuritiesExistServerFn,
  getCompleteDashboardDataServerFn,
} from '~/lib/server-functions';

// Dashboard skeleton component for route-level loading states
function DashboardSkeleton() {
  return (
    <div className="px-4 py-8">
      <div className="animate-pulse">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <div className="h-10 bg-gray-300 rounded w-32" />
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          {[...Array(3)].map(() => (
            <div key="metric-card" className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="h-4 bg-gray-300 rounded mb-2 w-3/4" />
                <div className="h-8 bg-gray-300 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>

        {/* Content Area */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              {[...Array(5)].map(() => (
                <div key="content-row" className="flex space-x-4">
                  <div className="h-4 bg-gray-300 rounded flex-1" />
                  <div className="h-4 bg-gray-300 rounded w-20" />
                  <div className="h-4 bg-gray-300 rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: DashboardComponent,
  pendingMs: 200,
  pendingComponent: () => <DashboardSkeleton />,
  beforeLoad: authGuard,
  validateSearch: (search: Record<string, unknown>) => ({
    schwabConnected: search.schwabConnected as string | undefined,
  }),
  loader: async ({ context: _context }) => {
    // Load all dashboard data atomically in a single server function call
    // This eliminates waterfalls by loading everything in parallel on the server
    return getCompleteDashboardDataServerFn();
  },
});

function DashboardComponent() {
  const loaderData = Route.useLoaderData();

  // Note: loaderData.user is available as fallback for session?.user if needed
  // Note: Server-side auth check in loader ensures user is authenticated

  // Custom hooks for state management
  const { activeTab, setActiveTab } = useDashboardTabs();
  const {
    selectedSleeve,
    showSleeveModal,
    handleSleeveClick,
    closeSleeveModal,
    selectedTicker,
    showSecurityModal,
    handleTickerClick,
    closeSecurityModal,
  } = useDashboardModals();

  // Use the custom hook to manage all dashboard data and logic
  const {
    isLoading,
    schwabOAuthComplete,
    shouldShowRebalancingSection,
    reactiveSecuritiesStatus,
    reactiveModelsStatus,
    reactiveSchwabCredentialsStatus,
    reactiveRebalancingGroupsStatus,
    positions,
    metrics,
    transactions,
    sleeves,
    rebalancingGroups,
  } = useDashboardData(loaderData);

  // Query for securities status with full query metadata for seeding hook
  const {
    data: securitiesStatusForSeeding,
    status: securitiesQueryStatus,
    fetchStatus: securitiesFetchStatus,
    isFetchedAfterMount: securitiesFetchedAfterMount,
  } = useQuery({
    queryKey: ['dashboard-securities-status'],
    queryFn: () => checkSecuritiesExistServerFn(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // DEBUG: Force hasSecurities to false to test automatic import
  const debugSecuritiesStatus = securitiesStatusForSeeding
    ? {
        ...securitiesStatusForSeeding,
        hasSecurities: false,
        securitiesCount: 0,
      }
    : undefined;

  // DEBUG: Directly call seeding function to test
  useEffect(() => {
    console.log('🔥 DEBUG: Component mounted, calling seedSecuritiesDataServerFn');
    seedSecuritiesDataServerFn()
      .then((result) => {
        console.log('🔥 DEBUG: Seeding result:', result);
      })
      .catch((error) => {
        console.error('🔥 DEBUG: Seeding error:', error);
      });
  }, []); // Run once on mount

  // Use the securities seeding hook to automatically import securities when needed
  const { isSeeding, hasError, seedResult, showSuccessMessage } = useSecuritiesSeeding(
    debugSecuritiesStatus,
    securitiesQueryStatus,
    securitiesFetchStatus,
    securitiesFetchedAfterMount,
  );

  // Use the onboarding status hook for clean conditional rendering
  const { title, subtitle } = useOnboardingStatus({
    securitiesStatus: reactiveSecuritiesStatus,
    schwabCredentialsStatus: reactiveSchwabCredentialsStatus,
    modelsStatus: reactiveModelsStatus,
    rebalancingGroupsStatus: reactiveRebalancingGroupsStatus,
    schwabOAuthComplete,
  });

  // Lazy-loaded Excel export functions
  const { exportPositionsToExcel, exportTransactionsToExcel } = useExcelExport();

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
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          </div>
        </div>
      </div>

      {/* Onboarding Tracker - shows progress through setup steps */}
      <OnboardingTracker
        schwabCredentialsStatusProp={reactiveSchwabCredentialsStatus}
        schwabOAuthStatusProp={{ hasCredentials: schwabOAuthComplete }}
        rebalancingGroupsStatus={
          reactiveRebalancingGroupsStatus as { hasGroups: boolean; groupsCount: number } | undefined
        }
        securitiesStatusProp={reactiveSecuritiesStatus}
        modelsStatusProp={reactiveModelsStatus}
        securitiesSeedingState={{ isSeeding, hasError, seedResult, showSuccessMessage }}
      />

      {shouldShowRebalancingSection && metrics && <DashboardMetrics metrics={metrics} />}

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
                  {/* Export button placeholder to maintain consistent height across tabs */}
                  {(activeTab === 'positions' && positions && positions.length > 0) ||
                  (activeTab === 'transactions' && transactions && transactions.length > 0) ? (
                    <>
                      {activeTab === 'positions' && positions && positions.length > 0 && (
                        <ExportButton
                          onExport={async () => exportPositionsToExcel(positions)}
                          label="Export Positions"
                        />
                      )}
                      {activeTab === 'transactions' && transactions && transactions.length > 0 && (
                        <ExportButton
                          onExport={async () => exportTransactionsToExcel(transactions)}
                          label="Export Transactions"
                        />
                      )}
                    </>
                  ) : (
                    <div className="h-9 w-9" aria-hidden="true" />
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
        onClose={closeSleeveModal}
        sleeve={
          selectedSleeve ? sleeves?.find((s: Sleeve) => s.id === selectedSleeve) || null : null
        }
      />

      <SecurityModal
        isOpen={showSecurityModal}
        onClose={closeSecurityModal}
        ticker={selectedTicker}
        sp500Data={loaderData.sp500Data}
        positions={positions}
        transactions={transactions}
      />
    </div>
  );
}
