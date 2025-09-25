import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteSyncLogServerFn, getSyncLogsServerFn } from '~/lib/server-functions';

interface SyncLog {
  id: string;
  syncType: string;
  startedAt: string | Date;
  status: string;
  recordsProcessed?: number;
  errorMessage?: string | null;
  details?: unknown[];
}

import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';

async function exportSyncToExcel(log: unknown) {
  try {
    const ExcelJS = await import('exceljs');
    const logData = log as Record<string, unknown>;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Rebalancer';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Property', key: 'property', width: 20 },
      { header: 'Value', key: 'value', width: 30 },
    ];

    summarySheet.addRow(['Sync Type', String(logData.syncType || '')]);
    summarySheet.addRow(['Started At', new Date(String(logData.startedAt || '')).toLocaleString()]);
    summarySheet.addRow(['Status', String(logData.status || '')]);
    summarySheet.addRow(['Records Processed', Number(logData.recordsProcessed || 0)]);
    if (logData.errorMessage) {
      summarySheet.addRow(['Error Message', String(logData.errorMessage)]);
    }

    // Details sheet
    const detailsSheet = workbook.addWorksheet('Details');
    detailsSheet.columns = [
      { header: 'Entity ID', key: 'entityId', width: 20 },
      { header: 'Ticker', key: 'ticker', width: 15 },
      { header: 'Operation', key: 'operation', width: 15 },
      { header: 'Field', key: 'field', width: 20 },
      { header: 'Old Value', key: 'oldValue', width: 25 },
      { header: 'New Value', key: 'newValue', width: 25 },
    ];

    const details = logData.details as unknown[];
    const list = Array.isArray(details) ? details : [];

    list.forEach((detail) => {
      const detailData = detail as Record<string, unknown>;
      let changes: Record<string, unknown> = {};

      try {
        const changesRaw = detailData.changes;
        changes = changesRaw
          ? typeof changesRaw === 'string'
            ? JSON.parse(changesRaw)
            : changesRaw
          : {};
      } catch {
        // Ignore parsing errors
      }

      Object.entries(changes).forEach(([field, changeValue]) => {
        let oldValue = '';
        let newValue = '';

        if (
          changeValue &&
          typeof changeValue === 'object' &&
          ('old' in changeValue || 'new' in changeValue)
        ) {
          const changeObj = changeValue as Record<string, unknown>;
          const oldV = changeObj.old;
          const newVRaw = changeObj.new;
          oldValue = oldV !== undefined && oldV !== null ? String(oldV) : '';
          newValue =
            newVRaw !== undefined && newVRaw !== null ? String(newVRaw) : String(oldV || '');
        } else {
          newValue = changeValue !== undefined && changeValue !== null ? String(changeValue) : '';
        }

        detailsSheet.addRow({
          entityId: String(detailData.entityId || ''),
          ticker: String(detailData.ticker || ''),
          operation: String(detailData.operation || 'UPDATE'),
          field,
          oldValue,
          newValue,
        });
      });
    });

    // Generate file name
    const timestamp = new Date(String(logData.startedAt || ''))
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, '-');
    const fileName = `sync-${String(logData.syncType || '').toLowerCase()}-${timestamp}.xlsx`;

    // Save file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export Excel file:', error);
    alert('Failed to export Excel file. Please try again.');
  }
}

async function deleteSyncLog(logId: string) {
  try {
    await deleteSyncLogServerFn({ data: { logId } });
    // Refresh the sync logs by invalidating the query
    // This will automatically update the UI
    window.location.reload();
  } catch (error) {
    console.error('Failed to delete sync log:', error);
    alert('Failed to delete sync log. Please try again.');
  }
}

export function SyncHistory() {
  const [expandedLogId, setExpandedLogId] = useState<string | undefined>(undefined);
  const [hasExpandedSelection, setHasExpandedSelection] = useState(false);
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [changesModalTitle, setChangesModalTitle] = useState<string>('');
  const [changesModalText, setChangesModalText] = useState<string>('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalLog, setDeleteModalLog] = useState<{
    id: string;
    syncType: string;
    startedAt: string;
  } | null>(null);

  // Query recent sync logs, refresh more frequently when syncing
  const { data: syncLogs } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: async () => {
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
    <ErrorBoundaryWrapper
      title="Sync History Error"
      description="Failed to load sync history. This might be due to a temporary data issue."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync History</CardTitle>
          <CardDescription>
            View recent data synchronization activities and their results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-white">
            <div className="max-h-[30rem] overflow-auto divide-y">
              {(syncLogs ?? []).length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No recent syncs.</div>
              ) : (
                (syncLogs ?? []).map((log: SyncLog, _idx: number) => {
                  // Default: closed on initial load; open only if user clicks or when a sync is running
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div key={log.id} className="text-sm">
                      {/* biome-ignore lint/a11y/useSemanticElements: Complex layout requires div with role="button" */}
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        className="p-2 grid grid-cols-[auto_1fr_7rem_8rem_1fr_auto] gap-2 items-center cursor-pointer select-none w-full text-left bg-transparent hover:bg-gray-50/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        onClick={() => {
                          setExpandedLogId((prev) => {
                            const next = prev === log.id ? undefined : log.id;
                            return next;
                          });
                          setHasExpandedSelection(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedLogId((prev) => {
                              const next = prev === log.id ? undefined : log.id;
                              return next;
                            });
                            setHasExpandedSelection(true);
                          }
                        }}
                      >
                        <span className="px-2 py-0.5 rounded border text-xs w-[110px]">
                          {log.syncType}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(log.startedAt).toLocaleString()}
                        </span>
                        <span
                          className={`flex items-center gap-1 w-[112px] ${
                            log.status === 'RUNNING'
                              ? 'text-amber-600'
                              : log.status === 'SUCCESS'
                                ? 'text-green-600'
                                : log.status === 'PARTIAL'
                                  ? 'text-amber-700'
                                  : 'text-red-600'
                          }`}
                        >
                          {log.status}
                          {log.status === 'RUNNING' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                        </span>
                        {(() => {
                          // Live count while RUNNING based on details' success; otherwise use stored recordsProcessed
                          const details =
                            (log as { details?: Array<{ success?: boolean }> }).details || [];
                          const processedNow =
                            log.status === 'RUNNING'
                              ? details.filter((d) => d.success).length
                              : typeof log.recordsProcessed === 'number'
                                ? log.recordsProcessed
                                : undefined;
                          return (
                            <span className="text-muted-foreground w-[128px]">
                              {processedNow !== undefined ? `${processedNow} items` : '\u00A0'}
                            </span>
                          );
                        })()}
                        <span className="text-red-600 truncate max-w-[320px]">
                          {log.errorMessage ?? ''}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportSyncToExcel(log);
                            }}
                            title="Export to Excel"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-60 hover:opacity-100 text-red-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModalLog({
                                id: log.id,
                                syncType: log.syncType,
                                startedAt: new Date(log.startedAt).toISOString(),
                              });
                              setDeleteModalOpen(true);
                            }}
                            title="Delete sync log"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-2 pb-2">
                          <div className="rounded border bg-white">
                            <Table wrapperClassName="max-h-[260px]">
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead className="w-[40ch] h-9 px-3 text-[11px]">
                                    Entity
                                  </TableHead>
                                  <TableHead className="w-[12ch] h-9 px-3 text-[11px]">
                                    Operation
                                  </TableHead>
                                  <TableHead className="h-9 px-3 text-[11px]">Changes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
                                {(() => {
                                  const details = (log as { details?: unknown[] }).details;
                                  const list = (
                                    log.syncType === 'SECURITIES'
                                      ? (details ?? [])
                                      : (details ?? [])
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
                                    const summary = summarize(changes);
                                    return (
                                      <TableRow
                                        key={
                                          d.entityId ?? d.ticker ?? `${d.operation ?? 'op'}-${i}`
                                        }
                                        className="text-xs"
                                      >
                                        <TableCell className="w-[40ch] font-medium break-words">
                                          {d.entityId ?? d.ticker ?? ''}
                                        </TableCell>
                                        <TableCell className="w-[12ch] uppercase text-muted-foreground">
                                          {d.operation ?? 'UPDATE'}
                                        </TableCell>
                                        <TableCell>
                                          <button
                                            type="button"
                                            className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer text-left rounded px-1 -mx-1 transition-colors hover:bg-blue-50/40"
                                            onClick={() => {
                                              setChangesModalTitle(
                                                `${d.entityId ?? d.ticker ?? 'Entity'} changes`,
                                              );
                                              setChangesModalText(JSON.stringify(changes, null, 2));
                                              setChangesModalOpen(true);
                                            }}
                                          >
                                            {summary || '(no changes summary)'}
                                          </button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  });
                                })()}
                              </TableBody>
                            </Table>
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
              <DialogDescription className="sr-only">
                View detailed changes from the sync operation.
              </DialogDescription>
            </DialogHeader>
            <pre className="mt-2 max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs">
              {changesModalText}
            </pre>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Sync Log</DialogTitle>
              <DialogDescription className="sr-only">
                Are you sure you want to delete this sync log?
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2">
              {deleteModalLog && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <div className="text-sm">
                    <div>
                      <strong>Type:</strong> {deleteModalLog.syncType}
                    </div>
                    <div>
                      <strong>Started:</strong>{' '}
                      {new Date(deleteModalLog.startedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-3">This action cannot be undone.</p>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteModalLog(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (deleteModalLog) {
                    await deleteSyncLog(deleteModalLog.id);
                    setDeleteModalOpen(false);
                    setDeleteModalLog(null);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </ErrorBoundaryWrapper>
  );
}
