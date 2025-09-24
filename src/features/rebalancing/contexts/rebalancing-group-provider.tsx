import type { ReactNode } from 'react';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';
import { useRebalancingGroup } from '../hooks/use-rebalancing-group';
import { RebalancingActionsProvider } from './rebalancing-actions-context';
import { RebalancingDataProvider } from './rebalancing-data-context';
import { RebalancingUIProvider } from './rebalancing-ui-context';

interface RebalancingGroupProviderProps {
  children: ReactNode;
  groupId: string;
  initialData?: RebalancingGroupPageData;
}

/**
 * Main provider that manages all three rebalancing contexts
 * Splits the monolithic context into separate providers for better performance
 */
export function RebalancingGroupProvider({
  children,
  groupId,
  initialData,
}: RebalancingGroupProviderProps) {
  const group = useRebalancingGroup(groupId, initialData);

  // Split the group data into separate context values
  const dataContextValue = {
    data: group.data,
    availableCash: group.availableCash,
    isLoading: group.isLoading,
    error: group.error,
  };

  const uiContextValue = {
    ui: group.ui,
    setAllocationView: group.uiActions.setAllocationView,
    setGroupingMode: group.uiActions.setGroupingMode,
    toggleSleeveExpansion: group.uiActions.toggleSleeveExpansion,
    toggleAccountExpansion: group.uiActions.toggleAccountExpansion,
    toggleExpandAll: group.uiActions.toggleExpandAll,
    setSelectedAccount: group.uiActions.setSelectedAccount,
    setSort: group.uiActions.setSort,
    setRebalanceModal: group.uiActions.setRebalanceModal,
    openEditModal: group.uiActions.openEditModal,
    closeEditModal: group.uiActions.closeEditModal,
    openDeleteModal: group.uiActions.openDeleteModal,
    closeDeleteModal: group.uiActions.closeDeleteModal,
    openSecurityModal: group.uiActions.openSecurityModal,
    closeSecurityModal: group.uiActions.closeSecurityModal,
    openSleeveModal: group.uiActions.openSleeveModal,
    closeSleeveModal: group.uiActions.closeSleeveModal,
  };

  const actionsContextValue = {
    mutations: {
      rebalanceMutation: group.mutations.rebalanceMutation,
      syncPricesMutation: group.mutations.syncPricesMutation,
      handleGenerateTrades: group.mutations.handleGenerateTrades,
      handleFetchPrices: group.mutations.handleFetchPrices,
    },
    trades: group.trades,
    isRebalancing: group.mutations.rebalanceMutation.isPending,
    isSyncingPrices: group.mutations.syncPricesMutation.isPending,
    handleRebalance: group.mutations.handleGenerateTrades,
    handlePriceSync: group.mutations.handleFetchPrices,
    updateTrades: group.tradeActions.updateTrades,
    handleTradeQtyChange: group.tradeActions.handleTradeQtyChange,
  };

  return (
    <RebalancingDataProvider value={dataContextValue}>
      <RebalancingUIProvider value={uiContextValue}>
        <RebalancingActionsProvider value={actionsContextValue}>
          {children}
        </RebalancingActionsProvider>
      </RebalancingUIProvider>
    </RebalancingDataProvider>
  );
}
