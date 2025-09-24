import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { RebalancingErrorBoundary } from '~/components/RouteErrorBoundaries';
import { RebalancingGroupPage } from '~/features/rebalancing/components/rebalancing-group-page';
import { RebalancingGroupProvider } from '~/features/rebalancing/contexts/rebalancing-group-provider';
import { useRebalancingUI } from '~/features/rebalancing/contexts/rebalancing-ui-context';
import { getRebalancingGroupAllDataServerFn } from '~/features/rebalancing/server/groups.server';
import { transformAccountHoldingsForClient } from '~/features/rebalancing/utils/rebalancing-utils';
import { authGuard } from '~/lib/route-guards';

export const Route = createFileRoute('/rebalancing-groups/$groupId')({
  errorComponent: RebalancingErrorBoundary,
  beforeLoad: authGuard,
  validateSearch: z.object({
    rebalance: z.string().optional(),
    tab: z.enum(['overview', 'analytics', 'trades']).optional(),
  }),
  loader: async ({ params }) => {
    const { groupId } = params;
    console.log('🔄 Loading rebalancing group page for groupId:', groupId);

    // SINGLE consolidated call to get ALL data (replaces 3 separate calls)
    const allData = await getRebalancingGroupAllDataServerFn({ data: { groupId } });
    const {
      group,
      accountHoldings,
      sp500Data,
      updatedGroupMembers,
      allocationData,
      holdingsData,
      sleeveMembers,
      sleeveTableData,
      sleeveAllocationData,
      transactions,
      positions,
      proposedTrades,
      groupOrders,
    } = allData;

    console.log('✅ Group loaded:', group.name, 'with', group.members.length, 'members');

    // Transform account holdings for client (keeping existing logic)
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
        id: group.id,
        name: group.name,
        isActive: group.isActive,
        members: updatedGroupMembers,
        assignedModel: group.assignedModel,
        createdAt: group.createdAt as Date,
        updatedAt: group.updatedAt as Date,
      },
      accountHoldings: transformAccountHoldingsForClient(accountHoldings),
      sleeveMembers,
      sp500Data,
      transactions,
      positions,
      proposedTrades,
      allocationData,
      holdingsData,
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
  searchParams: ReturnType<typeof Route.useSearch>;
}) {
  const { setRebalanceModal } = useRebalancingUI();
  const navigate = useNavigate();
  const params = Route.useParams();

  // Handle URL-based rebalance modal opening
  useEffect(() => {
    if (searchParams.rebalance === 'true') {
      setRebalanceModal(true);
      navigate({
        to: '/rebalancing-groups/$groupId',
        params: { groupId: params.groupId },
        search: (prev) => ({ ...prev, rebalance: undefined }),
        replace: true,
      });
    }
  }, [searchParams.rebalance, setRebalanceModal, navigate, params.groupId]);

  return <RebalancingGroupPage />;
}
