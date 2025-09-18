import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router';
import { Edit, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SecurityModal } from '../../components/dashboard/security-modal';
import { SleeveModal } from '../../components/dashboard/sleeve-modal';
import { AccountSummary } from '../../components/rebalancing-groups/account-summary';
import { AllocationChart } from '../../components/rebalancing-groups/allocation-chart';
import { OrdersBlotter } from '../../components/rebalancing-groups/blotter/orders-blotter';
import { DeleteRebalancingGroupModal } from '../../components/rebalancing-groups/delete-rebalancing-group-modal';
import { EditRebalancingGroupModal } from '../../components/rebalancing-groups/edit-rebalancing-group-modal';
import { RebalanceModal } from '../../components/rebalancing-groups/rebalance-modal';
import { RebalanceSummaryCards } from '../../components/rebalancing-groups/rebalance-summary-cards';
import { SleeveAllocationTable } from '../../components/rebalancing-groups/sleeve-allocation/sleeve-allocation-table';
import type {
  SortDirection,
  SortField,
} from '../../components/rebalancing-groups/sleeve-allocation/sleeve-allocation-table-headers';
import type { Trade } from '../../components/rebalancing-groups/sleeve-allocation/sleeve-allocation-types';
import { TopHoldings } from '../../components/rebalancing-groups/top-holdings';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useSleeveAllocations } from '../../hooks/use-sleeve-allocations';
import { generateAllocationData, generateTopHoldingsData } from '../../lib/rebalancing-utils';
import type { Order } from '../../lib/schemas';
import {
  getDashboardDataServerFn,
  getGroupAccountHoldingsServerFn,
  getGroupOrdersServerFn,
  getRebalancingGroupByIdServerFn,
  getSleeveMembersServerFn,
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
      const accountHoldings =
        accountIds.length > 0
          ? await getGroupAccountHoldingsServerFn({
              data: { accountIds },
            })
          : [];

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

      // Trigger automatic price sync for group securities if user is connected to Schwab
      // This runs synchronously to ensure data is fresh when the page loads
      let dashboardData = await getDashboardDataServerFn();
      let syncResult: { synced: boolean; message: string; updatedCount?: number } = {
        synced: false,
        message: 'No sync attempted',
      };

      try {
        syncResult = await syncGroupPricesIfNeededServerFn({
          data: { groupId: params.groupId },
        });
        console.log('🔄 [GroupLoader] Automatic price sync completed:', syncResult);

        // If prices were updated, refetch dashboard data to get fresh prices
        if (syncResult.synced && syncResult.updatedCount && syncResult.updatedCount > 0) {
          console.log('🔄 [GroupLoader] Refetching dashboard data after price updates');
          dashboardData = await getDashboardDataServerFn();
        }
      } catch (syncError) {
        console.warn('⚠️ [GroupLoader] Automatic price sync failed:', syncError);
        // Continue loading the page even if price sync fails
      }

      return {
        group: {
          ...group,
          members: updatedGroupMembers,
        },
        accountHoldings,
        sleeveMembers,
        sp500Data: dashboardData.sp500Data,
        positions: dashboardData.positions,
        transactions: dashboardData.transactions,
        proposedTrades: dashboardData.proposedTrades,
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
    sp500Data,
    positions,
    transactions,
    proposedTrades,
  } = Route.useLoaderData();
  const router = useRouter();
  const searchParams = Route.useSearch();

  // Trigger automatic price sync when component mounts (if user is connected to Schwab)
  useEffect(() => {
    const triggerPriceSync = async () => {
      try {
        const syncResult = await syncGroupPricesIfNeededServerFn({
          data: { groupId: group.id },
        });
        console.log('🔄 [GroupComponent] Automatic price sync result:', syncResult);
      } catch (error) {
        console.warn('⚠️ [GroupComponent] Automatic price sync failed:', error);
        // Don't show user error - this is background operation
      }
    };

    triggerPriceSync().catch((error) => {
      console.warn('⚠️ [GroupComponent] Price sync failed:', error);
    });
  }, [group.id]);

  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [expandedSleeves, setExpandedSleeves] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [allocationView, setAllocationView] = useState<
    'account' | 'sector' | 'industry' | 'sleeve'
  >('sleeve');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null);
  const [showSleeveModal, setShowSleeveModal] = useState(false);
  const [groupingMode, setGroupingMode] = useState<'sleeve' | 'account'>('sleeve');
  const [rebalanceModalOpen, setRebalanceModalOpen] = useState(false);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [waitingForSync, setWaitingForSync] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<RebalanceMethod | null>(null);
  const [pendingCashAmount, setPendingCashAmount] = useState<number | undefined>(undefined);
  const [rebalanceTrades, setRebalanceTrades] = useState<Trade[]>([]);
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [, setOrdersCountByBucket] = useState<{
    draft: number;
    pending: number;
    open: number;
    done: number;
    failed: number;
  } | null>(null);

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

  // Calculate available cash from sleeve allocation data
  const availableCash = useMemo(() => {
    // Sum cash across all accounts
    const sleeveData = sleeveTableData.find((sleeve) => sleeve.sleeveId === 'cash');
    return sleeveData?.currentValue || 0;
  }, [sleeveTableData]);

  // Generate allocation data using utility function
  const allocationData = useMemo(() => {
    const rawData = generateAllocationData(
      allocationView,
      {
        ...group,
        members: group.members.map((member) => ({
          ...member,
          accountName: member.accountName || '',
          balance: member.balance || 0,
        })),
      },
      accountHoldings,
      sp500Data,
      totalValue,
    );

    // Filter out any items with undefined name or value
    return rawData.filter(
      (
        item,
      ): item is {
        name: string;
        value: number;
        percentage: number;
        color: string;
      } => item.name != null && item.value != null,
    );
  }, [allocationView, group, accountHoldings, sp500Data, totalValue]);

  // Generate holdings data from actual account holdings (all holdings, sorted by value)
  const holdingsData = useMemo(() => {
    return generateTopHoldingsData(accountHoldings, totalValue);
  }, [accountHoldings, totalValue]);

  // Helper functions
  const toggleSleeveExpansion = (sleeveKey: string) => {
    const newExpanded = new Set(expandedSleeves);
    if (newExpanded.has(sleeveKey)) {
      newExpanded.delete(sleeveKey);
    } else {
      newExpanded.add(sleeveKey);
    }
    setExpandedSleeves(newExpanded);

    // Check if we need to update isAllExpanded
    if (groupingMode === 'sleeve') {
      const allSleeveKeys = sleeveTableData.map((sleeve) => sleeve.sleeveId);
      setIsAllExpanded(allSleeveKeys.every((key: string) => newExpanded.has(key)));
    }
  };

  const toggleAccountExpansion = (accountKey: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountKey)) {
      newExpanded.delete(accountKey);
    } else {
      newExpanded.add(accountKey);
    }
    setExpandedAccounts(newExpanded);

    // Check if we need to update isAllExpanded when in account mode
    if (groupingMode === 'account') {
      const allAccountKeys = sleeveAllocationData.map((account) => account.accountId);
      setIsAllExpanded(allAccountKeys.every((key) => newExpanded.has(key)));
    }
  };

  const handleTickerClick = (ticker: string) => {
    setSelectedTicker(ticker);
    setShowSecurityModal(true);
  };

  const handleSleeveClick = (sleeveId: string) => {
    setSelectedSleeve(sleeveId);
    setShowSleeveModal(true);
  };

  const handleSleeveClickByName = (sleeveName: string) => {
    // Find sleeve ID from sleeve name
    const sleeveData = sleeveMembers?.find((s) => s.sleeveName === sleeveName);
    if (sleeveData) {
      handleSleeveClick(sleeveData.sleeveId);
    }
  };

  const handleRebalance = () => {
    setRebalanceModalOpen(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(undefined);
      } else {
        setSortDirection('asc');
      }
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleTradeQtyChange = (ticker: string, newQty: number, _isPreview = false) => {
    setRebalanceTrades((prevTrades) => {
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

  const handleToggleExpandAll = () => {
    if (isAllExpanded) {
      // Collapse all
      setExpandedSleeves(new Set());
      setExpandedAccounts(new Set());
      setIsAllExpanded(false);
    } else {
      // Expand all
      if (groupingMode === 'sleeve') {
        // Expand all sleeves and all accounts under each sleeve (for All Accounts view)
        const allSleeveKeys = sleeveTableData.map((sleeve) => sleeve.sleeveId);
        setExpandedSleeves(new Set(allSleeveKeys));

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
        setExpandedAccounts(new Set(allCompositeAccountKeys));
      } else {
        // Expand all accounts and their sleeves
        const allAccountKeys = sleeveAllocationData.map((account) => account.accountId);
        const allSleeveKeys: string[] = [];
        sleeveAllocationData.forEach((account) => {
          account.sleeves.forEach((sleeve) => {
            allSleeveKeys.push(`${account.accountId}-${sleeve.sleeveId}`);
          });
        });
        setExpandedAccounts(new Set(allAccountKeys));
        setExpandedSleeves(new Set(allSleeveKeys));
      }
      setIsAllExpanded(true);
    }
  };

  const handleGenerateTrades = useCallback(
    async (method: RebalanceMethod, cashAmount?: number, fetchPricesSelected?: boolean) => {
      if (fetchPricesSelected && syncingPrices) {
        // Queue the rebalance until sync completes
        setWaitingForSync(true);
        setPendingMethod(method);
        setPendingCashAmount(cashAmount);
        return;
      }

      setRebalanceLoading(true);
      try {
        const result = await rebalancePortfolioServerFn({
          data: {
            portfolioId: group.id,
            method,
            cashAmount,
          },
        });
        setRebalanceTrades(result.trades);
      } catch (error) {
        console.error('Error generating trades:', error);
        // Could add toast notification here
      } finally {
        setRebalanceLoading(false);
      }
    },
    [syncingPrices, group.id],
  );

  const handleFetchPrices = async () => {
    try {
      setSyncingPrices(true);
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
      setSyncingPrices(false);
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
    if (!syncingPrices && waitingForSync && pendingMethod) {
      (async () => {
        await handleGenerateTrades(pendingMethod, pendingCashAmount, false);
        setWaitingForSync(false);
        setPendingMethod(null);
        setPendingCashAmount(undefined);
        setRebalanceModalOpen(false);
      })();
    }
  }, [syncingPrices, waitingForSync, pendingMethod, pendingCashAmount, handleGenerateTrades]);

  // Handle URL parameter to open rebalance modal
  useEffect(() => {
    if (searchParams.rebalance === 'true') {
      setRebalanceModalOpen(true);
      // Clean up URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams.rebalance]);

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
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
              <Edit className="mr-1 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setDeleteModalOpen(true)}
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
          selectedAccount={selectedAccount}
          totalValue={totalValue}
          onAccountSelect={setSelectedAccount}
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
            expandedSleeves={expandedSleeves}
            expandedAccounts={expandedAccounts}
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
            onSleeveExpansionToggle={toggleSleeveExpansion}
            onAccountExpansionToggle={toggleAccountExpansion}
            onTickerClick={handleTickerClick}
            onSleeveClick={handleSleeveClick}
            onRebalance={handleRebalance}
            onToggleExpandAll={handleToggleExpandAll}
            isAllExpanded={isAllExpanded}
            trades={rebalanceTrades}
            sortField={sortField}
            sortDirection={sortDirection}
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
                trades={rebalanceTrades
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
          <AllocationChart
            allocationData={allocationData}
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
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            router.invalidate();
          }}
        />

        <DeleteRebalancingGroupModal
          group={group}
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            // Navigate back to the list after deletion
            router.navigate({ to: '/rebalancing-groups' });
          }}
        />

        <SecurityModal
          isOpen={showSecurityModal}
          onClose={() => setShowSecurityModal(false)}
          ticker={selectedTicker}
          sp500Data={sp500Data}
          positions={positions}
          transactions={transactions}
          proposedTrades={proposedTrades}
        />

        <SleeveModal
          isOpen={showSleeveModal}
          onClose={() => setShowSleeveModal(false)}
          sleeve={selectedSleeve ? getSleeveForModal(selectedSleeve) : null}
        />

        <RebalanceModal
          open={rebalanceModalOpen}
          onOpenChange={setRebalanceModalOpen}
          onGenerateTrades={handleGenerateTrades}
          onFetchPrices={handleFetchPrices}
          isLoading={rebalanceLoading}
          availableCash={availableCash}
          isSyncing={syncingPrices}
          syncMessage={
            waitingForSync && syncingPrices
              ? 'Fetching updated security prices. Once completed, the rebalance will begin automatically.'
              : undefined
          }
        />
      </div>
    );
  } catch (error) {
    console.error('🔄 [GroupComponent] Component error:', error);
    return (
      <div className="container mx-auto p-6">
        <div className="text-red-600">
          Error loading rebalancing group:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }
}
