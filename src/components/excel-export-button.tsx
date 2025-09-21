import { Download } from 'lucide-react';
import { useState } from 'react';
import type { PositionsResult, SP500DataResult, TransactionsResult } from '~/lib/db-api';
import { Button } from './ui/button';

// Type-safe data types for different export types
interface BaseExportProps {
  filename?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

interface PositionsExportProps extends BaseExportProps {
  type: 'positions';
  data: PositionsResult;
}

interface TransactionsExportProps extends BaseExportProps {
  type: 'transactions';
  data: TransactionsResult;
}

interface SP500ExportProps extends BaseExportProps {
  type: 'sp500';
  data: SP500DataResult;
}

interface SyncHistoryExportProps extends BaseExportProps {
  type: 'sync-history';
  data: Array<Record<string, unknown>>;
}

type ExcelExportButtonProps =
  | PositionsExportProps
  | TransactionsExportProps
  | SP500ExportProps
  | SyncHistoryExportProps;

// Lazy load Excel export functions
let excelExportPromise: Promise<typeof import('~/lib/excel-export')> | null = null;
let excelExportModule: typeof import('~/lib/excel-export') | null = null;

async function getExcelExport() {
  if (!excelExportModule) {
    if (!excelExportPromise) {
      excelExportPromise = import('~/lib/excel-export');
    }
    excelExportModule = await excelExportPromise;
  }
  return excelExportModule;
}

// Loading fallback component
function ExcelExportLoadingFallback({
  variant = 'outline',
  size = 'sm',
  className,
}: Pick<BaseExportProps, 'variant' | 'size' | 'className'>) {
  return (
    <Button disabled variant={variant} size={size} className={className}>
      <Download className="h-4 w-4 animate-pulse" />
      Loading...
    </Button>
  );
}

// Helper function for sync history export
async function exportSyncHistory(logs: Array<Record<string, unknown>>, filename = 'sync-history') {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Schwab Rebalancer';
  workbook.created = new Date();

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Timestamp', key: 'timestamp', width: 20 },
    { header: 'Action', key: 'action', width: 15 },
    { header: 'Details', key: 'details', width: 50 },
  ];

  // Style headers
  summarySheet.getRow(1).font = { bold: true };

  // Add data
  logs.forEach((item) => {
    summarySheet.addRow([
      item.timestamp || new Date().toISOString(),
      item.action || 'Unknown',
      JSON.stringify(item.details || {}),
    ]);
  });

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

// Main component with lazy loading
export function ExcelExportButton(props: ExcelExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    if (isExporting || props.disabled) return;

    setIsExporting(true);
    setIsLoading(true);

    try {
      const excelModule = await getExcelExport();

      switch (props.type) {
        case 'positions':
          await excelModule.exportPositionsToExcel(props.data, props.filename);
          break;
        case 'transactions':
          await excelModule.exportTransactionsToExcel(props.data, props.filename);
          break;
        case 'sp500':
          await excelModule.exportSP500ToExcel(props.data, props.filename);
          break;
        case 'sync-history':
          await exportSyncHistory(props.data, props.filename);
          break;
        default:
          throw new Error(`Unknown export type: ${(props as ExcelExportButtonProps).type}`);
      }
    } catch (error) {
      console.error('Excel export failed:', error);
      // You might want to show a toast notification here
    } finally {
      setIsExporting(false);
      setIsLoading(false);
    }
  };

  if (isLoading && !excelExportModule) {
    return (
      <ExcelExportLoadingFallback
        variant={props.variant}
        size={props.size}
        className={props.className}
      />
    );
  }

  return (
    <Button
      onClick={handleExport}
      disabled={props.disabled || isExporting}
      variant={props.variant}
      size={props.size}
      className={props.className}
    >
      <Download className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
      {isExporting ? 'Exporting...' : 'Export'}
    </Button>
  );
}
