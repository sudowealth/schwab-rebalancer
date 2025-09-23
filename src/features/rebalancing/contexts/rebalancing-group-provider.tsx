import type { ReactNode } from 'react';
import type { RebalancingGroupData } from '~/features/rebalancing/server/groups.server';
import { useRebalancingGroupFeature } from '../hooks/use-rebalancing-group-feature';
import { RebalancingActionsProvider } from './rebalancing-actions-context';
import { RebalancingDataProvider } from './rebalancing-data-context';
import { RebalancingUIProvider } from './rebalancing-ui-context';

interface RebalancingGroupProviderProps {
  children: ReactNode;
  groupId: string;
  initialData?: RebalancingGroupData;
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
  const feature = useRebalancingGroupFeature(groupId);

  // Load initial data if provided
  if (initialData && !feature.data) {
    feature.loadData(initialData);
  }

  // Split the feature data into three separate context values
  const dataContextValue = {
    data: feature.data,
    availableCash: feature.availableCash,
    isLoading: feature.isLoading,
    loadData: feature.loadData,
    refreshData: feature.refreshData,
  };

  const uiContextValue = {
    ui: feature.ui,
    setAllocationView: feature.setAllocationView,
    setGroupingMode: feature.setGroupingMode,
    toggleSleeveExpansion: feature.toggleSleeveExpansion,
    toggleAccountExpansion: feature.toggleAccountExpansion,
    toggleExpandAll: feature.toggleExpandAll,
    setSelectedAccount: feature.setSelectedAccount,
    setSort: feature.setSort,
    setRebalanceModal: feature.setRebalanceModal,
    openEditModal: feature.openEditModal,
    closeEditModal: feature.closeEditModal,
    openDeleteModal: feature.openDeleteModal,
    closeDeleteModal: feature.closeDeleteModal,
    openSecurityModal: feature.openSecurityModal,
    closeSecurityModal: feature.closeSecurityModal,
    openSleeveModal: feature.openSleeveModal,
    closeSleeveModal: feature.closeSleeveModal,
  };

  const actionsContextValue = {
    mutations: feature.mutations,
    trades: feature.trades,
    isRebalancing: feature.isRebalancing,
    isSyncingPrices: feature.isSyncingPrices,
    handleRebalance: feature.handleRebalance,
    handlePriceSync: feature.handlePriceSync,
    updateTrades: feature.updateTrades,
    handleTradeQtyChange: feature.handleTradeQtyChange,
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
