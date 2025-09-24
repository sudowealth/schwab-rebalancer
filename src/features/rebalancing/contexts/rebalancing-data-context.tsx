import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useRebalancingGroupQuery } from '~/features/rebalancing/hooks/use-rebalancing-group-query';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';

/**
 * Data context for rebalancing group data
 * Contains server data from React Query
 */
interface RebalancingDataContextValue {
  data: RebalancingGroupPageData | undefined;
  availableCash: number;
  isLoading: boolean;
  error: unknown;
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

  const contextValue = useMemo(
    () => ({
      data: query.data,
      availableCash,
      isLoading: query.isLoading,
      error: query.error,
    }),
    [query.data, availableCash, query.isLoading, query.error],
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

export { RebalancingDataContext };
