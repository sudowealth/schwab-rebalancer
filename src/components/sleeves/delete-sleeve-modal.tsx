import { useRouter } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import type { Sleeve } from '~/lib/schemas';
import { deleteSleeveServerFn, getSleeveHoldingsInfoServerFn } from '~/lib/server-functions';

interface DeleteSleeveModalProps {
  isOpen: boolean;
  onClose: () => void;
  sleeve: Sleeve | null;
}

export function DeleteSleeveModal({ isOpen, onClose, sleeve }: DeleteSleeveModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [holdingsInfo, setHoldingsInfo] = useState<{
    hasHoldings: boolean;
    holdingTicker?: string;
    holdingValue?: number;
  } | null>(null);
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const router = useRouter();

  // Load holdings information when sleeve changes
  useEffect(() => {
    const loadHoldingsInfo = async () => {
      if (!sleeve) {
        setHoldingsInfo(null);
        return;
      }

      setLoadingHoldings(true);
      try {
        const info = await getSleeveHoldingsInfoServerFn({
          data: { sleeveId: sleeve.id },
        });
        setHoldingsInfo(info);
      } catch (err) {
        console.error('Failed to load holdings info:', err);
        setHoldingsInfo({ hasHoldings: false });
      } finally {
        setLoadingHoldings(false);
      }
    };

    if (isOpen && sleeve) {
      loadHoldingsInfo();
    }
  }, [sleeve, isOpen]);

  const handleDelete = async () => {
    if (!sleeve) {
      setError('No sleeve selected for deletion');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await deleteSleeveServerFn({
        data: {
          sleeveId: sleeve.id,
        },
      });

      onClose();
      router.invalidate(); // Refresh the data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sleeve');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setHoldingsInfo(null);
    onClose();
  };

  if (!sleeve) {
    return null;
  }

  const hasHoldings = holdingsInfo?.hasHoldings || false;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span>Delete Sleeve</span>
          </DialogTitle>
          <DialogDescription>
            {hasHoldings
              ? `Delete sleeve "${sleeve.name}" and unassign its active holdings?`
              : `Are you sure you want to delete the sleeve "${sleeve.name}"?`}{' '}
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadingHoldings && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm text-gray-600">Loading holdings information...</p>
            </div>
          )}

          {!loadingHoldings && hasHoldings && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Warning: Active Holdings Detected</p>
                  <p>
                    This sleeve has an active position in {holdingsInfo?.holdingTicker}
                    {holdingsInfo?.holdingValue &&
                      ` (value: $${holdingsInfo.holdingValue.toLocaleString()})`}
                    .
                  </p>
                  <p className="mt-2">
                    <strong>If you proceed:</strong>
                  </p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>The sleeve configuration will be deleted</li>
                    <li>The position will become "unassigned" (no sleeve)</li>
                    <li>Transaction history will be preserved</li>
                    <li>You can still manage the position from the Positions page</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!loadingHoldings && (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">
                  <strong>Sleeve Members:</strong>
                </p>
                <ul className="text-sm text-gray-500 list-disc list-inside">
                  {sleeve.members
                    ?.sort((a, b) => a.rank - b.rank)
                    .map((member) => (
                      <li key={member.id}>
                        Rank {member.rank}: {member.ticker}
                      </li>
                    ))}
                </ul>
              </div>

              {!hasHoldings && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> Any transaction history associated with this sleeve will
                    be preserved. Only the sleeve and its member configuration will be deleted.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || loadingHoldings}
          >
            {isLoading ? 'Deleting...' : hasHoldings ? 'Delete Anyway' : 'Delete Sleeve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
