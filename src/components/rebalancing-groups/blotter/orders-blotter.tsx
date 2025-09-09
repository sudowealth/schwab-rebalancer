import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  Eye,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Order } from '../../../lib/schemas';
import {
  deleteOrderServerFn,
  getGroupOrdersServerFn,
  previewOrderServerFn,
  submitOrderServerFn,
} from '../../../lib/server-functions';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { EditOrderModal } from './edit-order-modal';

const BUCKETS: Record<string, string[]> = {
  Draft: ['DRAFT'],
  Pending_Clear: ['PREVIEW_OK'],
  Pending_Warn: ['PREVIEW_WARN'],
  Pending_Error: ['PREVIEW_ERROR'],
  Open: ['ACCEPTED', 'WORKING', 'PARTIALLY_FILLED', 'REPLACED'],
  Done: ['FILLED', 'CANCELED'],
  Failed: ['REJECTED', 'EXPIRED'],
} as const;

type BucketKey = keyof typeof BUCKETS;

function summarize(orders: Array<Pick<Order, 'status'>>) {
  const c = (s: readonly string[]) => orders.filter((o) => s.includes(o.status)).length;
  const draft = c(BUCKETS.Draft);
  const pendingClear = c(BUCKETS.Pending_Clear);
  const pendingWarn = c(BUCKETS.Pending_Warn);
  const pendingErr = c(BUCKETS.Pending_Error);
  const open = c(BUCKETS.Open);
  const done = c(BUCKETS.Done);
  const failed = c(BUCKETS.Failed);
  return {
    draft,
    pending: {
      total: pendingClear + pendingWarn + pendingErr,
      clear: pendingClear,
      warn: pendingWarn,
      error: pendingErr,
    },
    open,
    done,
    failed,
  };
}

function StatusBadge({ order }: { order: Order }) {
  const s = order.status;
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
  if (s === 'DRAFT') return <span className={`${base} bg-gray-100 text-gray-800`}>Draft</span>;
  if (s === 'PREVIEW_OK')
    return <span className={`${base} bg-green-100 text-green-800`}>Preview OK</span>;
  if (s === 'PREVIEW_WARN')
    return <span className={`${base} bg-yellow-100 text-yellow-800`}>Preview Warn</span>;
  if (s === 'PREVIEW_ERROR')
    return <span className={`${base} bg-red-100 text-red-800`}>Preview Error</span>;
  if (['ACCEPTED', 'WORKING'].includes(s))
    return <span className={`${base} bg-blue-100 text-blue-800`}>Working</span>;
  if (s === 'PARTIALLY_FILLED')
    return <span className={`${base} bg-yellow-100 text-yellow-800`}>Partial</span>;
  if (s === 'FILLED') return <span className={`${base} bg-green-100 text-green-800`}>Filled</span>;
  if (s === 'CANCELED')
    return <span className={`${base} bg-gray-200 text-gray-700`}>Canceled</span>;
  if (s === 'REJECTED') return <span className={`${base} bg-red-100 text-red-800`}>Rejected</span>;
  if (s === 'EXPIRED') return <span className={`${base} bg-gray-200 text-gray-700`}>Expired</span>;
  return <span className={`${base} bg-gray-100 text-gray-800`}>{s}</span>;
}

export function OrdersBlotter({
  groupId,
  prices,
  accounts,
  onPricesUpdated,
}: {
  groupId: string;
  prices?: Record<string, number>;
  accounts?: Record<string, { name: string; number?: string | null }>;
  onPricesUpdated?: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setLoading] = useState(false);
  const [activeBucket, setActiveBucket] = useState<BucketKey | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null);
  const [previewView, setPreviewView] = useState<Order | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [, setLastUpdated] = useState<Date | null>(null);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<null | {
    type: 'submit' | 'submit_buys' | 'submit_sells' | 'delete';
  }>(null);
  const [bulkAction, setBulkAction] = useState<
    null | 'preview' | 'submit' | 'submit_buys' | 'submit_sells' | 'delete'
  >(null);
  const [bulkResultMsg, setBulkResultMsg] = useState<string | null>(null);

  const mergedPrices = useMemo(
    () => ({ ...(prices || {}), ...priceOverrides }),
    [prices, priceOverrides],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const started = Date.now();
    try {
      const data = await getGroupOrdersServerFn({ data: { groupId } });
      const list = data as unknown as Order[];
      setOrders(list);
      setLastUpdated(new Date());
      return list;
    } finally {
      const elapsed = Date.now() - started;
      if (elapsed < 400) {
        await new Promise((r) => setTimeout(r, 400 - elapsed));
      }
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
    // Optionally poll every 30s
    const i = setInterval(load, 30000);
    // Listen for immediate refresh events after adding to blotter
    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail as { groupId?: string } | undefined;
      if (!detail || !detail.groupId || detail.groupId === groupId) {
        load();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('orders:refresh', onRefresh as EventListener);
    }
    return () => {
      clearInterval(i);
      if (typeof window !== 'undefined') {
        window.removeEventListener('orders:refresh', onRefresh as EventListener);
      }
    };
  }, [groupId, load]);

  const summary = useMemo(() => summarize(orders), [orders]);
  const filtered = useMemo(() => {
    if (!activeBucket) return orders;
    const set = new Set(BUCKETS[activeBucket]);
    return orders.filter((o) => set.has(o.status));
  }, [orders, activeBucket]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Trade Blotter</h3>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={bulkBusy}>
                {bulkBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {bulkAction === 'preview' && 'Previewing...'}
                    {bulkAction === 'submit' && 'Submitting...'}
                    {bulkAction === 'delete' && 'Deleting...'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    Bulk Actions <ChevronDown className="ml-1 h-3 w-3" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded disabled:opacity-50"
                disabled={bulkBusy}
                onClick={async () => {
                  setBulkBusy(true);
                  setBulkAction('preview');
                  try {
                    const targets = orders.filter(
                      (o) => o.status === 'DRAFT' || o.status.startsWith('PREVIEW_'),
                    );
                    let ok = 0;
                    for (const o of targets) {
                      try {
                        await previewOrderServerFn({ data: { id: o.id } });
                        ok++;
                      } catch (e) {
                        console.warn(e);
                      }
                    }
                    await load();
                    try {
                      if (onPricesUpdated) onPricesUpdated();
                    } catch (e) {
                      console.warn(e);
                    }
                    setBulkResultMsg(`Previewed ${ok} order${ok === 1 ? '' : 's'}`);
                    setTimeout(() => setBulkResultMsg(null), 4000);
                  } finally {
                    setBulkBusy(false);
                    setBulkAction(null);
                  }
                }}
              >
                <span className="inline-flex items-center gap-2">
                  {bulkBusy && bulkAction === 'preview' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  Preview All
                </span>
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded disabled:opacity-50"
                disabled={bulkBusy}
                onClick={() => setConfirmBulk({ type: 'submit' })}
              >
                <span className="inline-flex items-center gap-2">
                  {bulkBusy && bulkAction === 'submit' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Submit All
                </span>
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded disabled:opacity-50"
                disabled={bulkBusy}
                onClick={() => setConfirmBulk({ type: 'submit_buys' })}
              >
                <span className="inline-flex items-center gap-2">
                  {bulkBusy && bulkAction === 'submit_buys' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4" />
                  )}
                  Submit Buys
                </span>
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded disabled:opacity-50"
                disabled={bulkBusy}
                onClick={() => setConfirmBulk({ type: 'submit_sells' })}
              >
                <span className="inline-flex items-center gap-2">
                  {bulkBusy && bulkAction === 'submit_sells' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4" />
                  )}
                  Submit Sells
                </span>
              </button>
              <div className="my-1 h-px bg-gray-200" />
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded text-red-700 hover:text-red-800 disabled:opacity-50"
                disabled={bulkBusy}
                onClick={() => setConfirmBulk({ type: 'delete' })}
              >
                <span className="inline-flex items-center gap-2">
                  {bulkBusy && bulkAction === 'delete' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete All
                </span>
              </button>
            </PopoverContent>
          </Popover>
          {bulkResultMsg ? (
            <span className="text-xs text-gray-600 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {bulkResultMsg}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant="outline"
          onClick={() => setActiveBucket(null)}
          className="cursor-pointer bg-black text-white hover:bg-gray-800"
        >
          All ({orders.length})
        </Badge>
        <Badge
          variant="outline"
          onClick={() => setActiveBucket('Draft')}
          className="cursor-pointer bg-gray-100 text-gray-800 hover:bg-gray-200"
        >
          Draft ({summary.draft})
        </Badge>
        <Badge
          variant="outline"
          onClick={() => setActiveBucket('Pending_Clear')}
          className="cursor-pointer bg-green-100 text-green-800 hover:bg-green-200"
        >
          Pending {summary.pending.total > 0 ? `(${summary.pending.total})` : '(0)'}
        </Badge>
        <Badge
          variant="outline"
          onClick={() => setActiveBucket('Open')}
          className="cursor-pointer bg-blue-100 text-blue-800 hover:bg-blue-200"
        >
          Open ({summary.open})
        </Badge>
        <Badge
          variant="outline"
          onClick={() => setActiveBucket('Done')}
          className="cursor-pointer bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
        >
          Done ({summary.done})
        </Badge>
        <Badge
          variant="outline"
          onClick={() => setActiveBucket('Failed')}
          className="cursor-pointer bg-red-100 text-red-800 hover:bg-red-200"
        >
          Failed ({summary.failed})
        </Badge>
      </div>

      <Card>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-2">Account</th>
                <th className="p-2">Status</th>
                <th className="p-2">Symbol</th>
                <th className="p-2">Side</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2">Type</th>
                <th className="p-2 text-right">Price</th>
                <th className="p-2 text-right">Est. Value</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                // Est. Value logic per status
                let estValue: number | undefined;
                if (o.status === 'DRAFT') {
                  const px = mergedPrices?.[o.symbol] ?? o.limit ?? o.stop ?? 0;
                  estValue = (o.qty || 0) * (px || 0);
                } else if (typeof o.filledNotional === 'number' && o.filledNotional > 0) {
                  estValue = o.filledNotional;
                } else if (typeof o.previewOrderValue === 'number') {
                  estValue = o.previewOrderValue;
                } else {
                  estValue = (o.qty || 0) * (o.limit || o.stop || 0);
                }
                let displayPrice: string;
                if (o.status === 'DRAFT') {
                  if (o.type === 'MARKET') {
                    const px = mergedPrices?.[o.symbol] ?? 0;
                    displayPrice = px
                      ? px.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })
                      : '-';
                  } else {
                    const px = o.limit ?? o.stop ?? 0;
                    displayPrice = px.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    });
                  }
                } else {
                  displayPrice =
                    o.type === 'MARKET'
                      ? 'MKT'
                      : (o.limit ?? o.stop ?? 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        });
                }
                const acct = accounts?.[o.accountId as string];
                return (
                  <tr key={o.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      {acct ? (
                        <div className="flex flex-col">
                          <span className="font-medium leading-tight">{acct.name}</span>
                          <span className="text-xs text-gray-500 leading-tight">
                            {acct.number || ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="inline-flex"
                        onClick={() => setPreviewView(o)}
                        title="View details"
                      >
                        <StatusBadge order={o} />
                      </button>
                    </td>
                    <td className="p-2 font-medium">{o.symbol}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${o.side === 'SELL' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
                      >
                        {o.side}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {o.status === 'PARTIALLY_FILLED' && typeof o.quantity === 'number'
                        ? `${o.filledQuantity}/${o.quantity}`
                        : o.qty}
                    </td>
                    <td className="p-2">{o.type}</td>
                    <td className="p-2 text-right">{displayPrice}</td>
                    <td className="p-2 text-right">
                      {estValue
                        ? `$${estValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        {(o.status === 'DRAFT' || o.status.startsWith('PREVIEW_')) && (
                          <>
                            <Button
                              size="sm"
                              className="h-7 px-2 py-1 text-xs"
                              variant="outline"
                              onClick={() => setEditing(o)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2 py-1 text-xs"
                              disabled={previewingId === o.id}
                              onClick={async () => {
                                setPreviewingId(o.id);
                                try {
                                  await previewOrderServerFn({
                                    data: { id: o.id },
                                  });
                                } catch (e) {
                                  console.error('Preview error', e);
                                  // Fall through to load and show details if error
                                } finally {
                                  const data = (await load()) as Order[];
                                  setPreviewingId(null);
                                  const updated = (data || []).find((x) => x.id === o.id);
                                  if (
                                    updated &&
                                    (updated.status === 'PREVIEW_ERROR' ||
                                      updated.status === 'PREVIEW_WARN')
                                  ) {
                                    setPreviewView(updated);
                                  }
                                  // Try to extract a price from preview json and override locally for consistency
                                  try {
                                    if (updated?.previewJson) {
                                      const body: unknown = JSON.parse(updated.previewJson);
                                      const findNum = (
                                        obj: unknown,
                                        keys: string[],
                                      ): number | null => {
                                        if (!obj || typeof obj !== 'object') return null;
                                        const rec = obj as Record<string, unknown>;
                                        for (const k of Object.keys(rec)) {
                                          const key = k.toLowerCase();
                                          const v = rec[k];
                                          if (
                                            keys.includes(key) &&
                                            typeof v === 'number' &&
                                            Number.isFinite(v) &&
                                            v > 0
                                          )
                                            return v;
                                          if (v && typeof v === 'object') {
                                            const nested = findNum(v, keys);
                                            if (nested && nested > 0) return nested;
                                          }
                                        }
                                        return null;
                                      };
                                      const last = findNum(body, [
                                        'lastprice',
                                        'last',
                                        'last_price',
                                        'lasttradeprice',
                                      ]);
                                      const mark = findNum(body, [
                                        'mark',
                                        'markprice',
                                        'mark_price',
                                      ]);
                                      const getPath = (o: unknown, path: string[]): unknown => {
                                        let cur: unknown = o;
                                        for (const p of path) {
                                          if (!cur || typeof cur !== 'object') return undefined;
                                          cur = (cur as Record<string, unknown>)[p];
                                        }
                                        return cur;
                                      };
                                      const orderValue = getPath(body, [
                                        'orderStrategy',
                                        'orderBalance',
                                        'orderValue',
                                      ]) as number | undefined;
                                      const derived =
                                        !last &&
                                        !mark &&
                                        typeof updated.qty === 'number' &&
                                        updated.qty > 0 &&
                                        typeof orderValue === 'number' &&
                                        orderValue > 0
                                          ? orderValue / updated.qty
                                          : null;
                                      // Prefer mark for MARKET, else prefer last
                                      let chosen: number | null = null;
                                      if (updated.type === 'MARKET') {
                                        chosen =
                                          mark && mark > 0
                                            ? mark
                                            : last && last > 0
                                              ? last
                                              : derived && derived > 0
                                                ? derived
                                                : null;
                                      } else {
                                        chosen = last && last > 0 ? last : null;
                                      }
                                      if (chosen && chosen > 0) {
                                        setPriceOverrides((prev) => ({
                                          ...prev,
                                          [updated.symbol]: chosen,
                                        }));
                                      }
                                    }
                                  } catch (e) {
                                    console.warn(e);
                                  }
                                  try {
                                    if (onPricesUpdated) onPricesUpdated();
                                  } catch (e) {
                                    console.warn(e);
                                  }
                                }
                              }}
                            >
                              {previewingId === o.id ? 'Previewing...' : 'Preview'}
                            </Button>
                            {o.status === 'PREVIEW_OK' || o.status === 'PREVIEW_WARN' ? (
                              <Button
                                size="sm"
                                className="h-7 px-2 py-1 text-xs"
                                variant="secondary"
                                onClick={async () => {
                                  try {
                                    if (o.status === 'PREVIEW_WARN') {
                                      const ok = window.confirm(
                                        'This order has warnings from the broker preview. Submit anyway?',
                                      );
                                      if (!ok) return;
                                    }
                                    await submitOrderServerFn({
                                      data: { id: o.id },
                                    });
                                  } catch (e) {
                                    console.error('Submit error', e);
                                    window.alert(String(e instanceof Error ? e.message : e));
                                  } finally {
                                    await load();
                                  }
                                }}
                              >
                                Submit
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-7 px-2 py-1 text-xs"
                                variant="secondary"
                                disabled
                              >
                                Submit
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-7 px-2 py-1 text-xs"
                              variant="destructive"
                              onClick={() => setConfirmDelete(o)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                        {/* Details button removed; click the status badge to view details */}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No orders in this bucket
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <EditOrderModal
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        order={editing}
        onSaved={async (opts) => {
          const data = await load();
          const openId = opts?.openPreviewForId;
          if (openId) {
            const updated = (data || []).find((x) => x.id === openId);
            if (updated) setPreviewView(updated);
          }
        }}
        prices={mergedPrices}
      />

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Order?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-700">
            Are you sure you want to delete the draft order for{' '}
            <span className="font-medium">{confirmDelete?.symbol}</span>?
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="h-8 px-3 py-1 text-xs"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-8 px-3 py-1 text-xs"
              onClick={async () => {
                if (!confirmDelete) return;
                await deleteOrderServerFn({ data: { id: confirmDelete.id } });
                setConfirmDelete(null);
                await load();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk confirmation dialog */}
      <Dialog open={!!confirmBulk} onOpenChange={(v) => !v && setConfirmBulk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmBulk?.type === 'submit'
                ? 'Submit All Orders?'
                : confirmBulk?.type === 'submit_buys'
                  ? 'Submit All Buys?'
                  : confirmBulk?.type === 'submit_sells'
                    ? 'Submit All Sells?'
                    : 'Delete All Draft/Pending Orders?'}
            </DialogTitle>
          </DialogHeader>
          {confirmBulk?.type === 'submit' ||
          confirmBulk?.type === 'submit_buys' ||
          confirmBulk?.type === 'submit_sells' ? (
            <div className="text-sm text-gray-700">
              This will preview all Draft/Pending orders. Any that return Preview OK will be
              submitted{' '}
              {confirmBulk?.type === 'submit_buys'
                ? '(only Buys)'
                : confirmBulk?.type === 'submit_sells'
                  ? '(only Sells)'
                  : ''}
              . Continue?
            </div>
          ) : (
            <div className="text-sm text-gray-700">
              This will delete all Draft and Pending (Preview) orders in this group. This cannot be
              undone. Continue?
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              className="h-8 px-3 py-1 text-xs"
              onClick={() => setConfirmBulk(null)}
            >
              Cancel
            </Button>
            {confirmBulk?.type === 'submit' ||
            confirmBulk?.type === 'submit_buys' ||
            confirmBulk?.type === 'submit_sells' ? (
              <Button
                className="h-8 px-3 py-1 text-xs"
                disabled={bulkBusy}
                onClick={async () => {
                  setBulkBusy(true);
                  setBulkAction(confirmBulk?.type as 'submit' | 'submit_buys' | 'submit_sells');
                  try {
                    // 1) Preview all draft/pending
                    const targets = orders.filter(
                      (o) => o.status === 'DRAFT' || o.status.startsWith('PREVIEW_'),
                    );
                    let previewed = 0;
                    for (const o of targets) {
                      try {
                        await previewOrderServerFn({ data: { id: o.id } });
                        previewed++;
                      } catch (e) {
                        console.warn(e);
                      }
                    }
                    const updated = (await load()) as Order[];
                    // 2) Submit all PREVIEW_OK
                    const toSubmit = updated.filter((o) => {
                      if (o.status !== 'PREVIEW_OK') return false;
                      if (confirmBulk?.type === 'submit_buys') return o.side === 'BUY';
                      if (confirmBulk?.type === 'submit_sells') return o.side === 'SELL';
                      return true;
                    });
                    let submitted = 0;
                    for (const o of toSubmit) {
                      try {
                        await submitOrderServerFn({ data: { id: o.id } });
                        submitted++;
                      } catch (e) {
                        console.warn(e);
                      }
                    }
                    await load();
                    try {
                      if (onPricesUpdated) onPricesUpdated();
                    } catch (e) {
                      console.warn(e);
                    }
                    if (confirmBulk?.type === 'submit_buys') {
                      setBulkResultMsg(
                        `Previewed ${previewed}, submitted ${submitted} buy${submitted === 1 ? '' : 's'}`,
                      );
                    } else if (confirmBulk?.type === 'submit_sells') {
                      setBulkResultMsg(
                        `Previewed ${previewed}, submitted ${submitted} sell${submitted === 1 ? '' : 's'}`,
                      );
                    } else {
                      setBulkResultMsg(`Previewed ${previewed}, submitted ${submitted}`);
                    }
                    setTimeout(() => setBulkResultMsg(null), 4000);
                  } finally {
                    setBulkBusy(false);
                    setBulkAction(null);
                    setConfirmBulk(null);
                  }
                }}
              >
                Confirm
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="h-8 px-3 py-1 text-xs"
                disabled={bulkBusy}
                onClick={async () => {
                  setBulkBusy(true);
                  setBulkAction('delete');
                  try {
                    const targets = orders.filter(
                      (o) => o.status === 'DRAFT' || o.status.startsWith('PREVIEW_'),
                    );
                    let deleted = 0;
                    for (const o of targets) {
                      try {
                        await deleteOrderServerFn({ data: { id: o.id } });
                        deleted++;
                      } catch (e) {
                        console.warn(e);
                      }
                    }
                    await load();
                    setBulkResultMsg(`Deleted ${deleted} order${deleted === 1 ? '' : 's'}`);
                    setTimeout(() => setBulkResultMsg(null), 4000);
                  } finally {
                    setBulkBusy(false);
                    setBulkAction(null);
                    setConfirmBulk(null);
                  }
                }}
              >
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Details */}
      <Dialog open={!!previewView} onOpenChange={(v) => !v && setPreviewView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Preview Details{previewView ? ` — ${previewView.symbol}` : ''}
            </DialogTitle>
          </DialogHeader>
          {previewView && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <StatusBadge order={previewView} />
              </div>
              {(() => {
                // Parse body if present
                let body: unknown = null;
                try {
                  body = previewView.previewJson ? JSON.parse(previewView.previewJson) : null;
                } catch (e) {
                  console.warn(e);
                }

                // Extract validation messages
                const getArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
                const fromObj = (o: unknown, path: string[]): unknown => {
                  let cur: unknown = o;
                  for (const p of path) {
                    if (!cur || typeof cur !== 'object') return undefined;
                    cur = (cur as Record<string, unknown>)[p];
                  }
                  return cur;
                };
                const rawWarns = getArray(fromObj(body, ['orderValidationResult', 'warns']));
                const rawRejects = getArray(fromObj(body, ['orderValidationResult', 'rejects']));
                const items: Array<{
                  level: 'error' | 'warn';
                  message: string;
                  code?: string;
                }> = [];

                const add = (level: 'error' | 'warn', entry: unknown) => {
                  const rec = (
                    entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
                  ) as Record<string, unknown>;
                  const code: string | undefined =
                    (rec.code as string | undefined) ||
                    (rec.errorCode as string | undefined) ||
                    (rec.validationCode as string | undefined) ||
                    undefined;
                  const msgCandidates = [
                    rec.message,
                    rec.text,
                    rec.title,
                    rec.description,
                    rec.activityMessage,
                  ];
                  const picked = msgCandidates.find(
                    (m) => typeof m === 'string' && m.trim().length > 0,
                  ) as string | undefined;
                  const msg = picked || (code ? `Code ${code}` : undefined);
                  if (msg) items.push({ level, message: msg, code });
                };
                rawRejects.forEach((r) => {
                  add('error', r);
                });
                rawWarns.forEach((w) => {
                  add('warn', w);
                });

                // Include top-level errors if present
                const topErrors = getArray(fromObj(body, ['errors']));
                topErrors.forEach((e) => {
                  const rec = (
                    e && typeof e === 'object' ? (e as Record<string, unknown>) : {}
                  ) as Record<string, unknown>;
                  const code = (rec.id as string | undefined) || (rec.code as string | undefined);
                  const msg =
                    (typeof rec.title === 'string' && rec.title) ||
                    (typeof rec.message === 'string' && rec.message) ||
                    (typeof rec.detail === 'string' && rec.detail) ||
                    (typeof rec.activityMessage === 'string' && rec.activityMessage) ||
                    (code ? `Code ${code}` : undefined);
                  if (msg) items.push({ level: 'error', message: msg, code });
                });

                // Also include activity messages from order activity collection if present
                const activities = getArray(
                  fromObj(body, ['orderStrategy', 'orderActivityCollection']),
                );
                activities.forEach((a) => {
                  const rec = (
                    a && typeof a === 'object' ? (a as Record<string, unknown>) : {}
                  ) as Record<string, unknown>;
                  const code = (rec.id as string | undefined) || (rec.code as string | undefined);
                  const msg =
                    (typeof rec.activityMessage === 'string' && rec.activityMessage) ||
                    (typeof rec.message === 'string' && rec.message) ||
                    undefined;
                  if (msg) items.push({ level: 'warn', message: msg, code });
                });

                // Fallback to previewFirstMessage (cleaned) if no structured messages
                const cleanFallback = (() => {
                  const f = previewView.previewFirstMessage || '';
                  if (!f) return '';
                  // Remove noisy prefixes
                  const s = f
                    .replace(/^Error:\s*/i, '')
                    .replace(/Preview failed:\s*/i, '')
                    .trim();
                  // If it contains a JSON payload, try extracting its message/title
                  const firstBrace = s.indexOf('{');
                  const lastBrace = s.lastIndexOf('}');
                  if (firstBrace >= 0 && lastBrace > firstBrace) {
                    try {
                      const j = JSON.parse(s.slice(firstBrace, lastBrace + 1));
                      if (typeof j?.message === 'string') return j.message;
                      if (typeof j?.title === 'string') return j.title;
                    } catch (e) {
                      console.warn(e);
                    }
                  }
                  return s;
                })();

                // Deduplicate messages by level|code|message
                const seen = new Set<string>();
                const unique = items.filter((it) => {
                  const key = `${it.level}|${it.code || ''}|${it.message}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });

                const errors = unique.filter((i) => i.level === 'error');
                const warns = unique.filter((i) => i.level === 'warn');

                const orderValue = fromObj(body, ['orderStrategy', 'orderBalance', 'orderValue']) as
                  | number
                  | undefined;
                return (
                  <div className="space-y-3">
                    {typeof orderValue === 'number' && (
                      <div>
                        <span className="font-medium">Estimated Value:</span> $
                        {orderValue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    )}

                    {errors.length > 0 && (
                      <div>
                        <div className="font-medium text-red-800">Errors</div>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {errors.map((e, i) => (
                            <li key={`${e.code || ''}-${e.message}-${i}`} className="text-red-700">
                              {e.message}
                              {e.code ? (
                                <span className="ml-2 text-[11px] text-red-500">({e.code})</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {warns.length > 0 && (
                      <div>
                        <div className="font-medium text-yellow-800">Warnings</div>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {warns.map((w, i) => (
                            <li
                              key={`${w.code || ''}-${w.message}-${i}`}
                              className="text-yellow-700"
                            >
                              {w.message}
                              {w.code ? (
                                <span className="ml-2 text-[11px] text-yellow-600">({w.code})</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {errors.length === 0 && warns.length === 0 && cleanFallback && (
                      <div className="text-red-700">{cleanFallback}</div>
                    )}

                    {errors.length === 0 && warns.length === 0 && !cleanFallback && (
                      <div className="text-gray-600">No warnings or errors.</div>
                    )}

                    {body && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-gray-700">Raw response</summary>
                        <div className="mt-2 max-h-64 overflow-x-auto overflow-y-auto rounded bg-gray-50 p-2">
                          <pre className="text-[11px] leading-snug whitespace-pre-wrap break-words">
                            {JSON.stringify(body, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              className="h-8 px-3 py-1 text-xs"
              onClick={() => setPreviewView(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
