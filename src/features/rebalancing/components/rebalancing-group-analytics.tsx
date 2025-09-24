import { Suspense } from 'react';
import { useRebalancingActions } from '../contexts/rebalancing-actions-context';
import { useRebalancingData } from '../contexts/rebalancing-data-context';
import { useRebalancingUI } from '../contexts/rebalancing-ui-context';
import { useRebalancingComputations } from '../hooks/use-rebalancing-computations';
import { OrdersBlotter } from './blotter/orders-blotter';
import { GroupAccountSummarySection } from './group-account-summary-section';
import { GroupChartsSection } from './group-charts-section';
import { RebalanceSummaryCards } from './rebalance-summary-cards';
import { ChartsErrorBoundary } from './rebalancing-error-boundary';
import { SleeveAllocationTable } from './sleeve-allocation/sleeve-allocation-table';

/**
 * Pure UI component for the analytics section
 * Contains account summary, allocation table, and charts
 */
export function RebalancingGroupAnalytics() {
  const { data } = useRebalancingData();
  const {
    ui,
    setAllocationView,
    setGroupingMode,
    toggleSleeveExpansion,
    toggleAccountExpansion,
    toggleExpandAll,
    setSelectedAccount,
    setSort,
    setRebalanceModal,
    openSecurityModal,
    openSleeveModal,
  } = useRebalancingUI();

  const { trades, isRebalancing, isSyncingPrices, handlePriceSync, handleTradeQtyChange } =
    useRebalancingActions();

  // Use the extracted computation hook
  const { totalValue, accountSummaryMembers } = useRebalancingComputations(
    data?.group?.members,
    data?.accountHoldings,
  );

  if (!data) {
    return null;
  }

  const { group, allocationData, holdingsData } = data;

  return (
    <>
      {/* Account Summary Section */}
      <GroupAccountSummarySection
        members={accountSummaryMembers}
        selectedAccount={ui.selectedAccount}
        totalValue={totalValue}
        onAccountSelect={setSelectedAccount}
        onManualCashUpdate={() => console.log('Manual cash update')} // Would need proper handler
        onAccountUpdate={() => console.log('Account update')} // Would need proper handler
      />

      {/* Current vs Target Allocation Table */}
      {group.assignedModel && (
        <div className="relative">
          {/* Loading overlay for rebalancing operations */}
          {(isRebalancing || isSyncingPrices) && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg border">
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

          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }
          >
            <SleeveAllocationTable
              sleeveTableData={data.sleeveTableData}
              expandedSleeves={ui.expandedSleeves}
              expandedAccounts={ui.expandedAccounts}
              groupMembers={accountSummaryMembers}
              sleeveAllocationData={data.sleeveAllocationData}
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
              accountHoldings={data.transformedAccountHoldings}
              renderSummaryCards={() => (
                <RebalanceSummaryCards
                  trades={trades
                    .filter((trade) => trade.securityId)
                    .map((trade) => ({
                      ...trade,
                      ticker: trade.securityId, // Map securityId to ticker for compatibility
                    }))}
                  sleeveTableData={data.sleeveTableData}
                  group={{
                    ...group,
                    members: group.members.map((member) => ({
                      ...member,
                      balance: member.balance || 0,
                    })),
                    assignedModel: group.assignedModel || undefined, // Handle nullable assignedModel
                  }}
                  accountHoldings={data.transformedAccountHoldings}
                />
              )}
              groupId={group.id}
              isRebalancing={isRebalancing}
            />
          </Suspense>
        </div>
      )}

      {/* Orders Blotter */}
      <OrdersBlotter
        groupId={group.id}
        accounts={accountSummaryMembers.reduce(
          (acc: Record<string, { name: string; number?: string | null }>, member) => {
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
          allocationData={allocationData || []}
          allocationView={ui.allocationView}
          onAllocationViewChange={setAllocationView}
          onSleeveClick={openSleeveModal}
          onTickerClick={openSecurityModal}
          holdingsData={holdingsData}
        />
      </ChartsErrorBoundary>
    </>
  );
}
