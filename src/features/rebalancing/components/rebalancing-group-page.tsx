import { Suspense } from 'react';
import { OrdersBlotter } from './blotter/orders-blotter';
import { GroupAccountSummarySection } from './group-account-summary-section';
import { GroupChartsSection } from './group-charts-section';
import { GroupHeader } from './group-header';
import { RebalanceModal } from './rebalance-modal';
import { RebalanceSummaryCards } from './rebalance-summary-cards';
import {
  AccountSummaryErrorBoundary,
  ChartsErrorBoundary,
  SleeveAllocationErrorBoundary,
} from './rebalancing-error-boundary';
import { useRebalancingGroup } from './rebalancing-group-context';
import { SleeveAllocationTable } from './sleeve-allocation/sleeve-allocation-table';

export function RebalancingGroupPage() {
  const {
    data,
    ui,
    availableCash,
    isRebalancing,
    isSyncingPrices,
    setAllocationView,
    setGroupingMode,
    toggleSleeveExpansion,
    toggleAccountExpansion,
    toggleExpandAll,
    setSelectedAccount,
    setSort,
    handleTradeQtyChange,
    openSecurityModal,
    openSleeveModal,
    setRebalanceModal,
    handleRebalance,
    handlePriceSync,
    openEditModal,
    openDeleteModal,
    trades,
  } = useRebalancingGroup();

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { group, allocationData, holdingsData } = data;

  // Calculate total value
  const totalValue = group.members.reduce((sum: number, member) => sum + (member.balance || 0), 0);

  // Transform data for components (server data structures don't exactly match component expectations)
  const transformedSleeveTableData = (data.sleeveTableData || []).map((item: any) => ({
    ...item,
    securities: item.securities.map((sec: any) => ({
      ...sec,
      isHeld: true, // Assume held for now - would need proper logic
      accountNames: sec.accountNames || [],
    })),
  })) as any; // Type mismatch requires transformation

  const transformedSleeveAllocationData = (data.sleeveAllocationData || []).map((account: any) => ({
    ...account,
    sleeves: account.sleeves.map((sleeve: any) => ({
      ...sleeve,
      securities: sleeve.securities.map((sec: any) => ({
        ...sec,
        isHeld: true,
        accountNames: sec.accountNames || [],
      })),
    })),
  })) as any; // Type mismatch requires transformation
  const transformedAccountHoldings = (data.accountHoldings || []).flatMap((account: any) =>
    account.holdings.map((holding: any) => ({
      accountId: account.accountId,
      ticker: holding.ticker,
      qty: holding.qty,
      costBasis: holding.costBasis,
      marketValue: holding.marketValue,
      unrealizedGain: holding.unrealizedGainLoss || 0,
      isTaxable: account.accountType === 'taxable',
      purchaseDate: holding.purchaseDate || new Date(),
    })),
  ) as any; // Simplified transformation

  const filteredAllocationData = allocationData || [];
  // Create account lookup map from accountHoldings for account numbers
  const accountLookup = (data.accountHoldings || []).reduce(
    (acc: Record<string, { name: string; number: string }>, account: any) => {
      acc[account.accountId] = {
        name: account.accountName,
        number: account.accountNumber,
      };
      return acc;
    },
    {},
  );

  const accountSummaryMembers = group.members.map((member: any) => {
    const accountInfo = accountLookup[member.accountId];
    return {
      id: member.id,
      accountId: member.accountId,
      isActive: true, // Assume active
      balance: member.balance,
      accountName: member.accountName,
      accountNumber: accountInfo?.number || '', // Get account number from accountHoldings
      accountType: member.accountType,
    };
  }) as any; // Type mismatch

  const sleeveTableGroupMembers = accountSummaryMembers;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Group Header */}
      <GroupHeader
        // biome-ignore lint/suspicious/noExplicitAny: Type mismatch until proper RebalancingGroup interface is created to match server data
        group={group as any}
        onEdit={openEditModal}
        onDelete={openDeleteModal}
      />

      {/* Account Summary Section */}
      <AccountSummaryErrorBoundary>
        <GroupAccountSummarySection
          members={accountSummaryMembers}
          selectedAccount={ui.selectedAccount}
          totalValue={totalValue}
          onAccountSelect={setSelectedAccount}
          onManualCashUpdate={() => console.log('Manual cash update')} // Would need proper handler
          onAccountUpdate={() => console.log('Account update')} // Would need proper handler
        />
      </AccountSummaryErrorBoundary>

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

          <SleeveAllocationErrorBoundary>
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }
            >
              <SleeveAllocationTable
                sleeveTableData={transformedSleeveTableData}
                expandedSleeves={ui.expandedSleeves}
                expandedAccounts={ui.expandedAccounts}
                groupMembers={sleeveTableGroupMembers}
                sleeveAllocationData={transformedSleeveAllocationData}
                groupingMode={ui.groupingMode}
                onGroupingModeChange={setGroupingMode}
                onSleeveExpansionToggle={toggleSleeveExpansion}
                onAccountExpansionToggle={toggleAccountExpansion}
                onTickerClick={openSecurityModal}
                onSleeveClick={openSleeveModal}
                onRebalance={() => setRebalanceModal(true)}
                onToggleExpandAll={toggleExpandAll}
                isAllExpanded={ui.isAllExpanded}
                trades={trades}
                sortField={ui.sortField}
                sortDirection={ui.sortDirection}
                onSort={setSort}
                onTradeQtyChange={handleTradeQtyChange}
                accountHoldings={transformedAccountHoldings}
                renderSummaryCards={() => (
                  <RebalanceSummaryCards
                    trades={trades
                      .filter((trade) => trade.securityId)
                      .map((trade) => ({
                        ...trade,
                        ticker: trade.securityId, // Map securityId to ticker for compatibility
                      }))}
                    sleeveTableData={transformedSleeveTableData}
                    group={{
                      ...group,
                      members: group.members.map((member: any) => ({
                        ...member,
                        balance: member.balance || 0,
                      })),
                      assignedModel: group.assignedModel || undefined, // Handle nullable assignedModel
                    }}
                    accountHoldings={transformedAccountHoldings}
                  />
                )}
                groupId={group.id}
                isRebalancing={isRebalancing}
              />
            </Suspense>
          </SleeveAllocationErrorBoundary>
        </div>
      )}

      {/* Orders Blotter */}
      <OrdersBlotter
        groupId={group.id}
        accounts={accountSummaryMembers.reduce(
          (acc: Record<string, { name: string; number?: string | null }>, member: any) => {
            acc[member.accountId] = {
              name: member.accountName,
              number: member.accountNumber || null,
            };
            return acc;
          },
          {},
        )}
        onPricesUpdated={() => handlePriceSync()}
      />

      {/* Charts & Analytics Section */}
      <ChartsErrorBoundary>
        <GroupChartsSection
          allocationData={filteredAllocationData}
          allocationView={ui.allocationView}
          onAllocationViewChange={setAllocationView}
          onSleeveClick={openSleeveModal}
          onTickerClick={openSecurityModal}
          holdingsData={holdingsData}
        />
      </ChartsErrorBoundary>

      {/* Modals - handled by individual modal components */}
      {/* GroupModals would need proper modal state from useGroupModals hook */}
      {/* For now, modal functionality is handled by individual components */}

      {/* Rebalance Modal */}
      <RebalanceModal
        open={ui.rebalanceModalOpen}
        onOpenChange={setRebalanceModal}
        onGenerateTrades={async () => {
          await handleRebalance('allocation');
        }}
        onFetchPrices={() => {
          handlePriceSync().catch(console.error);
        }}
        isLoading={isRebalancing}
        availableCash={availableCash}
        isSyncing={isSyncingPrices}
        syncMessage={
          isSyncingPrices
            ? 'Fetching updated security prices. Once completed, the rebalance will begin automatically.'
            : undefined
        }
      />
    </div>
  );
}
