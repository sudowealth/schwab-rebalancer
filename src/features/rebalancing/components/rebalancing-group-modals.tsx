import { useRebalancingActions } from '../contexts/rebalancing-actions-context';
import { useRebalancingData } from '../contexts/rebalancing-data-context';
import { useRebalancingUI } from '../contexts/rebalancing-ui-context';
import { RebalanceModal } from './rebalance-modal';

/**
 * Pure UI component for managing all rebalancing group modals
 * Consolidates modal state and rendering in one place
 */
export function RebalancingGroupModals() {
  const { data, availableCash } = useRebalancingData();
  const { ui, setRebalanceModal } = useRebalancingUI();
  const { handleRebalance, handlePriceSync, isRebalancing, isSyncingPrices } =
    useRebalancingActions();

  if (!data) {
    return null;
  }

  return (
    <>
      {/* Rebalance Modal */}
      <RebalanceModal
        open={ui.rebalanceModalOpen}
        onOpenChange={setRebalanceModal}
        onGenerateTrades={async () => {
          await handleRebalance('allocation');
        }}
        onFetchPrices={() => {
          handlePriceSync().catch(console.error);
        }}
        isLoading={isRebalancing}
        availableCash={availableCash}
        isSyncing={isSyncingPrices}
        syncMessage={
          isSyncingPrices
            ? 'Fetching updated security prices. Once completed, the rebalance will begin automatically.'
            : undefined
        }
      />

      {/* Other modals can be added here as needed */}
      {/* Group edit/delete modals, security modals, sleeve modals, etc. */}
    </>
  );
}
