import { Calculator } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { Order, OrderTypeSchema } from '~/lib/schemas';
import { previewOrderServerFn, updateOrderServerFn } from '~/lib/server-functions';
import { QuantityCalculatorModal } from './quantity-calculator-modal';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: Order | null;
  onSaved?: (opts?: { openPreviewForId?: string }) => void;
  prices?: Record<string, number>;
};

export function EditOrderModal({ open, onOpenChange, order, onSaved, prices }: Props) {
  const symbolId = `${useId()}-symbol`;
  const qtyId = `${useId()}-qty`;
  const limitId = `${useId()}-limit`;
  const stopId = `${useId()}-stop`;
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState<number>(0);
  const [type, setType] = useState<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT'>('MARKET');
  const [limit, setLimit] = useState<number | ''>('');
  const [stop, setStop] = useState<number | ''>('');
  // Enforced values (hidden): TIF=DAY, Session=NORMAL
  const [saving, setSaving] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    if (!order) return;
    setSymbol(order.symbol);
    setSide(order.side as 'BUY' | 'SELL');
    setQty(order.qty || 0);
    setType(order.type as z.infer<typeof OrderTypeSchema>);
    setLimit(order.limit ?? '');
    setStop(order.stop ?? '');
    // Always enforce DAY/NORMAL regardless of stored values
  }, [order]);

  // Est. Price should reflect current market price and not change when editing limit/stop
  const estPrice = useMemo(() => {
    return prices?.[symbol] ?? 0;
  }, [symbol, prices]);

  const estValue = useMemo(() => (qty || 0) * (estPrice || 0), [qty, estPrice]);

  // Default/adjust Limit price ±5% based on side; update when side changes
  const prevSideRef = useRef<'BUY' | 'SELL'>(side);
  useEffect(() => {
    const current = prices?.[symbol] ?? 0;
    if (!current) return;
    if (type === 'LIMIT' || type === 'STOP_LIMIT') {
      const suggested = side === 'BUY' ? current * 0.95 : current * 1.05;
      const shouldSet = limit === '' || typeof limit !== 'number' || prevSideRef.current !== side;
      if (shouldSet) {
        setLimit(Number(suggested.toFixed(2)));
      }
    }
    prevSideRef.current = side;
  }, [type, side, symbol, prices, limit]);

  const onSave = async () => {
    if (!order) return;
    try {
      setSaving(true);
      await updateOrderServerFn({
        data: {
          id: order.id,
          updates: {
            // Symbol is not editable
            side,
            qty,
            type,
            limit: typeof limit === 'number' ? limit : null,
            stop: typeof stop === 'number' ? stop : null,
            tif: 'DAY',
            session: 'NORMAL',
          },
        },
      });
      // Immediately run preview; show details regardless of OK/WARN/ERROR
      try {
        await previewOrderServerFn({ data: { id: order.id } });
      } catch (e) {
        console.error('Preview error after edit:', e);
      }
      onOpenChange(false);
      onSaved?.({ openPreviewForId: order.id });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('orders:refresh', { detail: { groupId: undefined } }));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription className="sr-only">
              Modify order details including symbol, quantity, and pricing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-medium" htmlFor={symbolId}>
                  Symbol
                </label>
                <Input id={symbolId} value={symbol} readOnly disabled />
              </div>
              <div>
                <div className="text-xs font-medium">Side</div>
                <Select value={side} onValueChange={(v) => setSide(v as 'BUY' | 'SELL')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Side" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium" htmlFor={qtyId}>
                  Qty
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id={qtyId}
                    type="number"
                    value={Number.isFinite(qty) ? String(qty) : ''}
                    onChange={(e) => setQty(Number.parseFloat(e.target.value) || 0)}
                  />
                  <button
                    type="button"
                    aria-label="Open calculator"
                    title="Calculate shares"
                    onClick={() => setCalcOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 hover:bg-gray-100"
                  >
                    <Calculator className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium">Type</div>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as z.infer<typeof OrderTypeSchema>)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKET">Market</SelectItem>
                    <SelectItem value="LIMIT">Limit</SelectItem>
                    <SelectItem value="STOP">Stop</SelectItem>
                    <SelectItem value="STOP_LIMIT">Stop Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === 'LIMIT' && (
                <div>
                  <label className="text-xs font-medium" htmlFor={limitId}>
                    Limit Price
                  </label>
                  <Input
                    id={limitId}
                    type="number"
                    value={typeof limit === 'number' ? String(limit) : ''}
                    onChange={(e) =>
                      setLimit(e.target.value === '' ? '' : Number.parseFloat(e.target.value))
                    }
                  />
                </div>
              )}
              {type === 'STOP' && (
                <div>
                  <label className="text-xs font-medium" htmlFor={stopId}>
                    Stop Price
                  </label>
                  <Input
                    id={stopId}
                    type="number"
                    value={typeof stop === 'number' ? String(stop) : ''}
                    onChange={(e) =>
                      setStop(e.target.value === '' ? '' : Number.parseFloat(e.target.value))
                    }
                  />
                </div>
              )}
              {type === 'STOP_LIMIT' && (
                <>
                  <div>
                    <label className="text-xs font-medium" htmlFor={limitId}>
                      Limit Price
                    </label>
                    <Input
                      id={limitId}
                      type="number"
                      value={typeof limit === 'number' ? String(limit) : ''}
                      onChange={(e) =>
                        setLimit(e.target.value === '' ? '' : Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium" htmlFor={stopId}>
                      Stop Price
                    </label>
                    <Input
                      id={stopId}
                      type="number"
                      value={typeof stop === 'number' ? String(stop) : ''}
                      onChange={(e) =>
                        setStop(e.target.value === '' ? '' : Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                </>
              )}
              {/* TIF and Session are hidden and enforced as DAY/NORMAL */}
            </div>
            <div className="text-xs text-gray-600">
              Est. Price:{' '}
              {estPrice
                ? `$${estPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                : '-'}
            </div>
            <div className="text-xs text-gray-600">
              Est. Value:{' '}
              {estValue
                ? `$${estValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '-'}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 py-1 text-xs"
            >
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving} className="h-8 px-3 py-1 text-xs">
              {saving ? 'Previewing...' : 'Preview'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuantityCalculatorModal
        open={calcOpen}
        onOpenChange={setCalcOpen}
        marketPrice={
          type === 'LIMIT' && typeof limit === 'number' && limit > 0 ? limit : estPrice || 0
        }
        basisLabel={type === 'LIMIT' ? 'Limit' : 'Market'}
        onApply={(newQty) => setQty(newQty)}
      />
    </>
  );
}
