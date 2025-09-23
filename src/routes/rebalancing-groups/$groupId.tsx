import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { Edit, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { RebalancingErrorBoundary } from '~/components/RouteErrorBoundaries';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { SecurityModal } from '~/features/dashboard/components/security-modal';
import { SleeveModal } from '~/features/dashboard/components/sleeve-modal';
import { AccountSummary } from '~/features/rebalancing/components/account-summary';
import { OrdersBlotter } from '~/features/rebalancing/components/blotter/orders-blotter';
import { DeleteRebalancingGroupModal } from '~/features/rebalancing/components/delete-rebalancing-group-modal';
import { EditRebalancingGroupModal } from '~/features/rebalancing/components/edit-rebalancing-group-modal';
import { LazyAllocationChart } from '~/features/rebalancing/components/lazy-allocation-chart';
import { RebalanceModal } from '~/features/rebalancing/components/rebalance-modal';
import { RebalanceSummaryCards } from '~/features/rebalancing/components/rebalance-summary-cards';
import { SleeveAllocationTable } from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-table';
import type { SortField } from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-table-headers';
import { TopHoldings } from '~/features/rebalancing/components/top-holdings';
import { useExpansionState } from '~/features/rebalancing/hooks/use-expansion-state';
import { useModalState } from '~/features/rebalancing/hooks/use-modal-state';
import { useRebalancingState } from '~/features/rebalancing/hooks/use-rebalancing-state';
import { useAvailableCash, useSleeveAllocations } from '~/features/rebalancing/hooks/use-sleeve-allocations';
import { useSortingState } from '~/features/rebalancing/hooks/use-sorting-state';
import { useTradeManagement } from '~/features/rebalancing/hooks/use-trade-management';
import { queryInvalidators } from '~/lib/query-keys';
import { authGuard } from '~/lib/route-guards';
import {
  getRebalancingGroupDataServerFn,
  rebalancePortfolioServerFn,
  syncSchwabPricesServerFn,
} from '~/lib/server-functions';
import type { RebalanceMethod } from '~/types/rebalance';

// Memoized OrdersBlotter component to prevent unnecessary re-renders
const MemoizedOrdersBlotter = React.memo<{
  groupId: string;
  accountHoldings: Array<{
    accountId: string;
    accountBalance: number;
    accountName?: string;
    accountType?: string;
    holdings: Array<{
      ticker: string;
      qty: number;
      currentPrice?: number;
      marketValue: number;
      costBasisPerShare?: number;
      unrealizedGain?: number;
      openedAt?: Date;
    }>;
  }>;
  sp500Data: Array<{
    ticker: string;
    price: number;
  }>;
  groupMembers: Array<{
    id: string;
    accountId: string;
    balance: number;
    accountName?: string;
    accountNumber?: string;
  }>;
  onPricesUpdated: () => void;
}>(({ groupId, accountHoldings, sp500Data, groupMembers, onPricesUpdated }) => {
  // Memoize prices calculation
  const prices = useMemo(() => {
    const holdingsPairs = (Array.isArray(accountHoldings) ? accountHoldings : [])
      .flatMap((a) => (Array.isArray(a.holdings) ? a.holdings : []))
      .map((h) => [h.ticker, h.currentPrice || 0] as const);
    const sp500Pairs = (Array.isArray(sp500Data) ? sp500Data : []).map(
      (s) => [s.ticker, s.price || 0] as const,
    );
    // Prefer holdings price when available, else fallback to sp500 quote
    const merged = new Map<string, number>([...sp500Pairs, ...holdingsPairs]);
    return Object.fromEntries(merged);
  }, [accountHoldings, sp500Data]);

  // Memoize accounts calculation
  const accounts = useMemo(() => {
    const map = new Map<string, { name: string; number?: string | null }>();
    (Array.isArray(groupMembers) ? groupMembers : []).forEach((m) => {
      map.set(m.accountId, {
        name: m.accountName || '',
        number: (m as { accountNumber?: string }).accountNumber || null,
      });
    });
    return Object.fromEntries(map);
  }, [groupMembers]);

  return (
    <OrdersBlotter
      groupId={groupId}
      prices={prices}
      accounts={accounts}
      onPricesUpdated={onPricesUpdated}
    />
  );
});

export const Route = createFileRoute('/rebalancing-groups/$groupId')({
  errorComponent: RebalancingErrorBoundary,
  beforeLoad: authGuard,
  validateSearch: (search: Record<string, unknown>) => {
    const result: { rebalance?: string } = {};
    if (typeof search.rebalance === 'string') {
      result.rebalance = search.rebalance;
    }
    return result;
  },
  loader: async ({ params }) => {
    // Single server function call eliminates waterfall loading
    return getRebalancingGroupDataServerFn({ data: { groupId: params.groupId } });
  },
  component: RebalancingGroupDetail,
});

function RebalancingGroupDetail() {
  const {
    group,
    accountHoldings,
    sleeveMembers,
    sp500Data,
    transactions,
    positions,
    proposedTrades,
    allocationData,
    holdingsData,
  } = Route.useLoaderData();
  const router = useRouter();
  const searchParams = Route.useSearch();

  const [allocationView, setAllocationView] = useState<
    'account' | 'sector' | 'industry' | 'sleeve'
  >('sleeve');
  const [groupingMode, setGroupingMode] = useState<'sleeve' | 'account'>('sleeve');

  // Custom hooks for state management
  const expansionState = useExpansionState();
  const modalState = useModalState();
  const sortingState = useSortingState();
  const tradeManagement = useTradeManagement(group.members);
  const rebalancingState = useRebalancingState();

  // Query client for invalidation
  const queryClient = useQueryClient();

  // Global mutation state awareness
  const isAnyMutationRunning = useIsMutating() > 0;

  // Self-contained mutations that focus only on data operations
  const rebalanceMutation = useMutation({
    mutationFn: async (params: { method: RebalanceMethod; cashAmount?: number }) =>
      rebalancePortfolioServerFn({
        data: {
          portfolioId: group.id,
          method: params.method,
          cashAmount: params.cashAmount,
        },
      }),
    onSuccess: (result) => {
      console.log('📊 [GroupComponent] Rebalance completed successfully');
      // Update trade data in UI state
      tradeManagement.setTrades(result.trades);
      // Invalidate related queries to refresh data
      queryInvalidators.rebalancing.groups.detail(queryClient, group.id);
    },
    onError: (error) => {
      console.error('❌ [GroupComponent] Rebalance failed:', error);
      // Clear any partial trade state on error to prevent stale data
      tradeManagement.clearTrades();
      // Show user-friendly error (could be handled by error boundary or toast)
    },
    onMutate: () => {
      console.log('🔄 [GroupComponent] Starting rebalance operation...');
    },
    retry: (failureCount, error: unknown) => {
      // Only retry on network errors, not on validation or business logic errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string })?.code;
      const isRetryableError =
        errorMessage?.includes('network') ||
        errorMessage?.includes('timeout') ||
        errorCode === 'ECONNRESET';
      return failureCount < 1 && isRetryableError;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff, max 5s
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const syncPricesMutation = useMutation({
    mutationFn: async (symbols: string[]) => syncSchwabPricesServerFn({ data: { symbols } }),
    onSuccess: () => {
      console.log('🔄 [GroupComponent] Price sync completed successfully, updating UI...');
      // Invalidate queries that depend on price data
      queryInvalidators.rebalancing.groups.detail(queryClient, group.id);
    },
    onError: (error) => {
      console.error('❌ [GroupComponent] Price sync failed:', error);
      // Could show user notification here
    },
    onMutate: () => {
      console.log('🔄 [GroupComponent] Starting price sync operation...');
    },
    retry: (failureCount, error: unknown) => {
      // Retry up to 2 times for network-related errors, but not for auth errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string })?.code;
      const isRetryableError =
        !errorMessage?.includes('unauthorized') &&
        !errorMessage?.includes('forbidden') &&
        (errorMessage?.includes('network') ||
          errorMessage?.includes('timeout') ||
          errorCode === 'ECONNRESET' ||
          errorCode === 'ETIMEDOUT');
      return failureCount < 2 && isRetryableError;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff, max 10s
    gcTime: 10 * 60 * 1000, // Keep price sync results in cache for 10 minutes
  });

  // Memoize total portfolio value calculation
  const totalValue = useMemo(
    () => group.members.reduce((sum: number, member) => sum + (member.balance || 0), 0),
    [group.members],
  );

  // Use custom hook for sleeve allocations
  const { sleeveTableData, sleeveAllocationData } = useSleeveAllocations(
    group,
    accountHoldings,
    sleeveMembers,
    transactions,
    'all',
    totalValue,
  );

  // Extract available cash calculation to custom hook
  const availableCash = useAvailableCash(sleeveTableData);

  // Memoize filtered allocation data
  const filteredAllocationData = useMemo(
    () =>
      allocationData.filter(
        (item: {
          name: string | null | undefined;
          value: number | null | undefined;
          percentage: number | null | undefined;
          color: string | null | undefined;
        }): item is {
          name: string;
          value: number;
          percentage: number;
          color: string;
        } => item.name != null && item.value != null,
      ),
    [allocationData],
  );

  // Memoize account summary members to prevent object creation on every render
  const accountSummaryMembers = useMemo(
    () =>
      group.members.map((member) => ({
        id: member.id,
        accountId: member.accountId,
        accountName: member.accountName || '',
        accountType: member.accountType || '',
        accountNumber: (member as { accountNumber?: string }).accountNumber,
        balance: member.balance || 0,
      })),
    [group.members],
  );

  // Memoize sleeve table group members to prevent object creation on every render
  const sleeveTableGroupMembers = useMemo(
    () =>
      group.members.map((member) => ({
        ...member,
        accountName: member.accountName || '',
        accountType: member.accountType || '',
      })),
    [group.members],
  );

  // Memoize sleeve table data transformation to prevent object creation on every render
  const transformedSleeveTableData = useMemo(
    () =>
      sleeveTableData.map((sleeve) => ({
        ...sleeve,
        targetPercent:
          'targetPercent' in sleeve && typeof sleeve.targetPercent === 'number'
            ? sleeve.targetPercent
            : 0,
      })),
    [sleeveTableData],
  );

  // Memoize sleeve allocation data transformation to prevent object creation on every render
  const transformedSleeveAllocationData = useMemo(
    () =>
      sleeveAllocationData.map((account) => ({
        ...account,
        sleeves: account.sleeves.map((sleeve) => ({
          ...sleeve,
          targetPercent:
            'targetPercent' in sleeve && typeof sleeve.targetPercent === 'number'
              ? sleeve.targetPercent
              : 0,
          securities: (sleeve.securities || []).map((security) => ({
            ...security,
            targetPercent: security.targetPercent || 0,
            accountNames: Array.from(security.accountNames || []),
          })),
        })),
      })),
    [sleeveAllocationData],
  );

  // Memoize account holdings data transformation to prevent object creation on every render
  const transformedAccountHoldings = useMemo(
    () =>
      Array.isArray(accountHoldings)
        ? accountHoldings.flatMap((account) =>
            Array.isArray(account.holdings)
              ? account.holdings.map((holding) => ({
                  accountId: account.accountId,
                  ticker: holding.ticker,
                  qty: holding.qty || 0,
                  costBasis: holding.costBasisPerShare || 0,
                  marketValue: holding.marketValue || 0,
                  unrealizedGain: holding.unrealizedGain || 0,
                  isTaxable: account.accountType === 'taxable',
                  purchaseDate: holding.openedAt || new Date(),
                }))
              : [],
          )
        : [],
    [accountHoldings],
  );

  // Memoize rebalance summary trades transformation to prevent object creation on every render
  const summaryTrades = useMemo(
    () =>
      tradeManagement.rebalanceTrades
        .filter((trade) => trade.securityId || trade.ticker)
        .map((trade) => ({
          ...trade,
          securityId: trade.securityId || trade.ticker || '',
        })),
    [tradeManagement.rebalanceTrades],
  );

  // Memoized event handlers to prevent unnecessary re-renders
  const handleManualCashUpdate = useCallback(() => {
    console.log('💰 [GroupComponent] Manual cash update completed, refreshing data...');
    queryInvalidators.rebalancing.groups.detail(queryClient, group.id);
  }, [queryClient, group.id]);

  const handleAccountUpdate = useCallback(() => {
    console.log('🏦 [GroupComponent] Account update completed, refreshing data...');
    queryInvalidators.rebalancing.groups.detail(queryClient, group.id);
  }, [queryClient, group.id]);

  const handlePricesUpdated = useCallback(() => {
    console.log('💹 [GroupComponent] Price update completed, refreshing data...');
    queryInvalidators.rebalancing.groups.detail(queryClient, group.id);
  }, [queryClient, group.id]);

  const handleTickerClick = useCallback(
    (ticker: string) => {
      modalState.openSecurityModal(ticker);
    },
    [modalState],
  );

  const handleSleeveClick = useCallback(
    (sleeveId: string) => {
      modalState.openSleeveModal(sleeveId);
    },
    [modalState],
  );

  const handleSleeveClickByName = useCallback(
    (sleeveName: string) => {
      // Find sleeve ID from sleeve name
      const sleeveData = sleeveMembers?.find((s) => s.sleeveName === sleeveName);
      if (sleeveData) {
        handleSleeveClick(sleeveData.sleeveId);
      }
    },
    [sleeveMembers, handleSleeveClick],
  );

  const handleRebalance = useCallback(() => {
    rebalancingState.setRebalanceModalOpen(true);
  }, [rebalancingState]);

  const handleSort = useCallback(
    (field: SortField) => {
      sortingState.handleSort(field);
    },
    [sortingState],
  );

  const handleTradeQtyChange = useCallback(
    (ticker: string, newQty: number, _isPreview = false) => {
      tradeManagement.handleTradeQtyChange(ticker, newQty, sleeveTableData);
    },
    [tradeManagement, sleeveTableData],
  );

  const handleToggleExpandAll = useCallback(() => {
    expansionState.toggleExpandAll(groupingMode, sleeveTableData, sleeveAllocationData);
  }, [expansionState, groupingMode, sleeveTableData, sleeveAllocationData]);

  const handleEditModalClose = useCallback(() => {
    modalState.closeEditModal();
    console.log('✏️ [GroupComponent] Group edit completed, refreshing data...');
    queryInvalidators.rebalancing.groups.detail(queryClient, group.id);
  }, [modalState, queryClient, group.id]);

  const handleDeleteModalClose = useCallback(() => {
    modalState.closeDeleteModal();
    router.navigate({ to: '/rebalancing-groups' });
  }, [modalState, router]);

  const handleGenerateTrades = useCallback(
    async (method: RebalanceMethod, cashAmount?: number, fetchPricesSelected?: boolean) => {
      try {
        // Prevent concurrent operations by checking if any mutation is currently running
        if (isAnyMutationRunning) {
          console.warn(
            '⚠️ [GroupComponent] Skipping rebalance generation - another operation is in progress',
          );
          return;
        }

        // If price sync is requested, ensure it completes before rebalancing
        if (fetchPricesSelected) {
          // Check current sync status at execution time to avoid race conditions
          if (syncPricesMutation.isPending) {
            console.log('🔄 [GroupComponent] Waiting for existing price sync to complete...');
            await syncPricesMutation.mutateAsync([]);
          } else {
            // Trigger new price sync
            console.log('🔄 [GroupComponent] Starting price sync before rebalance...');
            await syncPricesMutation.mutateAsync([]);
          }
        }

        // Execute rebalance after price sync (if requested) completes
        console.log('📊 [GroupComponent] Starting rebalance calculation...');
        rebalanceMutation.mutate({ method, cashAmount });
      } catch (error) {
        console.error('❌ [GroupComponent] Error in handleGenerateTrades:', error);
        // Don't proceed with rebalance if price sync failed
      }
    },
    [syncPricesMutation, rebalanceMutation, isAnyMutationRunning],
  );

  const handleFetchPrices = useCallback(() => {
    // Prevent price sync if rebalancing is in progress to avoid data conflicts
    if (rebalanceMutation.isPending) {
      console.warn('⚠️ [GroupComponent] Skipping price sync - rebalance operation in progress');
      return;
    }

    // Collect held tickers and model tickers for this group
    const heldTickers = new Set<string>();
    if (Array.isArray(accountHoldings)) {
      for (const account of accountHoldings) {
        if (Array.isArray(account.holdings)) {
          for (const holding of account.holdings) {
            if (holding?.ticker) heldTickers.add(holding.ticker);
          }
        }
      }
    }

    const modelTickers = new Set<string>();
    if (Array.isArray(sleeveMembers)) {
      for (const sleeve of sleeveMembers) {
        for (const member of sleeve.members || []) {
          if (member?.ticker) modelTickers.add(member.ticker);
        }
      }
    }

    const symbols = Array.from(new Set([...heldTickers, ...modelTickers])).filter(Boolean);
    if (symbols.length > 0) {
      console.log(`🔄 [GroupComponent] Syncing prices for ${symbols.length} symbols...`);
      syncPricesMutation.mutate(symbols);
    } else {
      console.log('ℹ️ [GroupComponent] No symbols to sync');
    }
  }, [accountHoldings, sleeveMembers, syncPricesMutation, rebalanceMutation.isPending]);

  // Price sync and order loading are now handled server-side in the route loader
  // No client-side data fetching needed

  // Simplified effect: Close modal when rebalance completes successfully
  useEffect(() => {
    if (rebalanceMutation.isSuccess) {
      rebalancingState.setRebalanceModalOpen(false);
    }
  }, [rebalanceMutation.isSuccess, rebalancingState]);

  // Handle URL parameter to open rebalance modal
  useEffect(() => {
    if (searchParams.rebalance === 'true') {
      rebalancingState.setRebalanceModalOpen(true);
      // Clean up URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams.rebalance, rebalancingState]);

  // Convert sleeve members data to format expected by SleeveModal
  const getSleeveForModal = (sleeveId: string) => {
    const sleeveData = sleeveMembers?.find((s) => s.sleeveId === sleeveId);
    if (!sleeveData) return null;

    return {
      id: sleeveData.sleeveId,
      name: sleeveData.sleeveName,
      members:
        sleeveData.members?.map((member) => ({
          id: member.id,
          ticker: member.ticker,
          rank: member.rank || 1,
          isActive: member.isActive,
          isLegacy: false, // We don't have this data in our current structure
        })) || [],
      position: null, // We don't have position data in the sleeve members structure
    };
  };

  return (
    <ErrorBoundaryWrapper
      title="Rebalancing Group Error"
      description="Failed to load rebalancing group details. This might be due to a temporary data issue."
    >
      <div className="container mx-auto p-6 space-y-6">
        {/* Breadcrumb and Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <div className="flex flex-col items-start gap-1">
              {group.assignedModel ? (
                <Link
                  to="/models/$modelId"
                  params={{ modelId: group.assignedModel.id }}
                  className="inline-flex"
                >
                  <Badge variant="default" className="cursor-pointer">
                    {group.assignedModel.name}
                  </Badge>
                </Link>
              ) : (
                <Badge variant="outline">No Model</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={modalState.openEditModal}>
              <Edit className="mr-1 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={modalState.openDeleteModal}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Account Summary Section */}
        <AccountSummary
          members={accountSummaryMembers}
          selectedAccount={modalState.selectedAccount}
          totalValue={totalValue}
          onAccountSelect={modalState.setSelectedAccount}
          onManualCashUpdate={handleManualCashUpdate}
          onAccountUpdate={handleAccountUpdate}
        />

        {/* Current vs Target Allocation Table */}
        {group.assignedModel && (
          <div className="relative">
            {/* Loading overlay for rebalancing operations */}
            {(rebalanceMutation.isPending || syncPricesMutation.isPending) && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg border">
                <div className="flex flex-col items-center gap-3 p-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <div className="text-center">
                    <p className="font-medium">
                      {rebalanceMutation.isPending
                        ? 'Rebalancing Portfolio...'
                        : 'Syncing Prices...'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {rebalanceMutation.isPending
                        ? 'Calculating optimal trades based on your target allocation'
                        : 'Fetching latest security prices for accurate calculations'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <SleeveAllocationTable
              sleeveTableData={transformedSleeveTableData}
              expandedSleeves={expansionState.expandedSleeves}
              expandedAccounts={expansionState.expandedAccounts}
              groupMembers={sleeveTableGroupMembers}
              sleeveAllocationData={transformedSleeveAllocationData}
              groupingMode={groupingMode}
              onGroupingModeChange={setGroupingMode}
              onSleeveExpansionToggle={expansionState.toggleSleeveExpansion}
              onAccountExpansionToggle={expansionState.toggleAccountExpansion}
              onTickerClick={handleTickerClick}
              onSleeveClick={handleSleeveClick}
              onRebalance={handleRebalance}
              onToggleExpandAll={handleToggleExpandAll}
              isAllExpanded={expansionState.isAllExpanded}
              trades={tradeManagement.rebalanceTrades}
              sortField={sortingState.sortField}
              sortDirection={sortingState.sortDirection}
              onSort={handleSort}
              onTradeQtyChange={handleTradeQtyChange}
              accountHoldings={transformedAccountHoldings}
              renderSummaryCards={() => (
                <RebalanceSummaryCards
                  trades={summaryTrades}
                  sleeveTableData={sleeveTableData}
                  group={group}
                  accountHoldings={transformedAccountHoldings}
                />
              )}
              groupId={group.id}
              isRebalancing={rebalanceMutation.isPending || isAnyMutationRunning}
            />
          </div>
        )}

        <MemoizedOrdersBlotter
          groupId={group.id}
          accountHoldings={accountHoldings}
          sp500Data={sp500Data}
          groupMembers={group.members}
          onPricesUpdated={handlePricesUpdated}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Portfolio Allocation Chart */}
          <LazyAllocationChart
            allocationData={filteredAllocationData}
            allocationView={allocationView}
            onAllocationViewChange={setAllocationView}
            onSleeveClick={handleSleeveClickByName}
          />

          {/* Top Holdings */}
          <TopHoldings holdingsData={holdingsData} onTickerClick={handleTickerClick} />
        </div>

        {/* Modals */}
        <EditRebalancingGroupModal
          group={group}
          open={modalState.editModalOpen}
          onOpenChange={modalState.setEditModalOpen}
          onClose={handleEditModalClose}
        />

        <DeleteRebalancingGroupModal
          group={group}
          open={modalState.deleteModalOpen}
          onOpenChange={modalState.setDeleteModalOpen}
          onClose={handleDeleteModalClose}
        />

        <SecurityModal
          isOpen={modalState.showSecurityModal}
          onClose={modalState.closeSecurityModal}
          ticker={modalState.selectedTicker}
          sp500Data={sp500Data}
          positions={positions}
          transactions={transactions}
          proposedTrades={proposedTrades}
        />

        <SleeveModal
          isOpen={modalState.showSleeveModal}
          onClose={modalState.closeSleeveModal}
          sleeve={modalState.selectedSleeve ? getSleeveForModal(modalState.selectedSleeve) : null}
        />

        <RebalanceModal
          open={rebalancingState.rebalanceModalOpen}
          onOpenChange={rebalancingState.setRebalanceModalOpen}
          onGenerateTrades={handleGenerateTrades}
          onFetchPrices={handleFetchPrices}
          isLoading={rebalanceMutation.isPending}
          availableCash={availableCash}
          isSyncing={syncPricesMutation.isPending}
          syncMessage={
            syncPricesMutation.isPending
              ? 'Fetching updated security prices. Once completed, the rebalance will begin automatically.'
              : undefined
          }
        />
      </div>
    </ErrorBoundaryWrapper>
  );
}
