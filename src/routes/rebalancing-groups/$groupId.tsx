import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { RebalancingErrorBoundary } from '~/components/RouteErrorBoundaries';
import {
  RebalancingGroupProvider,
  useRebalancingGroup,
} from '~/features/rebalancing/components/rebalancing-group-context';
import { RebalancingGroupPage } from '~/features/rebalancing/components/rebalancing-group-page';
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
    // biome-ignore lint/suspicious/noExplicitAny: Cast to any due to complex data transformation requirements between server and client types
    return result as any;
  },
  component: RebalancingGroupDetail,
});

function RebalancingGroupDetail() {
  const data = Route.useLoaderData();
  const searchParams = Route.useSearch();
  const { groupId } = Route.useParams();

  return (
    <ErrorBoundaryWrapper
      title="Rebalancing Group Error"
      description="Failed to load rebalancing group details. This might be due to a temporary data issue."
    >
      <RebalancingGroupProvider groupId={groupId} initialData={data}>
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
  const { setRebalanceModal } = useRebalancingGroup();

  // Handle URL-based rebalance modal opening
  useEffect(() => {
    if (searchParams.rebalance === 'true') {
      setRebalanceModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams.rebalance, setRebalanceModal]);

  return <RebalancingGroupPage />;
}
