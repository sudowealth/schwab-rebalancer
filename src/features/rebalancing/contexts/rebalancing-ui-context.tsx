import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { SortField } from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-table-headers';
import { useRebalancingGroupState } from '~/features/rebalancing/hooks/use-rebalancing-group-state';

/**
 * UI context for rebalancing group UI state
 * Contains all UI-related state and actions
 */
interface RebalancingUIContextValue {
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

  // UI Actions
  setAllocationView: (view: 'account' | 'sector' | 'industry' | 'sleeve') => void;
  setGroupingMode: (mode: 'sleeve' | 'account') => void;
  toggleSleeveExpansion: (sleeveId: string) => void;
  toggleAccountExpansion: (accountId: string) => void;
  toggleExpandAll: () => void;
  setSelectedAccount: (accountId: string | null) => void;
  setSort: (field: SortField, direction: 'asc' | 'desc' | null) => void;
  setRebalanceModal: (open: boolean) => void;

  // Modal Actions
  openEditModal: () => void;
  closeEditModal: () => void;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  openSecurityModal: (ticker: string) => void;
  closeSecurityModal: () => void;
  openSleeveModal: (sleeveId: string) => void;
  closeSleeveModal: () => void;
}

const RebalancingUIContext = createContext<RebalancingUIContextValue | null>(null);

interface RebalancingUIProviderProps {
  children: ReactNode;
  groupId: string;
}

export function RebalancingUIProvider({ children, groupId }: RebalancingUIProviderProps) {
  const { uiState, uiActions } = useRebalancingGroupState(groupId);

  const contextValue = useMemo(
    () => ({
      ui: uiState,
      ...uiActions,
    }),
    [uiState, uiActions],
  );

  return (
    <RebalancingUIContext.Provider value={contextValue}>{children}</RebalancingUIContext.Provider>
  );
}

export function useRebalancingUI(): RebalancingUIContextValue {
  const context = useContext(RebalancingUIContext);
  if (!context) {
    throw new Error('useRebalancingUI must be used within a RebalancingUIProvider');
  }
  return context;
}

export { RebalancingUIContext };
