import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router';
import { ChevronRight, Home } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SecurityModal } from '../../components/dashboard/security-modal';
import { SleeveModal } from '../../components/dashboard/sleeve-modal';
import { AccountSummary } from '../../components/rebalancing-groups/account-summary';
import { AllocationSection } from '../../components/rebalancing-groups/allocation-section';
import { GroupHeader } from '../../components/rebalancing-groups/group-header';
import { PortfolioCharts } from '../../components/rebalancing-groups/portfolio-charts';
import type { Trade } from '../../components/rebalancing-groups/sleeve-allocation/sleeve-allocation-types';
import { TradeManagement } from '../../components/rebalancing-groups/trade-management';
import { useExpansionState } from '../../hooks/use-expansion-state';
import { useModalState } from '../../hooks/use-modal-state';
import { useRebalancingState } from '../../hooks/use-rebalancing-state';
import { useSleeveAllocations } from '../../hooks/use-sleeve-allocations';
import { useSortingState } from '../../hooks/use-sorting-state';
// Removed: generateAllocationData and generateTopHoldingsData - now calculated on server
import type { Order } from '../../lib/schemas';
import {
  generateAllocationDataServerFn,
  generateTopHoldingsDataServerFn,
  type getDashboardDataServerFn,
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
} from '../../lib/server-functions';
import type { RebalanceMethod } from '../../types/rebalance';

export const Route = createFileRoute('/rebalancing-groups/$groupId')({
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
    sp500Data: Awaited<ReturnType<typeof getDashboardDataServerFn>>['sp500Data'];
    positions: Awaited<ReturnType<typeof getDashboardDataServerFn>>['positions'];
    transactions: Awaited<ReturnType<typeof getDashboardDataServerFn>>['transactions'];
    proposedTrades: Awaited<ReturnType<typeof getDashboardDataServerFn>>['proposedTrades'];
    allocationData: Awaited<ReturnType<typeof generateAllocationDataServerFn>>;
    holdingsData: Awaited<ReturnType<typeof generateTopHoldingsDataServerFn>>;
  }> => {
    try {
      // Server function handles authentication
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

      // Run remaining data fetching in parallel
      const [accountHoldings, transactions, sp500Data] = await Promise.all([
        getGroupAccountHoldingsServerFn({ data: { accountIds } }),
        getGroupTransactionsServerFn({ data: { accountIds } }),
        getSp500DataServerFn(),
      ]);

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
      const totalValue = updatedGroupMembers.reduce(
        (sum, member) => sum + (member.balance || 0),
        0,
      );

      // Perform price sync on the server side before returning data
      try {
        await syncGroupPricesIfNeededServerFn({
          data: { groupId: params.groupId },
        });
      } catch (error) {
        console.warn('⚠️ [Loader] Automatic price sync failed:', error);
        // Don't fail the loader if price sync fails
      }

      // Calculate expensive data on the server side for better performance
      const [allocationData, holdingsData] = await Promise.all([
        generateAllocationDataServerFn({
          data: {
            allocationView: 'sleeve', // Default view
            groupId: params.groupId,
            totalValue,
          },
        }),
        generateTopHoldingsDataServerFn({
          data: {
            groupId: params.groupId,
            totalValue,
            limit: 10, // Top 10 holdings
          },
        }),
      ]);

      // Keep positions and proposedTrades in parallel for now - defer implementation needs type refinement
      const positionsPromise = getPositionsServerFn();
      const proposedTradesPromise = getProposedTradesServerFn();

      // Wait for primary data, then resolve secondary data
      const [positions, proposedTrades] = await Promise.all([
        positionsPromise,
        proposedTradesPromise,
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
    } catch (error) {
      // If authentication error, redirect to login
      if (error instanceof Error && error.message.includes('Authentication required')) {
        throw redirect({
          to: '/login',
          search: { reset: '', redirect: `/rebalancing-groups/${params.groupId}` },
        });
      }
      // Re-throw other errors
      throw error;
    }
  },
  component: RebalancingGroupDetail,
});

function RebalancingGroupDetail() {
  const {
    group,
    accountHoldings,
    sleeveMembers,
    sp500Data: _sp500Data,
    transactions,
    positions,
    proposedTrades,
    allocationData,
    holdingsData,
  } = Route.useLoaderData();
  // Note: positions and proposedTrades are pre-fetched for potential future use in modals
  // These variables are intentionally unused for now but will be used when modals are restored
  void positions;
  void proposedTrades;
  const router = useRouter();
  const searchParams = Route.useSearch();

  // Custom hooks for state management
  const expansionState = useExpansionState();
  const modalState = useModalState();
  const rebalancingState = useRebalancingState();
  const _sortingState = useSortingState();
  const [, setOrdersCountByBucket] = useState({
    draft: 0,
    pending: 0,
    open: 0,
    done: 0,
    failed: 0,
  });

  // Additional state
  const [allocationView, setAllocationView] = useState<
    'account' | 'sector' | 'industry' | 'sleeve'
  >('sleeve');
  const [groupingMode, setGroupingMode] = useState<'sleeve' | 'account'>('sleeve');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  // Modal state for edit/delete group
  const [_showEditModal, setShowEditModal] = useState(false);
  const [_showDeleteModal, setShowDeleteModal] = useState(false);

  // Calculate total portfolio value
  const totalValue = group.members.reduce((sum, member) => sum + (member.balance || 0), 0);

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

  // Transform sleeve allocation data to match AllocationSection expected types
  const transformedSleeveAllocationData = sleeveAllocationData.map((account) => ({
    ...account,
    sleeves: account.sleeves.map((sleeve) => ({
      ...sleeve,
      targetPercent: sleeve.targetPercent,
      totalGainLoss: 0, // Individual sleeves don't have aggregated gain/loss
      longTermGainLoss: 0,
      shortTermGainLoss: 0,
      accountNames: [account.accountName], // Individual sleeve belongs to this account
      securities: sleeve.securities.map((security) => ({
        ...security,
        targetPercent: security.targetPercent,
        accountNames: Array.from(security.accountNames), // Convert Set<string> to string[]
        currentPercent: security.currentPercent || 0,
        difference: security.difference || 0,
        differencePercent: security.differencePercent || 0,
        qty: security.qty || 0,
        isHeld: security.isHeld || false,
      })),
    })),
  }));

  // Transform sleeve table data to match AllocationSection expected types
  const transformedSleeveTableData = sleeveTableData.map((sleeve) => ({
    ...sleeve,
    accountNames: Array.from(sleeve.accountNames), // Convert Set<string> to string[]
    securities:
      sleeve.securities?.map((security) => ({
        ...security,
        targetPercent: security.targetPercent,
        accountNames: Array.from(security.accountNames), // Convert Set<string> to string[]
        currentPercent: security.currentPercent || 0,
        difference: security.difference || 0,
        differencePercent: security.differencePercent || 0,
        qty: security.qty || 0,
        isHeld: security.isHeld || false,
      })) || [],
  }));

  // Calculate available cash from sleeve allocation data
  const _availableCash = useMemo(() => {
    // Sum cash across all accounts
    const sleeveData = sleeveTableData.find((sleeve) => sleeve.sleeveId === 'cash');
    return sleeveData?.currentValue || 0;
  }, [sleeveTableData]);

  // Use server-calculated allocation data (for 'sleeve' view by default)
  // Note: For other views, we would need to make additional server calls
  const _allocationData = (
    allocationData as Array<{
      name: string;
      value: number;
      percentage: number;
      color: string;
    }>
  ).filter((item) => item.name != null && item.value != null);

  // Use server-calculated holdings data
  const _holdingsData = holdingsData;

  const _handleTickerClick = (ticker: string) => {
    modalState.setSelectedTicker(ticker);
    modalState.setShowSecurityModal(true);

    // positions and proposedTrades are now pre-fetched in the loader
    // They can be used directly from Route.useLoaderData()
  };

  const handleSleeveClick = (sleeveId: string) => {
    modalState.setSelectedSleeve(sleeveId);
    modalState.setShowSleeveModal(true);
  };

  const _handleSleeveClickByName = (sleeveName: string) => {
    // Find sleeve ID from sleeve name
    const sleeveData = sleeveMembers?.find((s) => s.sleeveName === sleeveName);
    if (sleeveData) {
      handleSleeveClick(sleeveData.sleeveId);
    }
  };

  const _handleRebalance = () => {
    rebalancingState.setRebalanceModalOpen(true);
  };

  const _handleTradeQtyChange = (ticker: string, newQty: number, _isPreview = false) => {
    rebalancingState.setRebalanceTrades((prevTrades) => {
      // Find existing trade for this ticker
      const existingTradeIndex = prevTrades.findIndex(
        (trade: Trade) => trade.ticker === ticker || trade.securityId === ticker,
      );

      if (existingTradeIndex >= 0) {
        // Update existing trade
        const updatedTrades = [...prevTrades];
        const existingTrade = updatedTrades[existingTradeIndex];

        // Get the security's current price from sleeveTableData
        let currentPrice = existingTrade.estPrice;
        for (const sleeve of sleeveTableData) {
          const security = sleeve.securities?.find(
            (s: { ticker: string; currentPrice?: number }) => s.ticker === ticker,
          );
          if (security?.currentPrice) {
            currentPrice = security.currentPrice;
            break;
          }
        }

        updatedTrades[existingTradeIndex] = {
          ...existingTrade,
          qty: newQty,
          action: newQty > 0 ? 'BUY' : 'SELL',
          estValue: newQty * currentPrice,
        };

        // Remove trade if quantity is 0
        if (newQty === 0) {
          updatedTrades.splice(existingTradeIndex, 1);
        }

        return updatedTrades;
      }
      if (newQty !== 0) {
        // Create new trade if it doesn't exist and quantity is not 0
        let currentPrice = 0;
        let accountId = '';

        // Find the security's price and account from sleeveTableData
        for (const sleeve of sleeveTableData) {
          const security = sleeve.securities?.find(
            (s: { ticker: string; currentPrice?: number }) => s.ticker === ticker,
          );
          if (security) {
            currentPrice = security.currentPrice || 0;
            // Use the first account
            accountId = group.members[0].accountId;
            break;
          }
        }

        if (currentPrice > 0 && accountId) {
          return [
            ...prevTrades,
            {
              accountId,
              securityId: ticker,
              ticker,
              action: newQty > 0 ? 'BUY' : 'SELL',
              qty: newQty,
              estPrice: currentPrice,
              estValue: newQty * currentPrice,
            },
          ];
        }
      }

      return prevTrades;
    });
  };

  const _handleToggleExpandAll = () => {
    if (expansionState.isAllExpanded) {
      // Collapse all
      expansionState.setExpandedSleeves(new Set());
      expansionState.setExpandedAccounts(new Set());
      expansionState.setIsAllExpanded(false);
    } else {
      // Expand all
      if (groupingMode === 'sleeve') {
        // Expand all sleeves and all accounts under each sleeve (for All Accounts view)
        const allSleeveKeys = sleeveTableData.map((sleeve) => sleeve.sleeveId);
        expansionState.setExpandedSleeves(new Set(allSleeveKeys));

        // Build composite account keys: `${sleeveId}-${accountId}` used by the table when grouping by sleeve
        const allCompositeAccountKeys: string[] = [];
        sleeveTableData.forEach((sleeve) => {
          sleeveAllocationData.forEach((account) => {
            const hasSleeve = (account.sleeves || []).some((s) => s.sleeveId === sleeve.sleeveId);
            if (hasSleeve) {
              allCompositeAccountKeys.push(`${sleeve.sleeveId}-${account.accountId}`);
            }
          });
        });
        expansionState.setExpandedAccounts(new Set(allCompositeAccountKeys));
      } else {
        // Expand all accounts and their sleeves
        const allAccountKeys = sleeveAllocationData.map((account) => account.accountId);
        const allSleeveKeys: string[] = [];
        sleeveAllocationData.forEach((account) => {
          account.sleeves.forEach((sleeve) => {
            allSleeveKeys.push(`${account.accountId}-${sleeve.sleeveId}`);
          });
        });
        expansionState.setExpandedAccounts(new Set(allAccountKeys));
        expansionState.setExpandedSleeves(new Set(allSleeveKeys));
      }
      expansionState.setIsAllExpanded(true);
    }
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
        rebalancingState.setRebalanceTrades(result.trades);
      } catch (error) {
        console.error('Error generating trades:', error);
        // Could add toast notification here
      } finally {
        rebalancingState.setRebalanceLoading(false);
      }
    },
    [group.id, rebalancingState],
  );

  const _handleFetchPrices = async () => {
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
    const method = rebalancingState.pendingMethod;
    const cashAmount = rebalancingState.pendingCashAmount;

    if (!rebalancingState.syncingPrices && rebalancingState.waitingForSync && method) {
      (async () => {
        await handleGenerateTrades(method, cashAmount, false);
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
      // Clean up URL parameter using router navigation
      // biome-ignore lint/suspicious/noExplicitAny: Complex TanStack Router type requirements
      router.navigate({ search: { rebalance: undefined } } as any);
    }
  }, [searchParams.rebalance, rebalancingState, router.navigate]);

  // Convert sleeve members data to format expected by SleeveModal
  const _getSleeveForModal = (sleeveId: string) => {
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb and Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-gray-700 flex items-center">
          <Home className="h-4 w-4 mr-1" />
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/rebalancing-groups" className="hover:text-gray-700">
          Rebalancing Groups
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{group.name}</span>
      </nav>

      {/* Group Header */}
      <GroupHeader
        group={group}
        onEdit={() => setShowEditModal(true)}
        onDelete={() => setShowDeleteModal(true)}
      />

      {/* Account Summary Section */}
      <AccountSummary
        members={group.members.map((member) => ({
          ...member,
          accountName: member.accountName || '',
          accountType: member.accountType || '',
          balance: member.balance || 0,
        }))}
        selectedAccount={selectedAccount}
        totalValue={totalValue}
        onAccountSelect={setSelectedAccount}
        onManualCashUpdate={() => {
          // Invalidate and refetch data when manual cash is updated
          router.invalidate();
        }}
        onAccountUpdate={() => {
          // Invalidate and refetch data when account is updated
          router.invalidate();
        }}
      />

      {/* Current vs Target Allocation Table */}
      {group.assignedModel && (
        <AllocationSection
          group={group}
          groupId={group.id}
          sleeveTableData={transformedSleeveTableData}
          sleeveAllocationData={transformedSleeveAllocationData}
          expandedSleeves={expansionState.expandedSleeves}
          expandedAccounts={expansionState.expandedAccounts}
          groupingMode={groupingMode}
          isAllExpanded={expansionState.isAllExpanded}
          trades={rebalancingState.rebalanceTrades}
          sortField={_sortingState.sortField}
          sortDirection={_sortingState.sortDirection}
          accountHoldings={accountHoldings}
          onGroupingModeChange={setGroupingMode}
          onSleeveExpansionToggle={expansionState.toggleSleeveExpansion}
          onAccountExpansionToggle={expansionState.toggleAccountExpansion}
          onTickerClick={_handleTickerClick}
          onSleeveClick={handleSleeveClick}
          onRebalance={_handleRebalance}
          onToggleExpandAll={_handleToggleExpandAll}
          onSort={_sortingState.setSortField}
          onTradeQtyChange={_handleTradeQtyChange}
        />
      )}

      {/* Trade Management */}
      <TradeManagement
        groupId={group.id}
        prices={{}} // Empty for now, can be populated from sleeveTableData if needed
        accounts={group.members.reduce(
          (acc, member) => {
            acc[member.accountId] = {
              name: member.accountName || '',
              number: null,
            };
            return acc;
          },
          {} as Record<string, { name: string; number: string | null }>,
        )}
        rebalanceModalOpen={rebalancingState.rebalanceModalOpen}
        rebalanceLoading={rebalancingState.rebalanceLoading}
        availableCash={_availableCash}
        syncingPrices={rebalancingState.syncingPrices}
        waitingForSync={rebalancingState.waitingForSync}
        onPricesUpdated={() => router.invalidate()}
        onRebalanceModalChange={rebalancingState.setRebalanceModalOpen}
        onGenerateTrades={handleGenerateTrades}
        onFetchPrices={_handleFetchPrices}
      />

      {/* Portfolio Charts */}
      <PortfolioCharts
        allocationData={_allocationData}
        allocationView={allocationView}
        holdingsData={_holdingsData}
        onAllocationViewChange={setAllocationView}
        onSleeveClick={_handleSleeveClickByName}
        onTickerClick={_handleTickerClick}
      />

      {/* Modals */}
      <SecurityModal
        ticker={modalState.selectedTicker}
        isOpen={modalState.showSecurityModal}
        onClose={() => {
          modalState.setShowSecurityModal(false);
          modalState.setSelectedTicker('');
        }}
        positions={positions}
        proposedTrades={proposedTrades}
      />

      <SleeveModal
        sleeve={modalState.selectedSleeve ? _getSleeveForModal(modalState.selectedSleeve) : null}
        isOpen={modalState.showSleeveModal}
        onClose={() => {
          modalState.setShowSleeveModal(false);
          modalState.setSelectedSleeve('');
        }}
      />
    </div>
  );
}
