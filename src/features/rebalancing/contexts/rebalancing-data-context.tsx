import { createContext, type ReactNode, useContext } from 'react';
import type { RebalancingGroupData } from '~/features/rebalancing/server/groups.server';

/**
 * Data context for rebalancing group data
 * Contains server data and computed values
 */
interface RebalancingDataContextValue {
  data: RebalancingGroupData | null;
  availableCash: number;
  isLoading: boolean;
  loadData: (data: RebalancingGroupData) => void;
  refreshData: () => void;
}

const RebalancingDataContext = createContext<RebalancingDataContextValue | null>(null);

interface RebalancingDataProviderProps {
  children: ReactNode;
  value: RebalancingDataContextValue;
}

export function RebalancingDataProvider({ children, value }: RebalancingDataProviderProps) {
  return (
    <RebalancingDataContext.Provider value={value}>{children}</RebalancingDataContext.Provider>
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
