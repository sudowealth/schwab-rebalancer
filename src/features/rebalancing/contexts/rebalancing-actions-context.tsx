import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useGroupMutations } from '~/features/rebalancing/hooks/use-group-mutations';
import { useRebalancingGroupQuery } from '~/features/rebalancing/hooks/use-rebalancing-group-query';
import { useRebalancingGroupState } from '~/features/rebalancing/hooks/use-rebalancing-group-state';
import type { RebalanceMethod } from '~/types/rebalance';

/**
 * Actions context for rebalancing group mutations and business logic
 * Contains async operations, trades, and action handlers
 */
interface RebalancingActionsContextValue {
  mutations: {
    rebalanceMutation: {
      isPending: boolean;
      isSuccess: boolean;
      isError: boolean;
      error: unknown;
      data?: unknown;
    };
    syncPricesMutation: {
      isPending: boolean;
      isSuccess: boolean;
      isError: boolean;
      error: unknown;
    };
    handleGenerateTrades: (
      method: RebalanceMethod,
      cashAmount?: number,
      fetchPricesSelected?: boolean,
    ) => Promise<unknown>;
    handleFetchPrices: () => void;
  };

  trades: Array<{
    accountId: string;
    securityId: string;
    action: 'BUY' | 'SELL';
    qty: number;
    estPrice: number;
    estValue: number;
  }>;

  // Computed values
  isRebalancing: boolean;
  isSyncingPrices: boolean;

  // Action handlers
  handleRebalance: (
    method: 'allocation' | 'tlhSwap' | 'tlhRebalance' | 'investCash',
    cashAmount?: number,
  ) => Promise<unknown>;

  handlePriceSync: () => void;
  updateTrades: (trades: RebalancingActionsContextValue['trades']) => void;
  handleTradeQtyChange: (ticker: string, qty: number) => void;
}

const RebalancingActionsContext = createContext<RebalancingActionsContextValue | null>(null);

interface RebalancingActionsProviderProps {
  children: ReactNode;
  groupId: string;
}

export function RebalancingActionsProvider({ children, groupId }: RebalancingActionsProviderProps) {
  const query = useRebalancingGroupQuery(groupId);
  const { trades, tradeActions } = useRebalancingGroupState(groupId);

  const mutations = useGroupMutations({
    groupId,
    accountHoldings: query.data?.accountHoldings || [],
    sleeveMembers: query.data?.sleeveMembers || [],
    onTradesUpdate: tradeActions.updateTrades,
  });

  const contextValue = useMemo(
    () => ({
      mutations: {
        rebalanceMutation: mutations.rebalanceMutation,
        syncPricesMutation: mutations.syncPricesMutation,
        handleGenerateTrades: mutations.handleGenerateTrades,
        handleFetchPrices: mutations.handleFetchPrices,
      },
      trades,
      isRebalancing: mutations.rebalanceMutation.isPending,
      isSyncingPrices: mutations.syncPricesMutation.isPending,
      handleRebalance: mutations.handleGenerateTrades,
      handlePriceSync: mutations.handleFetchPrices,
      updateTrades: tradeActions.updateTrades,
      handleTradeQtyChange: tradeActions.handleTradeQtyChange,
    }),
    [mutations, trades, tradeActions],
  );

  return (
    <RebalancingActionsContext.Provider value={contextValue}>
      {children}
    </RebalancingActionsContext.Provider>
  );
}

export function useRebalancingActions(): RebalancingActionsContextValue {
  const context = useContext(RebalancingActionsContext);
  if (!context) {
    throw new Error('useRebalancingActions must be used within a RebalancingActionsProvider');
  }
  return context;
}

export { RebalancingActionsContext };
