import { useRebalancingData } from '../contexts/rebalancing-data-context';
import { useRebalancingUI } from '../contexts/rebalancing-ui-context';
import { GroupHeader } from './group-header';

/**
 * Pure UI component for the rebalancing group header section
 * Only handles UI rendering, no business logic
 */
export function RebalancingGroupHeader() {
  const { data } = useRebalancingData();
  const { openEditModal, openDeleteModal } = useRebalancingUI();

  if (!data) {
    return null;
  }

  const { group } = data;

  // Transform null assignedModel to undefined for type compatibility
  const groupForHeader = {
    ...group,
    assignedModel: group.assignedModel || undefined,
  };

  return <GroupHeader group={groupForHeader} onEdit={openEditModal} onDelete={openDeleteModal} />;
}
