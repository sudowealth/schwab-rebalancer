import { useState } from 'react';
import type { Trade } from '../components/rebalancing-groups/sleeve-allocation/sleeve-allocation-types';
import type { RebalanceMethod } from '../types/rebalance';

export function useRebalancingState() {
  const [rebalanceModalOpen, setRebalanceModalOpen] = useState(false);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [waitingForSync, setWaitingForSync] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<RebalanceMethod | null>(null);
  const [pendingCashAmount, setPendingCashAmount] = useState<number | undefined>(undefined);
  const [rebalanceTrades, setRebalanceTrades] = useState<Trade[]>([]);

  return {
    rebalanceModalOpen,
    setRebalanceModalOpen,
    rebalanceLoading,
    setRebalanceLoading,
    syncingPrices,
    setSyncingPrices,
    waitingForSync,
    setWaitingForSync,
    pendingMethod,
    setPendingMethod,
    pendingCashAmount,
    setPendingCashAmount,
    rebalanceTrades,
    setRebalanceTrades,
  };
}
