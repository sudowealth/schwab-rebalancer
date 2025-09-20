import type { RebalanceMethod } from '~/types/rebalance';
import { OrdersBlotter } from './blotter/orders-blotter';
import { RebalanceModal } from './rebalance-modal';

interface TradeManagementProps {
  groupId: string;
  prices: Record<string, number>;
  accounts: Record<string, { name: string; number?: string | null }>;
  rebalanceModalOpen: boolean;
  rebalanceLoading: boolean;
  availableCash: number;
  syncingPrices: boolean;
  waitingForSync: boolean;
  onPricesUpdated: () => void;
  onRebalanceModalChange: (open: boolean) => void;
  onGenerateTrades: (
    method: RebalanceMethod,
    cashAmount?: number,
    fetchPricesSelected?: boolean,
  ) => void;
  onFetchPrices: () => void;
}

export function TradeManagement({
  groupId,
  prices,
  accounts,
  rebalanceModalOpen,
  rebalanceLoading,
  availableCash,
  syncingPrices,
  waitingForSync,
  onPricesUpdated,
  onRebalanceModalChange,
  onGenerateTrades,
  onFetchPrices,
}: TradeManagementProps) {
  return (
    <>
      {/* Trade Blotter */}
      <OrdersBlotter
        groupId={groupId}
        prices={prices}
        accounts={accounts}
        onPricesUpdated={onPricesUpdated}
      />

      {/* Rebalance Modal */}
      <RebalanceModal
        open={rebalanceModalOpen}
        onOpenChange={onRebalanceModalChange}
        onGenerateTrades={onGenerateTrades}
        onFetchPrices={onFetchPrices}
        isLoading={rebalanceLoading}
        availableCash={availableCash}
        isSyncing={syncingPrices}
        syncMessage={
          waitingForSync && syncingPrices
            ? 'Fetching updated security prices. Once completed, the rebalance will begin automatically.'
            : undefined
        }
      />
    </>
  );
}
