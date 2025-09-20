import { useId, useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  marketPrice: number; // basis price used for calculation
  onApply: (qty: number) => void;
  basisLabel?: string; // e.g., "Market" | "Limit"
};

export function QuantityCalculatorModal({
  open,
  onOpenChange,
  marketPrice,
  onApply,
  basisLabel = 'Market',
}: Props) {
  const [dollars, setDollars] = useState<number>(0);
  const amountId = `${useId()}-amount`;
  const basisId = `${useId()}-basis`;

  const estShares = useMemo(() => {
    if (!marketPrice || marketPrice <= 0) return 0;
    // Round down to whole shares
    return Math.floor(dollars / marketPrice) || 0;
  }, [dollars, marketPrice]);

  const estAmount = useMemo(() => estShares * marketPrice || 0, [estShares, marketPrice]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calculate number of shares</DialogTitle>
          <DialogDescription className="sr-only">
            Enter an investment amount to calculate the number of shares you can purchase.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor={amountId}>
              Enter $ amount you want to invest
            </label>
            <Input
              id={amountId}
              type="number"
              className="mt-1"
              value={Number.isFinite(dollars) ? String(dollars) : ''}
              onChange={(e) => setDollars(Number.parseFloat(e.target.value) || 0)}
              min={0}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor={basisId}>
              Based on price ({basisLabel})
            </label>
            <Input
              id={basisId}
              className="mt-1"
              value={marketPrice ? marketPrice.toFixed(2) : '-'}
              readOnly
              disabled
            />
          </div>
          <div className="text-sm">
            <div className="flex items-center justify-between py-1">
              <span>Estimated number of shares:</span>
              <span className="font-medium">{estShares}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Estimated amount:</span>
              <span className="font-medium">
                $
                {estAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="h-8 px-3 py-1 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="h-8 px-3 py-1 text-xs"
            onClick={() => {
              onApply(estShares);
              onOpenChange(false);
            }}
            disabled={!marketPrice || marketPrice <= 0}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
