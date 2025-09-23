import type {
  Position,
  RebalancingGroup,
  Trade as SchemaTrade,
  SP500Stock,
  Transaction,
} from '~/features/auth/schemas';
import { SecurityModal } from '~/features/dashboard/components/security-modal';
import { SleeveModal } from '~/features/dashboard/components/sleeve-modal';
import type { useGroupModals } from '../hooks/use-group-modals';
import { DeleteRebalancingGroupModal } from './delete-rebalancing-group-modal';
import { EditRebalancingGroupModal } from './edit-rebalancing-group-modal';

interface GroupModalsProps {
  group: RebalancingGroup;
  sp500Data: SP500Stock[];
  positions?: Position[];
  transactions?: Transaction[];
  proposedTrades?: SchemaTrade[];
  modals: ReturnType<typeof useGroupModals>;
}

export function GroupModals({
  group,
  sp500Data,
  positions,
  transactions,
  proposedTrades,
  modals,
}: GroupModalsProps) {
  return (
    <>
      <EditRebalancingGroupModal
        group={group}
        open={modals.editModalOpen}
        onOpenChange={modals.setEditModalOpen}
        onClose={modals.handleEditModalClose}
      />

      <DeleteRebalancingGroupModal
        group={group}
        open={modals.deleteModalOpen}
        onOpenChange={modals.setDeleteModalOpen}
        onClose={modals.handleDeleteModalClose}
      />

      <SecurityModal
        isOpen={modals.showSecurityModal}
        onClose={modals.closeSecurityModal}
        ticker={modals.selectedTicker}
        sp500Data={sp500Data}
        positions={positions}
        transactions={transactions}
        proposedTrades={proposedTrades}
      />

      <SleeveModal
        isOpen={modals.showSleeveModal}
        onClose={modals.closeSleeveModal}
        sleeve={modals.selectedSleeve ? modals.getSleeveForModal(modals.selectedSleeve) : null}
      />
    </>
  );
}
