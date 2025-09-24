import { useMemo } from 'react';
import type { RebalancingGroupPageData } from '~/features/rebalancing/server/groups.server';
import { useGroupMutations } from './use-group-mutations';
import { useRebalancingGroupQuery } from './use-rebalancing-group-query';
import { useRebalancingGroupState } from './use-rebalancing-group-state';

/**
 * Simplified rebalancing group hook that follows TanStack Start best practices
 *
 * - React Query for server state (data fetching, caching, invalidation)
 * - Simple useState for UI state (no complex reducer)
 * - Mutations through React Query
 */
export function useRebalancingGroup(groupId: string, initialData?: RebalancingGroupPageData) {
  // Server state via React Query
  const query = useRebalancingGroupQuery(groupId, initialData);

  // UI state via simple useState hooks
  const { uiState, modalState, trades, uiActions, tradeActions } =
    useRebalancingGroupState(groupId);

  // Mutations via React Query (need to pass account/holdings data)
  const mutations = useGroupMutations({
    groupId,
    accountHoldings: query.data?.accountHoldings || [],
    sleeveMembers: query.data?.sleeveMembers || [],
    onTradesUpdate: tradeActions.updateTrades,
  });

  // Computed values
  const availableCash = useMemo(() => {
    if (!query.data) return 0;
    return query.data.accountHoldings.reduce(
      (total: number, account: { accountBalance?: number }) => {
        return total + (account.accountBalance || 0);
      },
      0,
    );
  }, [query.data]);

  return {
    // Server state
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,

    // UI state
    ui: uiState,
    modals: modalState,
    trades,

    // Computed values
    availableCash,

    // Actions
    mutations,
    uiActions,
    tradeActions,
  };
}
