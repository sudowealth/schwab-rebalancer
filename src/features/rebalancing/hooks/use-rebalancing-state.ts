import { useState } from 'react';

/**
 * UI state management hook for rebalancing operations.
 * Focuses on UI state, not mutation states which are handled by TanStack Query.
 */
export function useRebalancingState() {
  const [rebalanceModalOpen, setRebalanceModalOpen] = useState(false);

  return {
    // Modal state
    rebalanceModalOpen,
    setRebalanceModalOpen,
  };
}
