import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { queryInvalidators } from '~/lib/query-keys';
import type { SleeveMember } from '../server/groups.server';
import { useModalState } from './use-modal-state';

export function useGroupModals(groupId: string, sleeveMembers?: SleeveMember[]) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const modalState = useModalState();

  // Memoized event handlers to prevent unnecessary re-renders
  const handleEditModalClose = useCallback(() => {
    modalState.closeEditModal();
    console.log('✏️ [GroupComponent] Group edit completed, refreshing data...');
    queryInvalidators.rebalancing.groups.detail(queryClient, groupId);
  }, [modalState, queryClient, groupId]);

  const handleDeleteModalClose = useCallback(() => {
    modalState.closeDeleteModal();
    router.navigate({ to: '/rebalancing-groups' });
  }, [modalState, router]);

  // Convert sleeve members data to format expected by SleeveModal
  const getSleeveForModal = useCallback(
    (sleeveId: string) => {
      const sleeveData = sleeveMembers?.find((s) => s.sleeveId === sleeveId);
      if (!sleeveData) return null;

      return {
        id: sleeveData.sleeveId,
        name: sleeveData.sleeveName,
        members:
          sleeveData.members?.map((member) => ({
            id: member.id,
            ticker: member.ticker,
            rank: member.rank || 1,
            isActive: member.isActive,
            isLegacy: false, // We don't have this data in our current structure
          })) || [],
        position: null, // We don't have position data in the sleeve members structure
      };
    },
    [sleeveMembers],
  );

  return {
    ...modalState,
    handleEditModalClose,
    handleDeleteModalClose,
    getSleeveForModal,
  };
}
