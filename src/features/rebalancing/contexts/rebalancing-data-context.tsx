import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useRebalancingGroupQuery } from '~/features/rebalancing/hooks/use-rebalancing-group-query';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';

/**
 * Stable data context for rebalancing group data
 * Contains only stable data values to prevent unnecessary re-renders
 */
interface RebalancingDataContextValue {
  data: RebalancingGroupPageData | null | undefined;
  availableCash: number;
  groupId: string;
}

const RebalancingDataContext = createContext<RebalancingDataContextValue | null>(null);

interface RebalancingDataProviderProps {
  children: ReactNode;
  groupId: string;
  initialData?: RebalancingGroupPageData;
}

export function RebalancingDataProvider({
  children,
  groupId,
  initialData,
}: RebalancingDataProviderProps) {
  const query = useRebalancingGroupQuery(groupId, initialData);

  const availableCash = useMemo(() => {
    if (!query.data) return 0;
    return query.data.accountHoldings.reduce(
      (total: number, account: { accountBalance?: number }) => {
        return total + (account.accountBalance || 0);
      },
      0,
    );
  }, [query.data]);

  // Stable context value - only includes stable data
  const contextValue = useMemo(
    () => ({
      data: query.data,
      availableCash,
      groupId,
    }),
    [query.data, availableCash, groupId],
  );

  return (
    <RebalancingDataContext.Provider value={contextValue}>
      {children}
    </RebalancingDataContext.Provider>
  );
}

export function useRebalancingData(): RebalancingDataContextValue {
  const context = useContext(RebalancingDataContext);
  if (!context) {
    throw new Error('useRebalancingData must be used within a RebalancingDataProvider');
  }
  return context;
}

/**
 * Hook for accessing volatile loading/error states
 * Use this when you need loading or error states to avoid re-renders of stable data consumers
 */
export function useRebalancingDataLoadingState(
  groupId: string,
  initialData?: RebalancingGroupPageData,
) {
  return useRebalancingGroupQuery(groupId, initialData);
}
