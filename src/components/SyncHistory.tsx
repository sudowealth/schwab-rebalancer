import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

async function exportSyncToExcel(log: unknown) {
  try {
    const ExcelJS = await import('exceljs');
    const logData = log as Record<string, unknown>;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Schwab Rebalancer';
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
          <div className="max-h-[30rem] overflow-auto divide-y">
            {/* Optimistic in-progress row */}
            {(() => {
              // Check if any sync is running by looking for RUNNING status in logs
              const runningLog = Array.isArray(syncLogs)
                ? syncLogs.find((l: { status?: string }) => l?.status === 'RUNNING')
                : null;

              if (runningLog) {
                return (
                  <div className="p-2 grid grid-cols-[auto_1fr_auto_auto_1fr_auto] items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 rounded border text-xs w-[110px]">
                      {runningLog.syncType}
                    </span>
                    <span className="text-muted-foreground">{new Date().toLocaleString()}</span>
                    <span className="text-amber-600 w-[96px]">RUNNING</span>
                    <span className="text-muted-foreground w-[96px]">&nbsp;</span>
                    <span className="justify-self-start">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </span>
                    <div></div>
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
                      className="p-2 grid grid-cols-[auto_1fr_auto_auto_1fr_auto] gap-2 items-center cursor-pointer select-none w-full text-left bg-transparent"
                      onClick={() => {
                        setExpandedLogId((prev) => {
                          const next = prev === log.id ? undefined : log.id;
                          return next;
                        });
                        setHasExpandedSelection(true);
                      }}
                    >
                      <span className="px-2 py-0.5 rounded border text-xs w-[110px]">
                        {log.syncType}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(log.startedAt).toLocaleString()}
                      </span>
                      <span
                        className={
                          (log.status === 'RUNNING'
                            ? 'text-amber-600'
                            : log.status === 'SUCCESS'
                              ? 'text-green-600'
                              : log.status === 'PARTIAL'
                                ? 'text-amber-700'
                                : 'text-red-600') + ' w-[96px]'
                        }
                      >
                        {log.status}
                      </span>
                      <span className="text-muted-foreground w-[96px]">
                        {typeof log.recordsProcessed === 'number'
                          ? `${log.recordsProcessed} items`
                          : '\u00A0'}
                      </span>
                      <span className="text-red-600 truncate max-w-[320px]">
                        {log.errorMessage ?? ''}
                      </span>
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
                    </button>
                    {isExpanded && (
                      <div className="px-2 pb-2">
                        <div className="rounded border bg-white">
                          <Table wrapperClassName="max-h-[260px]">
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="w-[40ch] h-9 px-3 text-[11px]">Entity</TableHead>
                                <TableHead className="w-[12ch] h-9 px-3 text-[11px]">Operation</TableHead>
                                <TableHead className="h-9 px-3 text-[11px]">Changes</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
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
                                    const entries = Object.entries(obj || ({} as Record<string, unknown>));
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
                                      const hasOldNew = v && typeof v === 'object' && ('old' in v || 'new' in v);
                                      if (hasOldNew) {
                                        const { old: oldV, new: newVRaw } = v as { old?: unknown; new?: unknown };
                                        const newV = newVRaw ?? oldV;
                                        if (equal(oldV, newV)) {
                                          return `${k}: ${fmt(newV)}`;
                                        }
                                        const left = oldV !== undefined && oldV !== null ? `${fmt(oldV)} → ` : '';
                                        return `${k}: ${left}${fmt(newV)}`;
                                      }
                                      return `${k}: ${fmt(v)}`;
                                    });
                                    return parts.join('; ') + (entries.length > 3 ? ' …' : '');
                                  };
                                  const summary = summarize(changes);
                                  return (
                                    <TableRow
                                      key={d.entityId ?? d.ticker ?? `${d.operation ?? 'op'}-${i}`}
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
          </DialogHeader>
          <pre className="mt-2 max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs">
            {changesModalText}
          </pre>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
