import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { SortField } from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-table-headers';
import type { RebalancingGroupData } from '~/features/rebalancing/server/groups.server';
import type { RebalancePortfolioServerFnResult } from '~/features/rebalancing/server/portfolio.server';
import { queryInvalidators } from '~/lib/query-keys';
import { rebalancePortfolioServerFn, syncSchwabPricesServerFn } from '~/lib/server-functions';

// State machine types
interface RebalancingGroupUIState {
  allocationView: 'account' | 'sector' | 'industry' | 'sleeve';
  groupingMode: 'sleeve' | 'account';
  expandedSleeves: Set<string>;
  expandedAccounts: Set<string>;
  selectedAccount: string | null;
  sortField: SortField | undefined;
  sortDirection: 'asc' | 'desc' | null;
  isAllExpanded: boolean;
  rebalanceModalOpen: boolean;
}

interface RebalancingGroupFeatureState {
  data: RebalancingGroupData | null;
  ui: RebalancingGroupUIState;
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
}

type RebalancingGroupAction =
  | { type: 'LOAD_DATA'; payload: RebalancingGroupData }
  | { type: 'SET_ALLOCATION_VIEW'; payload: RebalancingGroupUIState['allocationView'] }
  | { type: 'SET_GROUPING_MODE'; payload: RebalancingGroupUIState['groupingMode'] }
  | { type: 'TOGGLE_SLEEVE_EXPANSION'; payload: string }
  | { type: 'TOGGLE_ACCOUNT_EXPANSION'; payload: string }
  | { type: 'TOGGLE_EXPAND_ALL' }
  | { type: 'SET_SELECTED_ACCOUNT'; payload: string | null }
  | { type: 'SET_SORT'; payload: { field: SortField; direction: 'asc' | 'desc' | null } }
  | { type: 'SET_REBALANCE_MODAL'; payload: boolean }
  | { type: 'START_REBALANCE' }
  | { type: 'REBALANCE_SUCCESS'; payload: RebalancePortfolioServerFnResult }
  | { type: 'REBALANCE_ERROR'; payload: unknown }
  | { type: 'START_PRICE_SYNC' }
  | { type: 'PRICE_SYNC_SUCCESS' }
  | { type: 'PRICE_SYNC_ERROR'; payload: unknown }
  | {
      type: 'UPDATE_TRADES';
      payload: Array<{
        accountId: string;
        securityId: string;
        action: 'BUY' | 'SELL';
        qty: number;
        estPrice: number;
        estValue: number;
      }>;
    }
  | { type: 'OPEN_EDIT_MODAL' }
  | { type: 'CLOSE_EDIT_MODAL' }
  | { type: 'OPEN_DELETE_MODAL' }
  | { type: 'CLOSE_DELETE_MODAL' }
  | { type: 'OPEN_SECURITY_MODAL'; payload: string }
  | { type: 'CLOSE_SECURITY_MODAL' }
  | { type: 'OPEN_SLEEVE_MODAL'; payload: string }
  | { type: 'CLOSE_SLEEVE_MODAL' }
  | { type: 'HANDLE_TRADE_QTY_CHANGE'; payload: { ticker: string; qty: number } };

const initialUIState: RebalancingGroupUIState = {
  allocationView: 'sleeve',
  groupingMode: 'sleeve',
  expandedSleeves: new Set(),
  expandedAccounts: new Set(),
  selectedAccount: null,
  sortField: undefined,
  sortDirection: null,
  isAllExpanded: false,
  rebalanceModalOpen: false,
};

const initialState: RebalancingGroupFeatureState = {
  data: null,
  ui: initialUIState,
  mutations: {
    rebalance: {
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    },
    syncPrices: {
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
    },
  },
  trades: [],
  modals: {
    editGroup: false,
    deleteGroup: false,
    security: null,
    sleeve: null,
  },
};

function rebalancingGroupReducer(
  state: RebalancingGroupFeatureState,
  action: RebalancingGroupAction,
): RebalancingGroupFeatureState {
  switch (action.type) {
    case 'LOAD_DATA':
      return {
        ...state,
        data: action.payload,
      };

    case 'SET_ALLOCATION_VIEW':
      return {
        ...state,
        ui: {
          ...state.ui,
          allocationView: action.payload,
        },
      };

    case 'SET_GROUPING_MODE':
      return {
        ...state,
        ui: {
          ...state.ui,
          groupingMode: action.payload,
        },
      };

    case 'TOGGLE_SLEEVE_EXPANSION': {
      const newExpanded = new Set(state.ui.expandedSleeves);
      newExpanded.has(action.payload)
        ? newExpanded.delete(action.payload)
        : newExpanded.add(action.payload);
      return {
        ...state,
        ui: {
          ...state.ui,
          expandedSleeves: newExpanded,
        },
      };
    }

    case 'TOGGLE_ACCOUNT_EXPANSION': {
      const newExpanded = new Set(state.ui.expandedAccounts);
      newExpanded.has(action.payload)
        ? newExpanded.delete(action.payload)
        : newExpanded.add(action.payload);
      return {
        ...state,
        ui: {
          ...state.ui,
          expandedAccounts: newExpanded,
        },
      };
    }

    case 'TOGGLE_EXPAND_ALL': {
      if (state.ui.isAllExpanded) {
        // Collapse all
        return {
          ...state,
          ui: {
            ...state.ui,
            expandedSleeves: new Set(),
            expandedAccounts: new Set(),
            isAllExpanded: false,
          },
        };
      } else {
        // Expand all - this would need data to determine what to expand
        // For now, just set the flag and let the component handle the expansion
        return {
          ...state,
          ui: {
            ...state.ui,
            isAllExpanded: true,
          },
        };
      }
    }

    case 'SET_SELECTED_ACCOUNT':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedAccount: action.payload,
        },
      };

    case 'SET_SORT':
      return {
        ...state,
        ui: {
          ...state.ui,
          sortField: action.payload.field,
          sortDirection: action.payload.direction,
        },
      };

    case 'SET_REBALANCE_MODAL':
      return {
        ...state,
        ui: {
          ...state.ui,
          rebalanceModalOpen: action.payload,
        },
      };

    case 'START_REBALANCE':
      return {
        ...state,
        mutations: {
          ...state.mutations,
          rebalance: {
            ...state.mutations.rebalance,
            isPending: true,
            isError: false,
            error: null,
          },
        },
      };

    case 'REBALANCE_SUCCESS': {
      return {
        ...state,
        trades: action.payload.trades,
        mutations: {
          ...state.mutations,
          rebalance: {
            ...state.mutations.rebalance,
            isPending: false,
            isSuccess: true,
            isError: false,
            error: null,
            data: action.payload,
          },
        },
        ui: {
          ...state.ui,
          rebalanceModalOpen: false, // Close modal on success
        },
      };
    }

    case 'REBALANCE_ERROR':
      return {
        ...state,
        mutations: {
          ...state.mutations,
          rebalance: {
            ...state.mutations.rebalance,
            isPending: false,
            isSuccess: false,
            isError: true,
            error: action.payload,
          },
        },
      };

    case 'START_PRICE_SYNC':
      return {
        ...state,
        mutations: {
          ...state.mutations,
          syncPrices: {
            ...state.mutations.syncPrices,
            isPending: true,
            isError: false,
            error: null,
          },
        },
      };

    case 'PRICE_SYNC_SUCCESS':
      return {
        ...state,
        mutations: {
          ...state.mutations,
          syncPrices: {
            ...state.mutations.syncPrices,
            isPending: false,
            isSuccess: true,
            isError: false,
            error: null,
          },
        },
      };

    case 'PRICE_SYNC_ERROR':
      return {
        ...state,
        mutations: {
          ...state.mutations,
          syncPrices: {
            ...state.mutations.syncPrices,
            isPending: false,
            isSuccess: false,
            isError: true,
            error: action.payload,
          },
        },
      };

    case 'UPDATE_TRADES':
      return {
        ...state,
        trades: action.payload,
      };

    case 'OPEN_EDIT_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          editGroup: true,
        },
      };

    case 'CLOSE_EDIT_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          editGroup: false,
        },
      };

    case 'OPEN_DELETE_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          deleteGroup: true,
        },
      };

    case 'CLOSE_DELETE_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          deleteGroup: false,
        },
      };

    case 'OPEN_SECURITY_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          security: { ticker: action.payload },
        },
      };

    case 'CLOSE_SECURITY_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          security: null,
        },
      };

    case 'OPEN_SLEEVE_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          sleeve: { sleeveId: action.payload },
        },
      };

    case 'CLOSE_SLEEVE_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          sleeve: null,
        },
      };

    case 'HANDLE_TRADE_QTY_CHANGE': {
      const { ticker, qty } = action.payload;
      const existingTradeIndex = state.trades.findIndex((trade) => trade.securityId === ticker);

      if (existingTradeIndex >= 0) {
        // Update existing trade
        const updatedTrades = [...state.trades];
        const existingTrade = updatedTrades[existingTradeIndex];
        updatedTrades[existingTradeIndex] = {
          ...existingTrade,
          qty: Math.abs(qty),
          action: qty > 0 ? 'BUY' : 'SELL',
          estValue: Math.abs(qty) * (existingTrade.estPrice || 0),
        };
        return {
          ...state,
          trades: updatedTrades,
        };
      } else {
        // Add new trade - would need price data from sleeveTableData
        // This is simplified - in practice we'd need to look up the price
        const newTrade = {
          accountId: '', // Would need to determine from context
          securityId: ticker,
          action: (qty > 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
          qty: Math.abs(qty),
          estPrice: 0, // Would need to look up from sleeveTableData
          estValue: 0,
        };
        return {
          ...state,
          trades: [...state.trades, newTrade],
        };
      }
    }

    default:
      return state;
  }
}

export function useRebalancingGroupFeature(groupId: string) {
  const [state, dispatch] = useReducer(rebalancingGroupReducer, initialState);
  const queryClient = useQueryClient();

  // Load initial data from route loader
  useEffect(() => {
    // This would be called when the route data is available
    // For now, we'll assume the data is passed in or loaded elsewhere
  }, []);

  // Handle rebalance mutation effects
  useEffect(() => {
    if (state.mutations.rebalance.isSuccess) {
      console.log('📊 [Feature] Rebalance completed successfully');
      // Invalidate and refresh data
      queryInvalidators.rebalancing.groups.detail(queryClient, groupId);
    }
  }, [state.mutations.rebalance.isSuccess, queryClient, groupId]);

  // Handle price sync effects
  useEffect(() => {
    if (state.mutations.syncPrices.isSuccess) {
      console.log('💹 [Feature] Price sync completed successfully');
      queryInvalidators.rebalancing.groups.detail(queryClient, groupId);
    }
  }, [state.mutations.syncPrices.isSuccess, queryClient, groupId]);

  // Computed values
  const availableCash = useMemo(() => {
    if (!state.data?.sleeveTableData) return 0;
    // Calculate available cash from sleeve table data
    // This is a simplified version - would need proper logic
    return state.data.sleeveTableData.reduce((sum, item) => {
      // Check securities for cash holdings
      if (item.securities) {
        const cashSecurities = item.securities.filter(
          (sec) => sec.ticker === 'CASH' || sec.ticker === 'Cash',
        );
        return sum + cashSecurities.reduce((secSum, sec) => secSum + sec.currentValue, 0);
      }
      return sum;
    }, 0);
  }, [state.data?.sleeveTableData]);

  // Action creators
  const actions = {
    loadData: useCallback((data: RebalancingGroupData) => {
      dispatch({ type: 'LOAD_DATA', payload: data });
    }, []),

    setAllocationView: useCallback((view: RebalancingGroupUIState['allocationView']) => {
      dispatch({ type: 'SET_ALLOCATION_VIEW', payload: view });
    }, []),

    setGroupingMode: useCallback((mode: RebalancingGroupUIState['groupingMode']) => {
      dispatch({ type: 'SET_GROUPING_MODE', payload: mode });
    }, []),

    toggleSleeveExpansion: useCallback((sleeveId: string) => {
      dispatch({ type: 'TOGGLE_SLEEVE_EXPANSION', payload: sleeveId });
    }, []),

    toggleAccountExpansion: useCallback((accountId: string) => {
      dispatch({ type: 'TOGGLE_ACCOUNT_EXPANSION', payload: accountId });
    }, []),

    toggleExpandAll: useCallback(() => {
      dispatch({ type: 'TOGGLE_EXPAND_ALL' });
    }, []),

    setSelectedAccount: useCallback((accountId: string | null) => {
      dispatch({ type: 'SET_SELECTED_ACCOUNT', payload: accountId });
    }, []),

    setSort: useCallback((field: SortField) => {
      dispatch({ type: 'SET_SORT', payload: { field, direction: 'asc' } }); // Simplified
    }, []),

    setRebalanceModal: useCallback((open: boolean) => {
      dispatch({ type: 'SET_REBALANCE_MODAL', payload: open });
    }, []),

    handleRebalance: useCallback(
      async (
        method: 'allocation' | 'tlhSwap' | 'tlhRebalance' | 'investCash',
        cashAmount?: number,
      ) => {
        dispatch({ type: 'START_REBALANCE' });
        try {
          const result = await rebalancePortfolioServerFn({
            data: {
              portfolioId: groupId,
              method,
              cashAmount,
            },
          });
          dispatch({ type: 'REBALANCE_SUCCESS', payload: result });
          return result;
        } catch (error) {
          dispatch({ type: 'REBALANCE_ERROR', payload: error });
          throw error;
        }
      },
      [groupId],
    ),

    handlePriceSync: useCallback(async () => {
      dispatch({ type: 'START_PRICE_SYNC' });
      try {
        const result = await syncSchwabPricesServerFn({
          data: {
            symbols: [], // Would need to pass actual symbols, but this is a placeholder
          },
        });
        dispatch({ type: 'PRICE_SYNC_SUCCESS' });
        return result;
      } catch (error) {
        dispatch({ type: 'PRICE_SYNC_ERROR', payload: error });
        throw error;
      }
    }, []),

    updateTrades: useCallback((trades: typeof state.trades) => {
      dispatch({ type: 'UPDATE_TRADES', payload: trades });
    }, []),

    handleTradeQtyChange: useCallback((ticker: string, qty: number) => {
      dispatch({ type: 'HANDLE_TRADE_QTY_CHANGE', payload: { ticker, qty } });
    }, []),

    // Modal actions
    openEditModal: useCallback(() => dispatch({ type: 'OPEN_EDIT_MODAL' }), []),
    closeEditModal: useCallback(() => dispatch({ type: 'CLOSE_EDIT_MODAL' }), []),
    openDeleteModal: useCallback(() => dispatch({ type: 'OPEN_DELETE_MODAL' }), []),
    closeDeleteModal: useCallback(() => dispatch({ type: 'CLOSE_DELETE_MODAL' }), []),
    openSecurityModal: useCallback(
      (ticker: string) => dispatch({ type: 'OPEN_SECURITY_MODAL', payload: ticker }),
      [],
    ),
    closeSecurityModal: useCallback(() => dispatch({ type: 'CLOSE_SECURITY_MODAL' }), []),
    openSleeveModal: useCallback(
      (sleeveId: string) => dispatch({ type: 'OPEN_SLEEVE_MODAL', payload: sleeveId }),
      [],
    ),
    closeSleeveModal: useCallback(() => dispatch({ type: 'CLOSE_SLEEVE_MODAL' }), []),

    // Utility actions
    refreshData: useCallback(() => {
      queryInvalidators.rebalancing.groups.detail(queryClient, groupId);
    }, [queryClient, groupId]),
  };

  return {
    // State
    data: state.data,
    ui: state.ui,
    mutations: state.mutations,
    trades: state.trades,
    modals: state.modals,

    // Computed values
    availableCash,
    isLoading: false, // Would be derived from data loading state
    isRebalancing: state.mutations.rebalance.isPending,
    isSyncingPrices: state.mutations.syncPrices.isPending,

    // Actions
    ...actions,
  };
}
