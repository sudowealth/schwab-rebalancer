import React from 'react';
import type {
  Position,
  RebalancingGroup,
  Trade as SchemaTrade,
  SP500Stock,
  Transaction,
} from '~/features/auth/schemas';
import type { useGroupModals } from '../hooks/use-group-modals';
import { OrdersBlotter } from './blotter/orders-blotter';
import { GroupAccountSummarySection } from './group-account-summary-section';
import { GroupChartsSection } from './group-charts-section';
import { GroupHeader } from './group-header';
import { GroupModals } from './group-modals';
import { SleeveAllocationTable } from './sleeve-allocation/sleeve-allocation-table';
import type { SortDirection, SortField } from './sleeve-allocation/sleeve-allocation-table-headers';
import type {
  AccountHolding,
  GroupMember,
  SleeveAllocationData,
  Trade as SleeveAllocationTrade,
  SleeveTableData,
} from './sleeve-allocation/sleeve-allocation-types';

interface GroupContentLayoutProps {
  // Group data
  group: RebalancingGroup;

  // State
  allocationView: 'account' | 'sector' | 'industry' | 'sleeve';
  groupingMode: 'sleeve' | 'account';
  expandedSleeves: Set<string>;
  expandedAccounts: Set<string>;
  selectedAccount: string | null;

  // Data
  accountSummaryMembers: Array<{
    id: string;
    accountId: string;
    balance: number;
    accountName?: string;
    accountType?: string;
    accountNumber?: string;
  }>;
  transformedSleeveTableData: SleeveTableData[];
  transformedSleeveAllocationData: SleeveAllocationData[];
  transformedAccountHoldings: AccountHolding[];
  filteredAllocationData: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  sleeveTableGroupMembers: GroupMember[];
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
  sp500Data: SP500Stock[];
  holdingsData: Array<{
    ticker: string;
    value: number;
    percentage: number;
  }>;
  positions?: Position[];
  transactions?: Transaction[];
  proposedTrades?: SchemaTrade[];

  // UI state
  isAllExpanded: boolean;
  trades: SleeveAllocationTrade[];
  sortField: SortField | undefined;
  sortDirection: SortDirection;
  isRebalancing: boolean;
  isSyncingPrices: boolean;

  // Event handlers
  onEditClick: () => void;
  onDeleteClick: () => void;
  onAllocationViewChange: (view: 'account' | 'sector' | 'industry' | 'sleeve') => void;
  onAccountSelect: (accountId: string | null) => void;
  onManualCashUpdate: () => void;
  onAccountUpdate: () => void;
  onGroupingModeChange: (mode: 'sleeve' | 'account') => void;
  onSleeveExpansionToggle: (sleeveId: string) => void;
  onAccountExpansionToggle: (accountId: string) => void;
  onTickerClick: (ticker: string) => void;
  onSleeveClick: (sleeveId: string) => void;
  onSleeveClickByName: (sleeveName: string) => void;
  onRebalance: () => void;
  onToggleExpandAll: () => void;
  onSort: (field: SortField) => void;
  onTradeQtyChange: (ticker: string, qty: number, isPreview?: boolean) => void;
  onPricesUpdated: () => void;
  renderSummaryCards: () => React.ReactNode;

  // Modal system
  modals: ReturnType<typeof useGroupModals>;
}

export const GroupContentLayout = React.memo(function GroupContentLayout({
  group,
  allocationView,
  groupingMode,
  expandedSleeves,
  expandedAccounts,
  selectedAccount,
  accountSummaryMembers,
  transformedSleeveTableData,
  transformedSleeveAllocationData,
  transformedAccountHoldings,
  filteredAllocationData,
  sleeveTableGroupMembers,
  accountHoldings,
  sp500Data,
  holdingsData,
  positions,
  transactions,
  proposedTrades,
  isAllExpanded,
  trades,
  sortField,
  sortDirection,
  isRebalancing,
  isSyncingPrices,
  onEditClick,
  onDeleteClick,
  onAllocationViewChange,
  onAccountSelect,
  onManualCashUpdate,
  onAccountUpdate,
  onGroupingModeChange,
  onSleeveExpansionToggle,
  onAccountExpansionToggle,
  onTickerClick,
  onSleeveClick,
  onSleeveClickByName,
  onRebalance,
  onToggleExpandAll,
  onSort,
  onTradeQtyChange,
  onPricesUpdated,
  renderSummaryCards,
  modals,
}: GroupContentLayoutProps) {
  const totalValue = group.members.reduce((sum: number, member) => sum + (member.balance || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <GroupHeader
        group={group as RebalancingGroup}
        onEdit={onEditClick}
        onDelete={onDeleteClick}
      />

      {/* Account Summary Section */}
      <GroupAccountSummarySection
        members={accountSummaryMembers}
        selectedAccount={selectedAccount}
        totalValue={totalValue}
        onAccountSelect={onAccountSelect}
        onManualCashUpdate={onManualCashUpdate}
        onAccountUpdate={onAccountUpdate}
      />

      {/* Current vs Target Allocation Table */}
      {group.assignedModel && (
        <div className="relative">
          {/* Loading overlay for rebalancing operations */}
          {(isRebalancing || isSyncingPrices) && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg border">
              <div className="flex flex-col items-center gap-3 p-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <div className="text-center">
                  <p className="font-medium">
                    {isRebalancing ? 'Rebalancing Portfolio...' : 'Syncing Prices...'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isRebalancing
                      ? 'Calculating optimal trades based on your target allocation'
                      : 'Fetching latest security prices for accurate calculations'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }
          >
            <SleeveAllocationTable
              sleeveTableData={transformedSleeveTableData}
              expandedSleeves={expandedSleeves}
              expandedAccounts={expandedAccounts}
              groupMembers={sleeveTableGroupMembers}
              sleeveAllocationData={transformedSleeveAllocationData}
              groupingMode={groupingMode}
              onGroupingModeChange={onGroupingModeChange}
              onSleeveExpansionToggle={onSleeveExpansionToggle}
              onAccountExpansionToggle={onAccountExpansionToggle}
              onTickerClick={onTickerClick}
              onSleeveClick={onSleeveClick}
              onRebalance={onRebalance}
              onToggleExpandAll={onToggleExpandAll}
              isAllExpanded={isAllExpanded}
              trades={trades}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
              onTradeQtyChange={onTradeQtyChange}
              accountHoldings={transformedAccountHoldings}
              renderSummaryCards={renderSummaryCards}
              groupId={group.id}
              isRebalancing={isRebalancing}
            />
          </React.Suspense>
        </div>
      )}

      {/* Orders Blotter */}
      <MemoizedOrdersBlotter
        groupId={group.id}
        accountHoldings={accountHoldings}
        sp500Data={sp500Data}
        groupMembers={accountSummaryMembers}
        onPricesUpdated={onPricesUpdated}
      />

      {/* Charts & Analytics Section */}
      <GroupChartsSection
        allocationData={filteredAllocationData}
        allocationView={allocationView}
        onAllocationViewChange={onAllocationViewChange}
        onSleeveClick={onSleeveClickByName}
        onTickerClick={onTickerClick}
        holdingsData={holdingsData}
      />

      {/* Modals */}
      <GroupModals
        group={group}
        sp500Data={sp500Data}
        positions={positions}
        transactions={transactions}
        proposedTrades={proposedTrades}
        modals={modals}
      />
    </div>
  );
});

GroupContentLayout.displayName = 'GroupContentLayout';

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
  sp500Data: SP500Stock[];
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
  const prices = React.useMemo(() => {
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
  const accounts = React.useMemo(() => {
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

MemoizedOrdersBlotter.displayName = 'MemoizedOrdersBlotter';
