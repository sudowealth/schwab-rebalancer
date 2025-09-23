import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { RebalancingErrorBoundary } from '~/components/RouteErrorBoundaries';
import { GroupContentLayout } from '~/features/rebalancing/components/group-content-layout';
import { RebalanceModal } from '~/features/rebalancing/components/rebalance-modal';
import { RebalanceSummaryCards } from '~/features/rebalancing/components/rebalance-summary-cards';
import type { SortField } from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-table-headers';
import { useExpansionState } from '~/features/rebalancing/hooks/use-expansion-state';
import { useGroupModals } from '~/features/rebalancing/hooks/use-group-modals';
import { useGroupMutations } from '~/features/rebalancing/hooks/use-group-mutations';
import { useRebalancingState } from '~/features/rebalancing/hooks/use-rebalancing-state';
import {
  useAccountSummaryMembers,
  useAvailableCash,
  useFilteredAllocationData,
  useSleeveTableGroupMembers,
  useSummaryTrades,
  useTransformedAccountHoldings,
  useTransformedSleeveAllocationData,
  useTransformedSleeveTableData,
} from '~/features/rebalancing/hooks/use-sleeve-allocations';
import { useSortingState } from '~/features/rebalancing/hooks/use-sorting-state';
import { useTradeManagement } from '~/features/rebalancing/hooks/use-trade-management';
import { queryInvalidators } from '~/lib/query-keys';
import { authGuard } from '~/lib/route-guards';
import { getRebalancingGroupDataServerFn } from '~/lib/server-functions';

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
    const result = await getRebalancingGroupDataServerFn({ data: { groupId: params.groupId } });
    // The server function now includes sleeveTableData and sleeveAllocationData
    return result as any;
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
    sleeveTableData,
    sleeveAllocationData,
  } = Route.useLoaderData();
  const searchParams = Route.useSearch();

  // Basic state for UI controls
  const [allocationView, setAllocationView] = useState<
    'account' | 'sector' | 'industry' | 'sleeve'
  >('sleeve');
  const [groupingMode, setGroupingMode] = useState<'sleeve' | 'account'>('sleeve');

  // Custom hooks for state management
  const expansionState = useExpansionState();
  const sortingState = useSortingState();
  const tradeManagement = useTradeManagement(group.members);
  const rebalancingState = useRebalancingState();

  // Group-specific hooks
  const groupModals = useGroupModals(group.id, sleeveMembers);
  const groupMutations = useGroupMutations({
    groupId: group.id,
    accountHoldings,
    sleeveMembers,
  });

  // Data processing hooks
  const _totalValue = useMemo(
    () =>
      group.members.reduce(
        (sum: number, member: { balance?: number }) => sum + (member.balance || 0),
        0,
      ),
    [group.members],
  );

  // Data is now calculated server-side - no client-side calculations needed
  const availableCash = useAvailableCash(sleeveTableData);
  const transformedSleeveTableData = useTransformedSleeveTableData(sleeveTableData);
  const transformedSleeveAllocationData = useTransformedSleeveAllocationData(sleeveAllocationData);
  const transformedAccountHoldings = useTransformedAccountHoldings(accountHoldings);
  const filteredAllocationData = useFilteredAllocationData(allocationData);
  const accountSummaryMembers = useAccountSummaryMembers(group.members);
  const sleeveTableGroupMembers = useSleeveTableGroupMembers(group.members);
  const summaryTrades = useSummaryTrades(tradeManagement.rebalanceTrades);

  const queryClient = useQueryClient();

  // Event handlers
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
      groupModals.openSecurityModal(ticker);
    },
    [groupModals],
  );

  const handleSleeveClick = useCallback(
    (sleeveId: string) => {
      groupModals.openSleeveModal(sleeveId);
    },
    [groupModals],
  );

  const handleSleeveClickByName = useCallback(
    (sleeveName: string) => {
      const sleeveData = sleeveMembers?.find(
        (s: { sleeveName: string; sleeveId: string }) => s.sleeveName === sleeveName,
      );
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

  // Effects
  useEffect(() => {
    if (groupMutations.rebalanceMutation.isSuccess) {
      rebalancingState.setRebalanceModalOpen(false);
    }
  }, [groupMutations.rebalanceMutation.isSuccess, rebalancingState]);

  useEffect(() => {
    if (searchParams.rebalance === 'true') {
      rebalancingState.setRebalanceModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams.rebalance, rebalancingState]);

  // Update trade data when rebalance completes
  useEffect(() => {
    if (groupMutations.rebalanceMutation.data?.trades) {
      tradeManagement.setTrades(groupMutations.rebalanceMutation.data.trades);
    }
  }, [groupMutations.rebalanceMutation.data?.trades, tradeManagement]);

  return (
    <ErrorBoundaryWrapper
      title="Rebalancing Group Error"
      description="Failed to load rebalancing group details. This might be due to a temporary data issue."
    >
      <GroupContentLayout
        // Group data
        group={group}
        accountHoldings={accountHoldings}
        sp500Data={sp500Data}
        positions={positions}
        transactions={transactions}
        proposedTrades={proposedTrades}
        holdingsData={holdingsData}
        // State
        allocationView={allocationView}
        groupingMode={groupingMode}
        expandedSleeves={expansionState.expandedSleeves}
        expandedAccounts={expansionState.expandedAccounts}
        selectedAccount={groupModals.selectedAccount}
        // Processed data
        accountSummaryMembers={accountSummaryMembers}
        transformedSleeveTableData={transformedSleeveTableData}
        transformedSleeveAllocationData={transformedSleeveAllocationData}
        transformedAccountHoldings={transformedAccountHoldings}
        filteredAllocationData={filteredAllocationData}
        sleeveTableGroupMembers={sleeveTableGroupMembers}
        // UI state
        isAllExpanded={expansionState.isAllExpanded}
        trades={tradeManagement.rebalanceTrades}
        sortField={sortingState.sortField}
        sortDirection={sortingState.sortDirection}
        isRebalancing={groupMutations.rebalanceMutation.isPending}
        isSyncingPrices={groupMutations.syncPricesMutation.isPending}
        // Event handlers
        onEditClick={groupModals.openEditModal}
        onDeleteClick={groupModals.openDeleteModal}
        onAllocationViewChange={setAllocationView}
        onAccountSelect={groupModals.setSelectedAccount}
        onManualCashUpdate={handleManualCashUpdate}
        onAccountUpdate={handleAccountUpdate}
        onGroupingModeChange={setGroupingMode}
        onSleeveExpansionToggle={expansionState.toggleSleeveExpansion}
        onAccountExpansionToggle={expansionState.toggleAccountExpansion}
        onTickerClick={handleTickerClick}
        onSleeveClick={handleSleeveClick}
        onSleeveClickByName={handleSleeveClickByName}
        onRebalance={handleRebalance}
        onToggleExpandAll={handleToggleExpandAll}
        onSort={handleSort}
        onTradeQtyChange={handleTradeQtyChange}
        onPricesUpdated={handlePricesUpdated}
        renderSummaryCards={() => (
          <RebalanceSummaryCards
            trades={summaryTrades}
            sleeveTableData={sleeveTableData}
            group={group}
            accountHoldings={transformedAccountHoldings}
          />
        )}
        // Modal system
        modals={groupModals}
      />

      {/* Rebalance Modal - separate from GroupContentLayout for better organization */}
      <RebalanceModal
        open={rebalancingState.rebalanceModalOpen}
        onOpenChange={rebalancingState.setRebalanceModalOpen}
        onGenerateTrades={groupMutations.handleGenerateTrades}
        onFetchPrices={groupMutations.handleFetchPrices}
        isLoading={groupMutations.rebalanceMutation.isPending}
        availableCash={availableCash}
        isSyncing={groupMutations.syncPricesMutation.isPending}
        syncMessage={
          groupMutations.syncPricesMutation.isPending
            ? 'Fetching updated security prices. Once completed, the rebalance will begin automatically.'
            : undefined
        }
      />
    </ErrorBoundaryWrapper>
  );
}
