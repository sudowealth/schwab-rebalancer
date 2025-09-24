import { useRebalancingActions } from '../contexts/rebalancing-actions-context';
import { useRebalancingData } from '../contexts/rebalancing-data-context';
import { useRebalancingUI } from '../contexts/rebalancing-ui-context';
import { DeleteRebalancingGroupModal } from './delete-rebalancing-group-modal';
import { EditRebalancingGroupModal } from './edit-rebalancing-group-modal';
import { RebalanceModal } from './rebalance-modal';

/**
 * Pure UI component for managing all rebalancing group modals
 * Consolidates modal state and rendering in one place
 */
export function RebalancingGroupModals() {
  const { data, availableCash } = useRebalancingData();
  const { ui, setRebalanceModal, closeEditModal, closeDeleteModal } = useRebalancingUI();
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
          handlePriceSync();
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

      {/* Edit Group Modal */}
      <EditRebalancingGroupModal
        open={ui.editGroup}
        onOpenChange={closeEditModal}
        group={data.group}
      />

      {/* Delete Group Modal */}
      <DeleteRebalancingGroupModal
        open={ui.deleteGroup}
        onOpenChange={closeDeleteModal}
        group={data.group}
      />
    </>
  );
}
