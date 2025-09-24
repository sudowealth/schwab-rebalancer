import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { AlertTriangle, Users } from 'lucide-react';
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
import type { Model } from '~/features/auth/schemas';
import { queryInvalidators } from '~/lib/query-keys';
import { deleteModelServerFn } from '~/lib/server-functions';

interface DeleteModelModalProps {
  model: Model | null;
  rebalancingGroups?: Array<{ id: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export function DeleteModelModal({
  model,
  rebalancingGroups: propRebalancingGroups = [],
  open,
  onOpenChange,
  onClose,
}: DeleteModelModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();

  const handleDelete = async () => {
    if (!model) {
      setError('No model selected for deletion');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await deleteModelServerFn({
        data: {
          modelId: model.id,
        },
      });

      // Invalidate all queries affected by model deletion
      queryInvalidators.composites.afterModelOperation(queryClient);

      // Invalidate route loaders that depend on models
      router.invalidate();

      // Navigate to models list page
      navigate({ to: '/models', replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!model) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            Delete Model
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the model "{model.name}"?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {propRebalancingGroups.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-start">
                <Users className="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 mb-2">
                    Deleting this model will leave the following rebalancing groups without a model
                    assigned:
                  </p>
                  <ul className="text-xs text-red-700 space-y-1 mb-2 list-disc list-inside">
                    {propRebalancingGroups.slice(0, 5).map((group) => (
                      <li key={group.id} className="font-medium">
                        {group.name}
                      </li>
                    ))}
                    {propRebalancingGroups.length > 5 && (
                      <li className="text-red-600">
                        ... and {propRebalancingGroups.length - 5} more
                      </li>
                    )}
                  </ul>
                  <p className="text-xs text-red-700">
                    <strong>Recommendation:</strong> Change the model assignment for these groups
                    before deleting this model, or reassign them to a different model afterward.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Delete Model'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
