import { createContext, type ReactNode, useContext } from 'react';
import type { SortField } from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-table-headers';
import type { RebalancingGroupData } from '~/types/rebalance';
import { useRebalancingGroupFeature } from '../hooks/use-rebalancing-group-feature';

interface RebalancingGroupFeature {
  // State
  data: RebalancingGroupData | null;
  ui: {
    allocationView: 'account' | 'sector' | 'industry' | 'sleeve';
    groupingMode: 'sleeve' | 'account';
    expandedSleeves: Set<string>;
    expandedAccounts: Set<string>;
    selectedAccount: string | null;
    sortField: SortField | undefined;
    sortDirection: 'asc' | 'desc' | null;
    isAllExpanded: boolean;
    rebalanceModalOpen: boolean;
  };
  mutations: {
    rebalance: {
      isPending: boolean;
      isSuccess: boolean;
      isError: boolean;
      error: unknown;
      data?: unknown;
    };
    syncPrices: {
      isPending: boolean;
      isSuccess: boolean;
      isError: boolean;
      error: unknown;
    };
  };
  trades: Array<{
    accountId: string;
    securityId: string;
    action: 'BUY' | 'SELL';
    qty: number;
    estPrice: number;
    estValue: number;
  }>;
  modals: {
    editGroup: boolean;
    deleteGroup: boolean;
    security: { ticker: string } | null;
    sleeve: { sleeveId: string } | null;
  };

  // Computed values
  availableCash: number;
  isLoading: boolean;
  isRebalancing: boolean;
  isSyncingPrices: boolean;

  // Actions
  loadData: (data: RebalancingGroupData) => void;
  setAllocationView: (view: 'account' | 'sector' | 'industry' | 'sleeve') => void;
  setGroupingMode: (mode: 'sleeve' | 'account') => void;
  toggleSleeveExpansion: (sleeveId: string) => void;
  toggleAccountExpansion: (accountId: string) => void;
  toggleExpandAll: () => void;
  setSelectedAccount: (accountId: string | null) => void;
  setSort: (field: SortField) => void;
  setRebalanceModal: (open: boolean) => void;
  handleRebalance: (
    method: 'allocation' | 'tlhSwap' | 'tlhRebalance' | 'investCash',
    cashAmount?: number,
  ) => Promise<unknown>;
  handlePriceSync: () => Promise<unknown>;
  updateTrades: (trades: RebalancingGroupFeature['trades']) => void;
  handleTradeQtyChange: (ticker: string, qty: number) => void;
  openEditModal: () => void;
  closeEditModal: () => void;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  openSecurityModal: (ticker: string) => void;
  closeSecurityModal: () => void;
  openSleeveModal: (sleeveId: string) => void;
  closeSleeveModal: () => void;
  refreshData: () => void;
}

const RebalancingGroupContext = createContext<RebalancingGroupFeature | null>(null);

interface RebalancingGroupProviderProps {
  children: ReactNode;
  groupId: string;
  initialData?: RebalancingGroupData;
}

export function RebalancingGroupProvider({
  children,
  groupId,
  initialData,
}: RebalancingGroupProviderProps) {
  const feature = useRebalancingGroupFeature(groupId);

  // Load initial data if provided
  if (initialData && !feature.data) {
    feature.loadData(initialData);
  }

  return (
    <RebalancingGroupContext.Provider value={feature}>{children}</RebalancingGroupContext.Provider>
  );
}

export function useRebalancingGroup(): RebalancingGroupFeature {
  const context = useContext(RebalancingGroupContext);
  if (!context) {
    throw new Error('useRebalancingGroup must be used within a RebalancingGroupProvider');
  }
  return context;
}

// Export the context for advanced usage
export { RebalancingGroupContext };
