import { createContext, type ReactNode, useContext } from 'react';

/**
 * Actions context for rebalancing group mutations and business logic
 * Contains async operations, trades, and action handlers
 */
interface RebalancingActionsContextValue {
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

  // Computed values
  isRebalancing: boolean;
  isSyncingPrices: boolean;

  // Action handlers
  handleRebalance: (
    method: 'allocation' | 'tlhSwap' | 'tlhRebalance' | 'investCash',
    cashAmount?: number,
  ) => Promise<unknown>;

  handlePriceSync: () => Promise<unknown>;
  updateTrades: (trades: RebalancingActionsContextValue['trades']) => void;
  handleTradeQtyChange: (ticker: string, qty: number) => void;
}

const RebalancingActionsContext = createContext<RebalancingActionsContextValue | null>(null);

interface RebalancingActionsProviderProps {
  children: ReactNode;
  value: RebalancingActionsContextValue;
}

export function RebalancingActionsProvider({ children, value }: RebalancingActionsProviderProps) {
  return (
    <RebalancingActionsContext.Provider value={value}>
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
