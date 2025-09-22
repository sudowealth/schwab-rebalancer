import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { Edit, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  generateAllocationDataServerFn,
  generateTopHoldingsDataServerFn,
  type getCompleteDashboardDataServerFn,
  getGroupAccountHoldingsServerFn,
  getGroupOrdersServerFn,
  getGroupTransactionsServerFn,
  getPositionsServerFn,
  getProposedTradesServerFn,
  getRebalancingGroupByIdServerFn,
  getSleeveMembersServerFn,
  getSp500DataServerFn,
  rebalancePortfolioServerFn,
  syncGroupPricesIfNeededServerFn,
  syncSchwabPricesServerFn,
} from '~/lib/server-functions';
import type { RebalanceMethod } from '~/types/rebalance';

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
  loader: async ({
    params,
  }): Promise<{
    group: NonNullable<Awaited<ReturnType<typeof getRebalancingGroupByIdServerFn>>> & {
      members: Array<{
        balance: number;
        id: string;
        accountId: string;
        isActive: boolean;
        accountName?: string;
        accountType?: string;
        accountNumber?: string;
      }>;
    };
    accountHoldings: Awaited<ReturnType<typeof getGroupAccountHoldingsServerFn>>;
    sleeveMembers: Awaited<ReturnType<typeof getSleeveMembersServerFn>>;
    sp500Data: Awaited<ReturnType<typeof getCompleteDashboardDataServerFn>>['sp500Data'];
    positions: Awaited<ReturnType<typeof getPositionsServerFn>>;
    transactions: Awaited<ReturnType<typeof getCompleteDashboardDataServerFn>>['transactions'];
    proposedTrades: Awaited<ReturnType<typeof getProposedTradesServerFn>>;
    allocationData: Awaited<ReturnType<typeof generateAllocationDataServerFn>>;
    holdingsData: Awaited<ReturnType<typeof generateTopHoldingsDataServerFn>>;
  }> => {
    // Auth is handled by beforeLoad
    const group = await getRebalancingGroupByIdServerFn({
      data: { groupId: params.groupId },
    });
    if (!group) {
      throw new Error('Rebalancing group not found');
    }

    // Get account holdings
    const accountIds = group.members.map((member) => member.accountId);
    // Get sleeve members (target securities) if there's an assigned model
    let sleeveMembers: Awaited<ReturnType<typeof getSleeveMembersServerFn>> = [];
    if (group.assignedModel?.members && group.assignedModel.members.length > 0) {
      const sleeveIds = group.assignedModel.members.map((member) => member.sleeveId);
      if (sleeveIds.length > 0) {
        sleeveMembers = await getSleeveMembersServerFn({
          data: { sleeveIds },
        });
      }
    }

    // Get basic data first (account holdings needed to calculate total value)
    const [accountHoldings, transactions, sp500Data, positions, proposedTrades] = await Promise.all(
      [
        getGroupAccountHoldingsServerFn({ data: { accountIds } }),
        getGroupTransactionsServerFn({ data: { accountIds } }),
        getSp500DataServerFn(),
        getPositionsServerFn(),
        getProposedTradesServerFn(),
      ],
    );

    // Update group members with calculated balances from holdings
    const updatedGroupMembers = group.members.map((member) => {
      const accountData = Array.isArray(accountHoldings)
        ? accountHoldings.find((ah) => ah.accountId === member.accountId)
        : undefined;
      return {
        ...member,
        balance: accountData ? accountData.accountBalance : 0,
      };
    });

    // Calculate total portfolio value
    const totalValue = updatedGroupMembers.reduce((sum, member) => sum + (member.balance || 0), 0);

    // Now get allocation and holdings data with correct total value
    const [allocationData, holdingsData] = await Promise.all([
      generateAllocationDataServerFn({
        data: {
          allocationView: 'sleeve',
          groupId: params.groupId,
          totalValue,
        },
      }),
      generateTopHoldingsDataServerFn({
        data: {
          groupId: params.groupId,
          totalValue,
        },
      }),
    ]);

    return {
      group: {
        ...group,
        members: updatedGroupMembers,
      },
      accountHoldings,
      sleeveMembers,
      sp500Data,
      transactions,
      positions,
      proposedTrades,
      allocationData,
      holdingsData,
    };
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

  // Calculate total portfolio value
  const totalValue = group.members.reduce((sum: number, member) => sum + (member.balance || 0), 0);

  // Use custom hook for sleeve allocations
  const { sleeveTableData, sleeveAllocationData } = useSleeveAllocations(
    {
      ...group,
      members: group.members.map((member) => ({
        ...member,
        accountName: member.accountName || '',
        balance: member.balance || 0,
      })),
    },
    accountHoldings,
    sleeveMembers,
    transactions,
    'all',
    totalValue,
  );

  // Calculate available cash from sleeve allocation data
  const availableCash = useMemo(() => {
    // Sum cash across all accounts
    const sleeveData = sleeveTableData.find((sleeve) => sleeve.sleeveId === 'cash');
    return sleeveData?.currentValue || 0;
  }, [sleeveTableData]);

  // Filter out any items with undefined name or value (maintain type safety)
  const filteredAllocationData = allocationData.filter(
    (
      item,
    ): item is {
      name: string;
      value: number;
      percentage: number;
      color: string;
    } => item.name != null && item.value != null,
  );

  // Helper functions using custom hooks

  const handleTickerClick = (ticker: string) => {
    modalState.openSecurityModal(ticker);
  };

  const handleSleeveClick = (sleeveId: string) => {
    modalState.openSleeveModal(sleeveId);
  };

  const handleSleeveClickByName = (sleeveName: string) => {
    // Find sleeve ID from sleeve name
    const sleeveData = sleeveMembers?.find((s) => s.sleeveName === sleeveName);
    if (sleeveData) {
      handleSleeveClick(sleeveData.sleeveId);
    }
  };

  const handleRebalance = () => {
    rebalancingState.setRebalanceModalOpen(true);
  };

  const handleSort = (field: SortField) => {
    sortingState.handleSort(field);
  };

  const handleTradeQtyChange = (ticker: string, newQty: number, _isPreview = false) => {
    tradeManagement.handleTradeQtyChange(ticker, newQty, sleeveTableData);
  };

  const handleToggleExpandAll = () => {
    expansionState.toggleExpandAll(groupingMode, sleeveTableData, sleeveAllocationData);
  };

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
      try {
        const result = await rebalancePortfolioServerFn({
          data: {
            portfolioId: group.id,
            method,
            cashAmount,
          },
        });
        tradeManagement.setTrades(result.trades);
      } catch (error) {
        console.error('Error generating trades:', error);
        // Could add toast notification here
      } finally {
        rebalancingState.setRebalanceLoading(false);
      }
    },
    [rebalancingState.syncingPrices, group.id, rebalancingState, tradeManagement],
  );

  const handleFetchPrices = async () => {
    try {
      rebalancingState.setSyncingPrices(true);
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
        await syncSchwabPricesServerFn({ data: { symbols } });
      }
      // Refresh data so any UI values that depend on prices update
      await router.invalidate();
    } catch (error) {
      console.error('Error syncing prices:', error);
    } finally {
      rebalancingState.setSyncingPrices(false);
    }
  };

  // Trigger automatic price sync when component mounts (if user is connected to Schwab)
  useEffect(() => {
    const triggerPriceSync = async () => {
      try {
        const syncResult = await syncGroupPricesIfNeededServerFn({
          data: { groupId: group.id },
        });

        if (syncResult.synced && syncResult.updatedCount && syncResult.updatedCount > 0) {
          console.log('🔄 [GroupComponent] Prices updated, invalidating router data...');
          router.invalidate();
        }
      } catch (error) {
        console.warn('⚠️ [GroupComponent] Automatic price sync failed:', error);
      }
    };

    triggerPriceSync();
  }, [group.id, router]);

  // Load group orders summary (counts) after mount and when trades change
  useEffect(() => {
    (async () => {
      try {
        const orders = await getGroupOrdersServerFn({
          data: { groupId: group.id },
        });
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
      } catch (error) {
        console.error('Error loading orders:', error);
      }
    })();
  }, [group.id]);

  // If a rebalance was queued and sync finished, run it and close modal
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

  try {
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
            onManualCashUpdate={() => router.invalidate()}
            onAccountUpdate={() => router.invalidate()}
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

          {/* Trade Blotter */}
          <OrdersBlotter
            groupId={group.id}
            prices={(() => {
              const holdingsPairs = (Array.isArray(accountHoldings) ? accountHoldings : [])
                .flatMap((a) => (Array.isArray(a.holdings) ? a.holdings : []))
                .map((h) => [h.ticker, h.currentPrice || 0] as const);
              const sp500Pairs = (Array.isArray(sp500Data) ? sp500Data : []).map(
                (s) => [s.ticker, s.price || 0] as const,
              );
              // Prefer holdings price when available, else fallback to sp500 quote
              const merged = new Map<string, number>([...sp500Pairs, ...holdingsPairs]);
              return Object.fromEntries(merged);
            })()}
            accounts={(() => {
              const map = new Map<string, { name: string; number?: string | null }>();
              (Array.isArray(group.members) ? group.members : []).forEach((m) => {
                map.set(m.accountId, {
                  name: m.accountName || '',
                  number: (m as { accountNumber?: string }).accountNumber || null,
                });
              });
              return Object.fromEntries(map);
            })()}
            onPricesUpdated={() => router.invalidate()}
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
            onClose={() => {
              modalState.closeEditModal();
              router.invalidate();
            }}
          />

          <DeleteRebalancingGroupModal
            group={group}
            open={modalState.deleteModalOpen}
            onOpenChange={modalState.setDeleteModalOpen}
            onClose={() => {
              modalState.closeDeleteModal();
              // Navigate back to the list after deletion
              router.navigate({ to: '/rebalancing-groups' });
            }}
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
  } catch (error) {
    console.error('🔄 [GroupComponent] Component error:', error);
    return (
      <ErrorBoundaryWrapper
        title="Rebalancing Group Error"
        description="Failed to load rebalancing group details. This might be due to a temporary data issue."
      >
        <div className="container mx-auto p-6">
          <div className="text-red-600">
            Error loading rebalancing group:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        </div>
      </ErrorBoundaryWrapper>
    );
  }
}
