import { useEffect, useId, useState } from 'react';
import type { RebalanceMethod } from '../../types/rebalance';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface RebalanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateTrades: (
    method: RebalanceMethod,
    cashAmount?: number,
    fetchPricesSelected?: boolean,
  ) => void;
  onFetchPrices: () => void | Promise<void>;
  isLoading?: boolean;
  availableCash?: number;
  isSyncing?: boolean;
  syncMessage?: string;
}

export function RebalanceModal({
  open,
  onOpenChange,
  onGenerateTrades,
  onFetchPrices,
  isLoading = false,
  availableCash = 0,
  isSyncing = false,
  syncMessage,
}: RebalanceModalProps) {
  const [method, setMethod] = useState<RebalanceMethod>('allocation');
  const [cashAmount, setCashAmount] = useState<string>(availableCash.toString());
  const [fetchPrices, setFetchPrices] = useState<boolean>(false);
  const cashAmountId = useId();
  const fetchPricesId = useId();

  // Update cash amount when availableCash changes or when switching to investCash
  useEffect(() => {
    if (method === 'investCash') {
      setCashAmount(availableCash.toString());
    }
  }, [method, availableCash]);

  const handleGenerateTrades = () => {
    const parsedCashAmount =
      method === 'investCash' ? Number.parseFloat(cashAmount) || 0 : undefined;
    onGenerateTrades(method, parsedCashAmount, fetchPrices);
    // If user opted to fetch prices and syncing is still in progress, keep modal open to show warning
    if (!(fetchPrices && isSyncing)) {
      onOpenChange(false);
    }
  };

  const methodOptions = {
    allocation: {
      label: 'Allocation',
      description: 'Rebalance to target weights',
    },
    tlhSwap: {
      label: 'TLH Swap',
      description: 'Harvest losses and swap securities',
    },
    tlhRebalance: {
      label: 'TLH + Rebalance',
      description: 'Harvest losses and rebalance',
    },
    investCash: {
      label: 'Invest Cash',
      description: 'Invest cash from most underweight to most overweight sleeve',
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rebalance Portfolio</DialogTitle>
          <DialogDescription>
            Choose a rebalancing method to generate trade suggestions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Method</Label>
            <Select
              value={method}
              onValueChange={(value: string) => {
                const newMethod = value as RebalanceMethod;
                setMethod(newMethod);
                // Auto-populate cash amount when switching to investCash
                if (newMethod === 'investCash' && cashAmount === '') {
                  setCashAmount(availableCash.toString());
                }
              }}
            >
              <SelectTrigger>
                <SelectValue asChild>
                  <span>{methodOptions[method].label}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(methodOptions).map(([value, option]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {method === 'investCash' && (
            <div className="space-y-2">
              <Label htmlFor={cashAmountId}>Cash Amount</Label>
              <Input
                id={cashAmountId}
                type="number"
                step="0.01"
                min="0"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="Enter amount to invest"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Available cash: ${availableCash.toLocaleString()}
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id={fetchPricesId}
              checked={fetchPrices}
              onCheckedChange={(checked) => {
                const next = Boolean(checked);
                setFetchPrices(next);
                if (next) {
                  onFetchPrices();
                }
              }}
              disabled={isLoading}
            />
            <Label htmlFor={fetchPricesId} className="cursor-pointer">
              Refresh prices
            </Label>
          </div>
          {syncMessage && <p className="text-xs text-amber-600">{syncMessage}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerateTrades} disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate Trades'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
