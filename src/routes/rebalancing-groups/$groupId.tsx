import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { RebalancingErrorBoundary } from '~/components/RouteErrorBoundaries';
import { requireAuth } from '~/features/auth/auth-utils';
import { RebalancingGroupPage } from '~/features/rebalancing/components/rebalancing-group-page';
import { RebalancingGroupProvider } from '~/features/rebalancing/contexts/rebalancing-group-provider';
import { useRebalancingUI } from '~/features/rebalancing/contexts/rebalancing-ui-context';
import type { SleeveMember } from '~/features/rebalancing/server/groups.server';
import {
  calculateSleeveAllocations,
  generateAllocationData,
  generateSleeveTableData,
  generateTopHoldingsData,
  transformAccountHoldingsForClient,
  transformSleeveAllocationDataForClient,
  transformSleeveTableDataForClient,
} from '~/features/rebalancing/utils/rebalancing-utils';
import {
  getAccountHoldings,
  getGroupTransactions,
  getOrdersForAccounts,
  getPositions,
  getProposedTrades,
  getRebalancingGroupById,
  getSleeveMembers,
  getSnP500Data,
} from '~/lib/db-api';
import { throwServerError } from '~/lib/error-utils';
import { authGuard } from '~/lib/route-guards';

// Local helper function to calculate analytics (moved from server file)
function calculateRebalancingGroupAnalytics(
  group: NonNullable<Awaited<ReturnType<typeof getRebalancingGroupById>>>,
  accountHoldings: Awaited<ReturnType<typeof getAccountHoldings>>,
  sp500Data: Awaited<ReturnType<typeof getSnP500Data>>,
) {
  // Create a Map for O(1) account lookups instead of O(n) linear search
  const accountHoldingsMap = new Map(
    accountHoldings.map((holding) => [holding.accountId, holding]),
  );

  // Update group members with calculated balances from holdings
  const updatedGroupMembers = group.members.map((member) => {
    const accountData = accountHoldingsMap.get(member.accountId);
    return {
      ...member,
      balance: accountData ? accountData.accountBalance : 0,
    };
  });

  // Calculate total portfolio value server-side
  const totalValue = updatedGroupMembers.reduce((sum, member) => sum + (member.balance || 0), 0);

  // Fetch allocation and holdings data with the calculated total value
  const allocationData = generateAllocationData(
    'sleeve',
    group,
    accountHoldings,
    sp500Data,
    totalValue,
  );
  const holdingsData = generateTopHoldingsData(accountHoldings, totalValue);

  return {
    updatedGroupMembers,
    totalValue,
    allocationData,
    holdingsData,
  };
}

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
    // Direct database calls to eliminate server function waterfall - optimal performance
    const { user } = await requireAuth();
    const { groupId } = params;

    if (!groupId) {
      throwServerError('Invalid request: groupId required', 400);
    }

    // Get the group first
    const group = await getRebalancingGroupById(groupId, user.id);
    if (!group) {
      throwServerError('Rebalancing group not found', 404);
    }

    const safeGroup = group as NonNullable<typeof group>;
    const accountIds = safeGroup.members.map((member) => member.accountId);

    // Fetch all data in parallel using direct database calls
    const [
      holdingsResult,
      sp500DataResult,
      sleeveMembersResult,
      transactionsResult,
      positionsResult,
      proposedTradesResult,
      groupOrdersResult,
    ] = await Promise.allSettled([
      accountIds.length > 0 ? getAccountHoldings(accountIds) : Promise.resolve([]),
      getSnP500Data(),
      safeGroup.assignedModel?.members && safeGroup.assignedModel.members.length > 0
        ? getSleeveMembers(safeGroup.assignedModel.members.map((member) => member.sleeveId))
        : Promise.resolve([]),
      getGroupTransactions(accountIds),
      getPositions(user.id),
      getProposedTrades(user.id),
      getOrdersForAccounts(accountIds),
    ]);

    // Extract results with fallbacks
    const accountHoldings = holdingsResult.status === 'fulfilled' ? holdingsResult.value : [];
    const sp500Data = sp500DataResult.status === 'fulfilled' ? sp500DataResult.value : [];
    const sleeveMembers =
      sleeveMembersResult.status === 'fulfilled' ? sleeveMembersResult.value : [];
    const transactions = transactionsResult.status === 'fulfilled' ? transactionsResult.value : [];
    const positions = positionsResult.status === 'fulfilled' ? positionsResult.value : [];
    const proposedTrades =
      proposedTradesResult.status === 'fulfilled' ? proposedTradesResult.value : [];
    const groupOrders =
      groupOrdersResult.status === 'fulfilled'
        ? groupOrdersResult.value.map((order) => ({
            ...order,
            avgFillPrice: order.avgFillPrice ?? undefined,
            batchLabel: order.batchLabel ?? undefined,
          }))
        : [];

    // Calculate analytics data
    const analyticsData = calculateRebalancingGroupAnalytics(safeGroup, accountHoldings, sp500Data);

    // Generate sleeve data if model is assigned
    let sleeveTableData: ReturnType<typeof transformSleeveTableDataForClient> = [];
    let sleeveAllocationData: ReturnType<typeof transformSleeveAllocationDataForClient> = [];

    if (safeGroup.assignedModel) {
      // Get sleeve members for the assigned model
      let sleeveMembers: SleeveMember[] = [];
      if (safeGroup.assignedModel.members && safeGroup.assignedModel.members.length > 0) {
        const sleeveIds = safeGroup.assignedModel.members.map((member) => member.sleeveId);
        if (sleeveIds.length > 0) {
          const sleeveMembersResult = await getSleeveMembers(sleeveIds);
          sleeveMembers = sleeveMembersResult;
        }
      }

      // Calculate sleeve allocation data
      const rawSleeveAllocationData = calculateSleeveAllocations(
        safeGroup,
        accountHoldings,
        sleeveMembers,
        transactions,
      );

      // Calculate sleeve table data
      const rawSleeveTableData = generateSleeveTableData(
        rawSleeveAllocationData,
        'all',
        analyticsData.totalValue,
      );

      // Apply transformations
      sleeveTableData = transformSleeveTableDataForClient(rawSleeveTableData);
      sleeveAllocationData = transformSleeveAllocationDataForClient(rawSleeveAllocationData);
    }

    // Transform data for client consumption
    const transformedAccountHoldings = accountHoldings.flatMap((account) =>
      account.holdings.map((holding) => ({
        accountId: account.accountId,
        ticker: holding.ticker,
        qty: holding.qty,
        costBasis: holding.costBasisTotal,
        marketValue: holding.marketValue,
        unrealizedGain: holding.unrealizedGain || 0,
        isTaxable: account.accountType === 'taxable',
        purchaseDate: holding.openedAt,
      })),
    );

    return {
      group: {
        id: safeGroup.id,
        name: safeGroup.name,
        isActive: safeGroup.isActive,
        members: analyticsData.updatedGroupMembers,
        assignedModel: safeGroup.assignedModel,
        createdAt: safeGroup.createdAt as Date,
        updatedAt: safeGroup.updatedAt as Date,
      },
      accountHoldings: transformAccountHoldingsForClient(accountHoldings),
      sleeveMembers,
      sp500Data,
      transactions,
      positions,
      proposedTrades,
      allocationData: analyticsData.allocationData,
      holdingsData: analyticsData.holdingsData,
      sleeveTableData,
      sleeveAllocationData,
      groupOrders,
      transformedAccountHoldings,
    };
  },
  component: RebalancingGroupDetail,
});

function RebalancingGroupDetail() {
  const initialData = Route.useLoaderData();
  const searchParams = Route.useSearch();

  return (
    <ErrorBoundaryWrapper
      title="Rebalancing Group Error"
      description="Failed to load rebalancing group details. This might be due to a temporary data issue."
    >
      <RebalancingGroupProvider groupId={initialData.group?.id || ''} initialData={initialData}>
        <RebalancingGroupDetailWithProvider searchParams={searchParams} />
      </RebalancingGroupProvider>
    </ErrorBoundaryWrapper>
  );
}

function RebalancingGroupDetailWithProvider({
  searchParams,
}: {
  searchParams: { rebalance?: string };
}) {
  const { setRebalanceModal } = useRebalancingUI();

  // Handle URL-based rebalance modal opening
  useEffect(() => {
    if (searchParams.rebalance === 'true') {
      setRebalanceModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams.rebalance, setRebalanceModal]);

  return <RebalancingGroupPage />;
}
