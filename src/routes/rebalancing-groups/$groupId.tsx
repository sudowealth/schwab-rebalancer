import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { Edit, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { RebalancingErrorBoundary } from '~/components/RouteErrorBoundaries';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import type { Order } from '~/features/auth/schemas';
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
import { useSleeveAllocations } from '~/features/rebalancing/hooks/use-sleeve-allocations';
import { useSortingState } from '~/features/rebalancing/hooks/use-sorting-state';
import { useTradeManagement } from '~/features/rebalancing/hooks/use-trade-management';
import { authGuard } from '~/lib/route-guards';
import {
  getGroupOrdersServerFn,
  getRebalancingGroupDataServerFn,
  rebalancePortfolioServerFn,
  syncGroupPricesIfNeededServerFn,
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
  const [, setOrdersCountByBucket] = useState<{
    draft: number;
    pending: number;
    open: number;
    done: number;
    failed: number;
  } | null>(null);

  // Custom hooks for state management
  const expansionState = useExpansionState();
  const modalState = useModalState();
  const sortingState = useSortingState();
  const tradeManagement = useTradeManagement(group.members);
  const rebalancingState = useRebalancingState();

  // Mutations for server operations - optimized with proper cleanup and retry logic
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
      tradeManagement.setTrades(result.trades);
      rebalancingState.setRebalanceLoading(false);
    },
    onError: (error) => {
      console.error('Error generating trades:', error);
      rebalancingState.setRebalanceLoading(false);
    },
    onSettled: () => {
      rebalancingState.setRebalanceLoading(false);
    },
    retry: false, // Rebalance operations shouldn't be retried automatically
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const syncPricesMutation = useMutation({
    mutationFn: async (symbols: string[]) => syncSchwabPricesServerFn({ data: { symbols } }),
    onSuccess: () => {
      console.log('🔄 [GroupComponent] Manual price sync completed, updating UI...');
      router.invalidate(); // Manual sync should update UI immediately
      rebalancingState.setSyncingPrices(false);
    },
    onError: (error) => {
      console.error('Error syncing prices:', error);
      rebalancingState.setSyncingPrices(false);
    },
    onSettled: () => {
      rebalancingState.setSyncingPrices(false);
    },
    retry: (failureCount, error) => {
      // Retry up to 2 times for network-related errors, but not for auth errors
      return failureCount < 2 && !error?.message?.includes('unauthorized');
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    gcTime: 10 * 60 * 1000, // Keep price sync results in cache for 10 minutes
  });

  const syncGroupPricesMutation = useMutation({
    mutationFn: async (groupId: string) => syncGroupPricesIfNeededServerFn({ data: { groupId } }),
    onSuccess: (result) => {
      if (result.synced && result.updatedCount && result.updatedCount > 0) {
        console.log('🔄 [GroupComponent] Prices updated automatically');
        // Note: Removed router.invalidate() to prevent sync loops.
        // Prices will be reflected on next manual refresh or navigation.
      }
    },
    onError: (error) => {
      console.warn('⚠️ [GroupComponent] Automatic price sync failed:', error);
    },
    retry: false, // Don't retry automatic background sync - keep it lightweight
    gcTime: 30 * 60 * 1000, // Keep automatic sync results in cache for 30 minutes
  });

  const getGroupOrdersMutation = useMutation({
    mutationFn: async (groupId: string) => getGroupOrdersServerFn({ data: { groupId } }),
    onSuccess: (orders) => {
      // Simple bucketing by status text
      const statusOf = (s: string | undefined) => (s || 'DRAFT').toUpperCase();
      const counts = { draft: 0, pending: 0, open: 0, done: 0, failed: 0 };
      for (const o of orders as Order[]) {
        const st = statusOf(o.status);
        if (st === 'DRAFT') counts.draft++;
        else if (st.startsWith('PREVIEW_')) counts.pending++;
        else if (['ACCEPTED', 'WORKING', 'PARTIALLY_FILLED', 'REPLACED'].includes(st))
          counts.open++;
        else if (['FILLED', 'CANCELED'].includes(st)) counts.done++;
        else if (['REJECTED', 'EXPIRED'].includes(st)) counts.failed++;
      }
      setOrdersCountByBucket(counts);
    },
    onError: (error) => {
      console.error('Error loading orders:', error);
    },
    retry: 1, // Retry once for order status loading
    retryDelay: 1000, // Wait 1 second before retry
    gcTime: 2 * 60 * 1000, // Keep order counts in cache for 2 minutes
  });

  // Memoize total portfolio value calculation
  const totalValue = useMemo(
    () => group.members.reduce((sum: number, member) => sum + (member.balance || 0), 0),
    [group.members],
  );

  // Memoize group data for sleeve allocations
  const sleeveAllocationsGroupData = useMemo(
    () => ({
      ...group,
      members: group.members.map((member) => ({
        ...member,
        accountName: member.accountName || '',
        balance: member.balance || 0,
      })),
    }),
    [group],
  );

  // Use custom hook for sleeve allocations
  const { sleeveTableData, sleeveAllocationData } = useSleeveAllocations(
    sleeveAllocationsGroupData,
    accountHoldings,
    sleeveMembers,
    transactions,
    'all',
    totalValue,
  );

  // Memoize available cash calculation
  const availableCash = useMemo(() => {
    const sleeveData = sleeveTableData.find((sleeve) => sleeve.sleeveId === 'cash');
    return sleeveData?.currentValue || 0;
  }, [sleeveTableData]);

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

  // Memoized event handlers to prevent unnecessary re-renders
  const handleManualCashUpdate = useCallback(() => {
    router.invalidate();
  }, [router]);

  const handleAccountUpdate = useCallback(() => {
    router.invalidate();
  }, [router]);

  const handlePricesUpdated = useCallback(() => {
    router.invalidate();
  }, [router]);

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
    router.invalidate();
  }, [modalState, router]);

  const handleDeleteModalClose = useCallback(() => {
    modalState.closeDeleteModal();
    router.navigate({ to: '/rebalancing-groups' });
  }, [modalState, router]);

  const handleGenerateTrades = useCallback(
    async (method: RebalanceMethod, cashAmount?: number, fetchPricesSelected?: boolean) => {
      if (fetchPricesSelected && rebalancingState.syncingPrices) {
        // Queue the rebalance until sync completes
        rebalancingState.setWaitingForSync(true);
        rebalancingState.setPendingMethod(method);
        rebalancingState.setPendingCashAmount(cashAmount);
        return;
      }

      rebalancingState.setRebalanceLoading(true);
      rebalanceMutation.mutate({ method, cashAmount });
    },
    [rebalancingState.syncingPrices, rebalancingState, rebalanceMutation],
  );

  const handleFetchPrices = useCallback(() => {
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
      rebalancingState.setSyncingPrices(true);
      syncPricesMutation.mutate(symbols);
    }
  }, [accountHoldings, sleeveMembers, rebalancingState, syncPricesMutation]);

  // Trigger automatic price sync when component mounts (if user is connected to Schwab)
  // Only run once per component lifecycle to prevent endless sync loops
  const hasSyncedPricesRef = useRef(false);
  useEffect(() => {
    if (!hasSyncedPricesRef.current) {
      hasSyncedPricesRef.current = true;
      syncGroupPricesMutation.mutate(group.id);
    }
  }, [group.id, syncGroupPricesMutation]);

  // Load group orders summary (counts) after mount and when trades change
  // No cleanup needed: mutations handle their own lifecycle and cleanup
  useEffect(() => {
    getGroupOrdersMutation.mutate(group.id);
  }, [group.id, getGroupOrdersMutation]);

  // If a rebalance was queued and sync finished, run it and close modal
  // No cleanup needed: async operation completes naturally, mutations handle cleanup
  useEffect(() => {
    if (
      !rebalancingState.syncingPrices &&
      rebalancingState.waitingForSync &&
      rebalancingState.pendingMethod
    ) {
      (async () => {
        if (rebalancingState.pendingMethod) {
          await handleGenerateTrades(
            rebalancingState.pendingMethod,
            rebalancingState.pendingCashAmount,
            false,
          );
        }
        rebalancingState.setWaitingForSync(false);
        rebalancingState.setPendingMethod(null);
        rebalancingState.setPendingCashAmount(undefined);
        rebalancingState.setRebalanceModalOpen(false);
      })();
    }
  }, [
    rebalancingState.syncingPrices,
    rebalancingState.waitingForSync,
    rebalancingState.pendingMethod,
    rebalancingState.pendingCashAmount,
    handleGenerateTrades,
    rebalancingState,
  ]);

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
          members={group.members.map((member) => ({
            id: member.id,
            accountId: member.accountId,
            accountName: member.accountName || '',
            accountType: member.accountType || '',
            accountNumber: (member as { accountNumber?: string }).accountNumber,
            balance: member.balance || 0,
          }))}
          selectedAccount={modalState.selectedAccount}
          totalValue={totalValue}
          onAccountSelect={modalState.setSelectedAccount}
          onManualCashUpdate={handleManualCashUpdate}
          onAccountUpdate={handleAccountUpdate}
        />

        {/* Current vs Target Allocation Table */}
        {group.assignedModel && (
          <SleeveAllocationTable
            sleeveTableData={sleeveTableData.map((sleeve) => ({
              ...sleeve,
              targetPercent:
                'targetPercent' in sleeve && typeof sleeve.targetPercent === 'number'
                  ? sleeve.targetPercent
                  : 0,
            }))}
            expandedSleeves={expansionState.expandedSleeves}
            expandedAccounts={expansionState.expandedAccounts}
            groupMembers={group.members.map((member) => ({
              ...member,
              accountName: member.accountName || '',
              accountType: member.accountType || '',
            }))}
            sleeveAllocationData={sleeveAllocationData.map((account) => ({
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
            }))}
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
            accountHoldings={
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
                : []
            }
            renderSummaryCards={() => (
              <RebalanceSummaryCards
                trades={tradeManagement.rebalanceTrades
                  .filter((trade) => trade.securityId || trade.ticker)
                  .map((trade) => ({
                    ...trade,
                    securityId: trade.securityId || trade.ticker || '',
                  }))}
                sleeveTableData={sleeveTableData}
                group={group}
                accountHoldings={
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
                    : []
                }
              />
            )}
            groupId={group.id}
            isRebalancing={rebalancingState.rebalanceLoading}
          />
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
          isLoading={rebalancingState.rebalanceLoading}
          availableCash={availableCash}
          isSyncing={rebalancingState.syncingPrices}
          syncMessage={
            rebalancingState.waitingForSync && rebalancingState.syncingPrices
              ? 'Fetching updated security prices. Once completed, the rebalance will begin automatically.'
              : undefined
          }
        />
      </div>
    </ErrorBoundaryWrapper>
  );
}
