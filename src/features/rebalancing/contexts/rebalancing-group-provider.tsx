import type { ReactNode } from 'react';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';
import { RebalancingActionsProvider } from './rebalancing-actions-context';
import { RebalancingDataProvider } from './rebalancing-data-context';
import { RebalancingUIProvider } from './rebalancing-ui-context';

interface RebalancingGroupProviderProps {
  children: ReactNode;
  groupId: string;
  initialData?: RebalancingGroupPageData;
}

/**
 * Main provider that composes all three rebalancing contexts
 * Each context provider now handles its own data fetching and memoization
 * for optimal performance and to avoid cascade re-renders
 */
export function RebalancingGroupProvider({
  children,
  groupId,
  initialData,
}: RebalancingGroupProviderProps) {
  return (
    <RebalancingDataProvider groupId={groupId} initialData={initialData}>
      <RebalancingUIProvider groupId={groupId}>
        <RebalancingActionsProvider groupId={groupId}>{children}</RebalancingActionsProvider>
      </RebalancingUIProvider>
    </RebalancingDataProvider>
  );
}
