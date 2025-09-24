import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import type { RebalancingGroup } from '~/features/auth/schemas';
import { queryInvalidators } from '~/lib/query-keys';
import { deleteRebalancingGroupServerFn } from '~/lib/server-functions';

interface DeleteRebalancingGroupModalProps {
  group: RebalancingGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
}

export function DeleteRebalancingGroupModal({
  group,
  open,
  onOpenChange,
  onClose,
}: DeleteRebalancingGroupModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    setIsLoading(true);
    setError('');

    try {
      await deleteRebalancingGroupServerFn({
        data: {
          groupId: group.id,
        },
      });

      // Invalidate all queries affected by group deletion
      queryInvalidators.composites.afterRebalancingGroupDelete(queryClient);

      // Invalidate route loader data to ensure dashboard refreshes
      router.invalidate();

      onClose?.();

      // Navigate to groups list page to avoid errors on deleted group page
      router.navigate({ to: '/rebalancing-groups' });
    } catch (err: unknown) {
      console.error('Failed to delete rebalancing group:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete rebalancing group');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setError('');
      onClose?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <DialogTitle>Delete Rebalancing Group</DialogTitle>
          </div>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the rebalancing group, remove
            all account memberships, and unassign any models from it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">Group: {group.name}</div>
            <div className="text-sm text-gray-600">
              • {group.members.length} account{group.members.length !== 1 ? 's' : ''}
            </div>
            {group.assignedModel && (
              <div className="text-sm text-gray-600">
                • Assigned model: {group.assignedModel.name}
              </div>
            )}
          </div>

          <div className="bg-red-50 p-3 rounded-lg">
            <div className="text-sm text-red-800">
              <strong>Warning:</strong> Deleting this group will:
            </div>
            <ul className="text-sm text-red-700 mt-1 list-disc list-inside">
              <li>Permanently delete the group "{group.name}"</li>
              <li>Remove all account memberships</li>
              {group.assignedModel && <li>Unassign the model "{group.assignedModel.name}"</li>}
              <li>All data will be permanently lost</li>
            </ul>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Delete Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
