import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { RebalancingErrorBoundary } from '~/components/RouteErrorBoundaries';
import { RebalancingGroupPage } from '~/features/rebalancing/components/rebalancing-group-page';
import { RebalancingGroupProvider } from '~/features/rebalancing/contexts/rebalancing-group-provider';
import { useRebalancingUI } from '~/features/rebalancing/contexts/rebalancing-ui-context';
import { getRebalancingGroupAllDataServerFn } from '~/features/rebalancing/server/groups.server';
import { transformAccountHoldingsForClient } from '~/features/rebalancing/utils/rebalancing-utils';
import { queryInvalidators } from '~/lib/query-keys';
import { authGuard } from '~/lib/route-guards';
import { syncGroupPricesIfNeededServerFn } from '~/lib/server-functions';

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

    // SINGLE optimized call to get ALL data (eliminates redundant DB calls and transformations)
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
      transformedAccountHoldings, // Now provided by server with caching
    } = allData;

    console.log('✅ Group loaded:', group.name, 'with', group.members.length, 'members');

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
      accountHoldings: transformAccountHoldingsForClient(accountHoldings), // Keep for backward compatibility
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
  const queryClient = useQueryClient();
  const backgroundSyncTriggered = useRef(false);

  // Mutation for background price sync
  const backgroundPriceSyncMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return await syncGroupPricesIfNeededServerFn({ data: { groupId } });
    },
    onSuccess: (result) => {
      console.log('🔄 Background price sync completed:', result);
      if (result.synced && result.updatedCount && result.updatedCount > 0) {
        console.log('🔄 Prices updated, refreshing group data...');
        // Invalidate the group route loader to refresh all data
        queryInvalidators.rebalancing.groups.detail(queryClient, params.groupId);
      }
    },
    onError: (error) => {
      console.warn('⚠️ Background price sync failed:', error);
      // Don't show error to user - this is background operation
    },
  });

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

  // Trigger background price sync on component mount (non-blocking)
  useEffect(() => {
    if (!backgroundSyncTriggered.current) {
      backgroundSyncTriggered.current = true;
      console.log('🔄 Triggering background price sync for group securities...');
      backgroundPriceSyncMutation.mutate(params.groupId);
    }
  }, [params.groupId, backgroundPriceSyncMutation]);

  return <RebalancingGroupPage />;
}
