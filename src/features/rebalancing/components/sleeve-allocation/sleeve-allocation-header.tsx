import { LoaderCircle, Target } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

interface SleeveAllocationHeaderProps {
  onRebalance?: () => void;
  isRebalancing?: boolean;
  addToBlotter?: {
    onClick: () => void;
    disabled?: boolean;
    visible?: boolean;
    count?: number;
  };
}

export const SleeveAllocationHeader: React.FC<SleeveAllocationHeaderProps> = ({
  onRebalance,
  isRebalancing = false,
  addToBlotter,
}) => {
  // Show "Add to Blotter" button when there are trades (active rebalance)
  return (
    <CardHeader className="pb-0">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Rebalance Summary
          </CardTitle>
          <CardDescription>Generate trade recommendations for the group</CardDescription>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {onRebalance && (
            <Button onClick={onRebalance} disabled={isRebalancing}>
              {isRebalancing ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Rebalancing...
                </>
              ) : (
                'Rebalance'
              )}
            </Button>
          )}
          {addToBlotter?.visible && (
            <Button onClick={addToBlotter.onClick} disabled={!!addToBlotter.disabled}>
              {addToBlotter.disabled
                ? 'Adding...'
                : addToBlotter.count && addToBlotter.count > 0
                  ? `Add ${addToBlotter.count} Trades to Blotter`
                  : 'Add Trades to Blotter'}
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
  );
};
