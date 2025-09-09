import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

export function SyncHistory() {
  const [expandedLogId, setExpandedLogId] = useState<string | undefined>(undefined);
  const [hasExpandedSelection, setHasExpandedSelection] = useState(false);
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [changesModalTitle, setChangesModalTitle] = useState<string>('');
  const [changesModalText, setChangesModalText] = useState<string>('');

  // Query recent sync logs, refresh more frequently when syncing
  const { data: syncLogs } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: async () => {
      const { getSyncLogsServerFn } = await import('../lib/server-functions');
      return getSyncLogsServerFn();
    },
    // Poll every 2s when any sync mutation is pending, else every 15s
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });

  // Auto-expand the currently running sync when a sync starts
  useEffect(() => {
    if (!hasExpandedSelection && Array.isArray(syncLogs)) {
      const running = syncLogs.find(
        (l: { status?: string; id?: string }) => l?.status === 'RUNNING',
      );
      if (running && expandedLogId !== running.id) {
        setExpandedLogId(running.id);
      }
    }
  }, [syncLogs, hasExpandedSelection, expandedLogId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sync History</CardTitle>
        <CardDescription>
          View recent data synchronization activities and their results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-white">
          <div className="max-h-60 overflow-auto divide-y">
            {/* Optimistic in-progress row */}
            {(() => {
              // Check if any sync is running by looking for RUNNING status in logs
              const runningLog = Array.isArray(syncLogs)
                ? syncLogs.find((l: { status?: string }) => l?.status === 'RUNNING')
                : null;

              if (runningLog) {
                return (
                  <div className="p-3 grid grid-cols-[auto_1fr_auto_auto_1fr] items-center gap-3 text-sm">
                    <span className="px-2 py-0.5 rounded border text-xs">
                      {runningLog.syncType}
                    </span>
                    <span className="text-muted-foreground">{new Date().toLocaleString()}</span>
                    <span className="text-amber-600">RUNNING</span>
                    <span className="text-muted-foreground">&nbsp;</span>
                    <span className="justify-self-start">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </span>
                  </div>
                );
              }
              return null;
            })()}
            {(syncLogs ?? []).length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No recent syncs.</div>
            ) : (
              (syncLogs ?? []).map((log, _idx: number) => {
                // Default: closed on initial load; open only if user clicks or when a sync is running
                const isExpanded = expandedLogId === log.id;
                return (
                  <div key={log.id} className="text-sm">
                    <button
                      type="button"
                      className="p-3 grid grid-cols-[auto_1fr_auto_auto_1fr] gap-3 items-center cursor-pointer select-none w-full text-left bg-transparent"
                      onClick={() => {
                        setExpandedLogId((prev) => {
                          const next = prev === log.id ? undefined : log.id;
                          return next;
                        });
                        setHasExpandedSelection(true);
                      }}
                    >
                      <span className="px-2 py-0.5 rounded border text-xs">{log.syncType}</span>
                      <span className="text-muted-foreground">
                        {new Date(log.startedAt).toLocaleString()}
                      </span>
                      <span
                        className={
                          log.status === 'RUNNING'
                            ? 'text-amber-600'
                            : log.status === 'SUCCESS'
                              ? 'text-green-600'
                              : log.status === 'PARTIAL'
                                ? 'text-amber-700'
                                : 'text-red-600'
                        }
                      >
                        {log.status}
                      </span>
                      <span className="text-muted-foreground">
                        {typeof log.recordsProcessed === 'number'
                          ? `${log.recordsProcessed} items`
                          : '\u00A0'}
                      </span>
                      <span className="text-red-600 truncate max-w-[320px]">
                        {log.errorMessage ?? ''}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="px-2 pb-2">
                        <div className="rounded border bg-white">
                          <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[11px] font-medium text-muted-foreground border-b bg-muted/30 justify-items-start">
                            <div className="text-left">Entity</div>
                            <div className="text-left">Operation</div>
                            <div className="text-left">Changes</div>
                          </div>
                          <div className="max-h-[220px] overflow-auto">
                            {(() => {
                              const details = (log as { details?: unknown[] }).details;
                              const list = (
                                log.syncType === 'SECURITIES' ? (details ?? []) : (details ?? [])
                              ) as Array<{
                                changes?: string | Record<string, unknown>;
                                entityId?: string;
                                ticker?: string;
                                operation?: string;
                              }>;
                              return list.map((d, i: number) => {
                                let changes: Record<string, unknown> = {};
                                try {
                                  changes = d.changes
                                    ? typeof d.changes === 'string'
                                      ? JSON.parse(d.changes)
                                      : d.changes
                                    : {};
                                } catch {
                                  // Ignore
                                }
                                const summarize = (obj: Record<string, unknown>) => {
                                  const entries = Object.entries(
                                    obj || ({} as Record<string, unknown>),
                                  );
                                  if (entries.length === 0) return '';

                                  const fmt = (val: unknown) =>
                                    typeof val === 'number'
                                      ? Number.isInteger(val)
                                        ? String(val)
                                        : (val as number).toFixed(2)
                                      : (val ?? '');
                                  const equal = (a: unknown, b: unknown) => {
                                    if (a === undefined || a === null) return false;
                                    if (b === undefined || b === null) return false;
                                    if (typeof a === 'number' && typeof b === 'number') {
                                      return Math.abs(a - b) < 1e-9;
                                    }
                                    return String(a) === String(b);
                                  };

                                  const parts = entries.slice(0, 3).map(([k, v]) => {
                                    const hasOldNew =
                                      v && typeof v === 'object' && ('old' in v || 'new' in v);
                                    if (hasOldNew) {
                                      const { old: oldV, new: newVRaw } = v as {
                                        old?: unknown;
                                        new?: unknown;
                                      };
                                      const newV = newVRaw ?? oldV;
                                      if (equal(oldV, newV)) {
                                        return `${k}: ${fmt(newV)}`;
                                      }
                                      const left =
                                        oldV !== undefined && oldV !== null
                                          ? `${fmt(oldV)} → `
                                          : '';
                                      return `${k}: ${left}${fmt(newV)}`;
                                    }
                                    return `${k}: ${fmt(v)}`;
                                  });

                                  return parts.join('; ') + (entries.length > 3 ? ' …' : '');
                                };
                                return (
                                  <div
                                    key={d.entityId ?? d.ticker ?? `${d.operation ?? 'op'}-${i}`}
                                    className="grid grid-cols-3 gap-2 px-3 py-2 text-xs border-t first:border-t-0 justify-items-start"
                                  >
                                    <div className="font-medium text-left">
                                      {d.entityId ?? d.ticker ?? ''}
                                    </div>
                                    <div className="uppercase text-muted-foreground text-left">
                                      {d.operation ?? 'UPDATE'}
                                    </div>
                                    <div className="text-left">
                                      {(() => {
                                        const summary = summarize(changes);
                                        const isTruncated = summary.endsWith(' …');
                                        if (isTruncated) {
                                          return (
                                            <button
                                              type="button"
                                              className="underline text-blue-600 hover:text-blue-700 text-left"
                                              onClick={() => {
                                                setChangesModalTitle(
                                                  `${d.entityId ?? d.ticker ?? 'Entity'} changes`,
                                                );
                                                setChangesModalText(
                                                  JSON.stringify(changes, null, 2),
                                                );
                                                setChangesModalOpen(true);
                                              }}
                                            >
                                              {summary}
                                            </button>
                                          );
                                        }
                                        return <span className="block text-left">{summary}</span>;
                                      })()}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={changesModalOpen} onOpenChange={setChangesModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{changesModalTitle || 'Changes'}</DialogTitle>
          </DialogHeader>
          <pre className="mt-2 max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs">
            {changesModalText}
          </pre>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
