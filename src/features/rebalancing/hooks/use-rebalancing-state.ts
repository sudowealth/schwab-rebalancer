import { useState } from 'react';
import type { Trade } from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-types';

/**
 * UI state management hook for rebalancing operations.
 * Focuses on UI state, not mutation states which are handled by TanStack Query.
 */
export function useRebalancingState() {
  const [rebalanceModalOpen, setRebalanceModalOpen] = useState(false);
  const [rebalanceTrades, setRebalanceTrades] = useState<Trade[]>([]);

  return {
    // Modal state
    rebalanceModalOpen,
    setRebalanceModalOpen,

    // Trade data (managed separately from mutations)
    rebalanceTrades,
    setRebalanceTrades,
  };
}
