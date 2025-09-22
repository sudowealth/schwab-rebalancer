import type { PositionsResult, SP500DataResult, TransactionsResult } from './db-api';

export interface ExcelExportOptions {
  filename?: string;
  sheetName?: string;
  includeHeaders?: boolean;
}

type Position = PositionsResult[number];
type Transaction = TransactionsResult[number];
type Stock = SP500DataResult[number];

interface Security {
  ticker: string;
  currentValue?: number;
  targetValue?: number;
  currentPrice?: number;
  currentPercent?: number;
  targetPercent?: number;
  difference?: number;
  qty?: number;
}

// Excel export specific interface - standalone to avoid compatibility issues
export interface ExcelSleeveData {
  sleeveId: string;
  sleeveName?: string;
  currentValue: number;
  targetValue: number;
  currentPercent?: number;
  targetPercent?: number;
  difference?: number;
  securities: Security[];
}

interface SleeveAllocationData {
  accountId: string;
  accountName: string;
  accountNumber?: string;
  totalValue: number;
  sleeves: ExcelSleeveData[];
}

interface TradeData {
  securityId?: string;
  ticker?: string;
  action?: 'BUY' | 'SELL';
  qty: number;
  estValue: number;
}

// Helper function to trigger download
// biome-ignore lint/suspicious/noExplicitAny: Workbook type from dynamically imported ExcelJS
async function downloadExcelFile(workbook: any, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new globalThis.Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = globalThis.URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  globalThis.URL.revokeObjectURL(url);
}

async function exportTableToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: Array<{
    header: string;
    accessor: keyof T | ((row: T) => unknown);
    formatter?: (value: unknown) => string | number;
  }>,
  options: ExcelExportOptions = {},
) {
  const { filename = 'table-export', sheetName = 'Sheet1', includeHeaders = true } = options;

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Add headers if requested
  if (includeHeaders) {
    const headerRow = worksheet.addRow(columns.map((col) => col.header));
    // Style headers (bold)
    headerRow.font = { bold: true };
  }

  // Add data rows
  data.forEach((row) => {
    const rowData = columns.map((col) => {
      let value: unknown;

      if (typeof col.accessor === 'function') {
        value = col.accessor(row);
      } else {
        value = row[col.accessor];
      }

      if (col.formatter) {
        return col.formatter(value);
      }

      return value !== null && value !== undefined ? value : '';
    });

    worksheet.addRow(rowData);
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  });

  const timestamp = new Date().toISOString().split('T')[0];
  const fullFilename = `${filename}-${timestamp}.xlsx`;

  await downloadExcelFile(workbook, fullFilename);
}

export async function exportPositionsToExcel(positions: Position[], filename = 'positions') {
  const columns = [
    { header: 'Ticker', accessor: 'ticker' as const },
    { header: 'Sleeve', accessor: 'sleeveName' as const },
    { header: 'Quantity', accessor: 'qty' as const },
    { header: 'Cost Basis', accessor: 'costBasis' as const },
    { header: 'Current Price', accessor: 'currentPrice' as const },
    {
      header: 'Market Value',
      accessor: 'marketValue' as const,
      formatter: (value: unknown) => {
        // Parse formatted string like "$1,234.56" to number
        const str = typeof value === 'string' ? value : String(value);
        return Number.parseFloat(str.replace(/[$,]/g, '')) || 0;
      },
    },
    {
      header: 'Dollar Gain/Loss',
      accessor: 'dollarGainLoss' as const,
      formatter: (value: unknown) => {
        // Parse formatted string like "$1,234.56" or "-$1,234.56" to number
        const str = typeof value === 'string' ? value : String(value);
        const cleaned = str.replace(/[$,]/g, '');
        const isNegative = cleaned.startsWith('-');
        const absValue = Number.parseFloat(cleaned.replace(/^-/, '')) || 0;
        return isNegative ? -absValue : absValue;
      },
    },
    {
      header: 'Percent Gain/Loss',
      accessor: 'percentGainLoss' as const,
      formatter: (value: unknown) => {
        // Parse formatted string like "12.34%" or "-12.34%" to number
        const str = typeof value === 'string' ? value : String(value);
        const cleaned = str.replace(/%/g, '');
        const isNegative = cleaned.startsWith('-');
        const absValue = Number.parseFloat(cleaned.replace(/^-/, '')) || 0;
        return isNegative ? -absValue : absValue;
      },
    },
    { header: 'Days Held', accessor: 'daysHeld' as const },
    {
      header: 'Opened At',
      accessor: (row: Position) => new Date(row.openedAt).toLocaleDateString(),
    },
  ];

  await exportTableToExcel(positions, columns, {
    filename,
    sheetName: 'Positions',
  });
}

export async function exportTransactionsToExcel(
  transactions: Transaction[],
  filename = 'transactions',
) {
  const columns = [
    { header: 'Type', accessor: 'type' as const },
    { header: 'Ticker', accessor: 'ticker' as const },
    { header: 'Sleeve', accessor: 'sleeveName' as const },
    { header: 'Quantity', accessor: 'qty' as const },
    { header: 'Price', accessor: 'price' as const },
    { header: 'Realized Gain/Loss', accessor: 'realizedGainLoss' as const },
    {
      header: 'Executed At',
      accessor: (row: Transaction) => new Date(row.executedAt).toLocaleDateString(),
    },
  ];

  await exportTableToExcel(transactions, columns, {
    filename,
    sheetName: 'Transactions',
  });
}

export async function exportSP500ToExcel(stocks: Stock[], filename = 'sp500-stocks') {
  const columns = [
    { header: 'Ticker', accessor: 'ticker' as const },
    { header: 'Company Name', accessor: 'name' as const },
    { header: 'Market Cap', accessor: 'marketCap' as const },
    { header: 'P/E Ratio', accessor: 'peRatio' as const },
    { header: 'Industry', accessor: 'industry' as const },
    { header: 'Sector', accessor: 'sector' as const },
  ];

  await exportTableToExcel(stocks, columns, { filename, sheetName: 'S&P 500' });
}

export async function exportSleeveAllocationToExcel(
  sleeveTableData: ExcelSleeveData[],
  sleeveAllocationData: SleeveAllocationData[],
  groupingMode: 'sleeve' | 'account',
  filename = 'sleeve-allocation',
  trades: TradeData[] = [],
) {
  const exportData: unknown[] = [];

  // Helper functions for trade calculations
  const getTradeQtyForSecurity = (ticker: string) => {
    const securityTrades = trades.filter((t) => (t.securityId || t.ticker) === ticker);
    if (securityTrades.length === 0) return 0;
    const netQty = securityTrades.reduce((sum, t) => sum + t.qty, 0);
    return netQty;
  };

  const getTradeValueForSecurity = (ticker: string) => {
    const securityTrades = trades.filter((t) => (t.securityId || t.ticker) === ticker);
    if (securityTrades.length === 0) return 0;
    const netValue = securityTrades.reduce((sum, t) => sum + t.estValue, 0);
    return netValue;
  };

  const getTradeQtyForSleeve = (securities: Security[]) => {
    if (trades.length === 0) return 0;
    const sleeveTickers = securities.map((s) => s.ticker);
    const sleeveTrades = trades.filter((t) =>
      sleeveTickers.includes(t.securityId || t.ticker || ''),
    );
    if (sleeveTrades.length === 0) return 0;
    const netQty = sleeveTrades.reduce((sum, t) => sum + t.qty, 0);
    return netQty;
  };

  const getTradeValueForSleeve = (securities: Security[]) => {
    if (trades.length === 0) return 0;
    const sleeveTickers = securities.map((s) => s.ticker);
    const sleeveTrades = trades.filter((t) =>
      sleeveTickers.includes(t.securityId || t.ticker || ''),
    );
    if (sleeveTrades.length === 0) return 0;
    const netValue = sleeveTrades.reduce((sum, t) => sum + t.estValue, 0);
    return netValue;
  };

  const getActionForQty = (qty: number) => {
    if (qty > 0) return 'BUY';
    if (qty < 0) return 'SELL';
    return 'NONE';
  };

  const getPostTradePercent = (
    currentValue: number,
    tradeValue: number,
    totalCurrentValue: number,
  ) => {
    const postTradeValue = currentValue + tradeValue;
    return (postTradeValue / totalCurrentValue) * 100;
  };

  const getPostTradeDiff = (currentValue: number, tradeValue: number, targetValue: number) => {
    return currentValue + tradeValue - targetValue;
  };

  const getPostTradeDiffPercent = (
    currentValue: number,
    tradeValue: number,
    targetPercent: number,
    totalCurrentValue: number,
  ) => {
    const postTradeValue = currentValue + tradeValue;
    const postTradePercent = (postTradeValue / totalCurrentValue) * 100;
    // Calculate % distance from target for post-trade
    const percentDistanceFromTarget =
      targetPercent > 0
        ? ((postTradePercent - targetPercent) / targetPercent) * 100
        : postTradePercent;
    return percentDistanceFromTarget;
  };

  const getDiffPercent = (currentPercent: number, targetPercent: number) => {
    // Calculate % distance from target: (current - target) / target * 100
    const percentDistanceFromTarget =
      targetPercent > 0 ? ((currentPercent - targetPercent) / targetPercent) * 100 : currentPercent;
    return percentDistanceFromTarget;
  };

  // Determine account label - if only one account, use its name
  const accountLabel =
    sleeveAllocationData.length === 1 ? sleeveAllocationData[0].accountName : 'All Accounts';

  // Determine account number - if only one account, use its number
  const accountNumber =
    sleeveAllocationData.length === 1 ? sleeveAllocationData[0].accountNumber : '';

  // Calculate total current value for percentage calculations
  const totalCurrentValue = sleeveTableData.reduce((sum, s) => sum + s.currentValue, 0);

  if (groupingMode === 'sleeve') {
    sleeveTableData.forEach((sleeve) => {
      const tradeValue = sleeve.sleeveId === 'cash' ? 0 : getTradeValueForSleeve(sleeve.securities);
      const tradeQty = sleeve.sleeveId === 'cash' ? 0 : getTradeQtyForSleeve(sleeve.securities);
      const action = sleeve.sleeveId === 'cash' ? 'NONE' : getActionForQty(tradeQty);
      const postTradePercent = getPostTradePercent(
        sleeve.currentValue,
        tradeValue,
        totalCurrentValue,
      );
      const postTradeDiff = getPostTradeDiff(sleeve.currentValue, tradeValue, sleeve.targetValue);
      const postTradeDiffPercent = getPostTradeDiffPercent(
        sleeve.currentValue,
        tradeValue,
        sleeve.targetPercent || 0,
        totalCurrentValue,
      );

      exportData.push({
        type: 'Sleeve',
        name: sleeve.sleeveId === 'cash' ? 'Cash' : sleeve.sleeveName,
        sleeve: sleeve.sleeveId === 'cash' ? 'Cash' : sleeve.sleeveName,
        account: accountLabel,
        accountNumber: accountNumber,
        currentValue: sleeve.currentValue,
        currentPercent: sleeve.currentPercent || 0,
        currentQty:
          sleeve.sleeveId === 'cash'
            ? 0
            : sleeve.securities.reduce((total: number, security) => total + (security.qty || 0), 0),
        price: 0,
        targetValue: sleeve.targetValue,
        targetPercent: sleeve.targetPercent || 0,
        targetQty:
          sleeve.sleeveId === 'cash'
            ? 0
            : sleeve.securities.reduce((total: number, security) => {
                const targetQty =
                  (security.currentPrice || 0) > 0
                    ? Math.round((security.targetValue || 0) / (security.currentPrice || 1))
                    : 0;
                return total + targetQty;
              }, 0),
        difference: sleeve.difference,
        differencePercent: getDiffPercent(sleeve.currentPercent || 0, sleeve.targetPercent || 0),
        action: action,
        tradeQty: tradeQty,
        tradeValue: tradeValue,
        postTradePercent: postTradePercent,
        postTradeDiff: postTradeDiff,
        postTradeDiffPercent: postTradeDiffPercent,
      });

      // Add securities for this sleeve
      sleeve.securities.forEach((security) => {
        const securityTradeValue = getTradeValueForSecurity(security.ticker);
        const securityTradeQty = getTradeQtyForSecurity(security.ticker);
        const securityAction = getActionForQty(securityTradeQty);
        const securityPostTradePercent = getPostTradePercent(
          security.currentValue || 0,
          securityTradeValue,
          totalCurrentValue,
        );
        const securityPostTradeDiff = getPostTradeDiff(
          security.currentValue || 0,
          securityTradeValue,
          security.targetValue || 0,
        );
        const securityPostTradeDiffPercent = getPostTradeDiffPercent(
          security.currentValue || 0,
          securityTradeValue,
          security.targetPercent || 0,
          totalCurrentValue,
        );

        exportData.push({
          type: 'Security',
          name: security.ticker,
          sleeve: sleeve.sleeveId === 'cash' ? 'Cash' : sleeve.sleeveName,
          account: accountLabel,
          accountNumber: accountNumber,
          currentValue: security.currentValue || 0,
          currentPercent: security.currentPercent || 0,
          currentQty: security.qty || 0,
          price: security.currentPrice || 0,
          targetValue: security.targetValue || 0,
          targetPercent: security.targetPercent || 0,
          targetQty:
            (security.currentPrice || 0) > 0
              ? Math.round((security.targetValue || 0) / (security.currentPrice || 1))
              : 0,
          difference: security.difference || 0,
          differencePercent: getDiffPercent(
            security.currentPercent || 0,
            security.targetPercent || 0,
          ),
          action: securityAction,
          tradeQty: securityTradeQty,
          tradeValue: securityTradeValue,
          postTradePercent: securityPostTradePercent,
          postTradeDiff: securityPostTradeDiff,
          postTradeDiffPercent: securityPostTradeDiffPercent,
        });
      });
    });
  } else {
    sleeveAllocationData.forEach((account) => {
      exportData.push({
        type: 'Account',
        name: account.accountName,
        sleeve: '',
        account: account.accountName,
        accountNumber: account.accountNumber,
        currentValue: account.totalValue,
        currentPercent: 0, // Will be calculated in the export
        currentQty: 'N/A',
        price: 0,
        targetValue: account.totalValue,
        targetPercent: 0, // Will be calculated in the export
        targetQty: 'N/A',
        difference: 0,
        differencePercent: 0,
        action: 'NONE',
        tradeQty: 'N/A',
        tradeValue: 0,
        postTradePercent: 0,
        postTradeDiff: 0,
        postTradeDiffPercent: 0,
      });

      account.sleeves.forEach((sleeve) => {
        const sleeveTradeValue = getTradeValueForSleeve(sleeve.securities);
        const sleeveTradeQty = getTradeQtyForSleeve(sleeve.securities);
        const sleeveAction = getActionForQty(sleeveTradeQty);
        const sleevePostTradePercent = getPostTradePercent(
          sleeve.currentValue,
          sleeveTradeValue,
          totalCurrentValue,
        );
        const sleevePostTradeDiff = getPostTradeDiff(
          sleeve.currentValue,
          sleeveTradeValue,
          sleeve.targetValue,
        );
        const sleevePostTradeDiffPercent = getPostTradeDiffPercent(
          sleeve.currentValue,
          sleeveTradeValue,
          sleeve.targetPercent || 0,
          totalCurrentValue,
        );

        exportData.push({
          type: 'Sleeve',
          name: sleeve.sleeveName,
          sleeve: sleeve.sleeveName,
          account: account.accountName,
          accountNumber: account.accountNumber,
          currentValue: sleeve.currentValue,
          currentPercent: sleeve.currentPercent || 0,
          currentQty: sleeve.securities.reduce(
            (total: number, security) => total + (security.qty || 0),
            0,
          ),
          price: 0,
          targetValue: sleeve.targetValue,
          targetPercent: sleeve.targetPercent || 0,
          targetQty: sleeve.securities.reduce((total: number, security) => {
            const targetQty =
              (security.currentPrice || 0) > 0
                ? Math.round((security.targetValue || 0) / (security.currentPrice || 1))
                : 0;
            return total + targetQty;
          }, 0),
          difference: sleeve.difference,
          differencePercent: getDiffPercent(sleeve.currentPercent || 0, sleeve.targetPercent || 0),
          action: sleeveAction,
          tradeQty: sleeveTradeQty,
          tradeValue: sleeveTradeValue,
          postTradePercent: sleevePostTradePercent,
          postTradeDiff: sleevePostTradeDiff,
          postTradeDiffPercent: sleevePostTradeDiffPercent,
        });

        sleeve.securities.forEach((security) => {
          const securityTradeValue = getTradeValueForSecurity(security.ticker);
          const securityTradeQty = getTradeQtyForSecurity(security.ticker);
          const securityAction = getActionForQty(securityTradeQty);
          const securityPostTradePercent = getPostTradePercent(
            security.currentValue || 0,
            securityTradeValue,
            totalCurrentValue,
          );
          const securityPostTradeDiff = getPostTradeDiff(
            security.currentValue || 0,
            securityTradeValue,
            security.targetValue || 0,
          );
          const securityPostTradeDiffPercent = getPostTradeDiffPercent(
            security.currentValue || 0,
            securityTradeValue,
            security.targetPercent || 0,
            totalCurrentValue,
          );

          exportData.push({
            type: 'Security',
            name: security.ticker,
            sleeve: sleeve.sleeveName,
            account: account.accountName,
            accountNumber: account.accountNumber,
            currentValue: security.currentValue || 0,
            currentPercent: security.currentPercent || 0,
            currentQty: security.qty || 0,
            price: security.currentPrice || 0,
            targetValue: security.targetValue || 0,
            targetPercent: security.targetPercent || 0,
            targetQty:
              (security.currentPrice || 0) > 0
                ? Math.round((security.targetValue || 0) / (security.currentPrice || 1))
                : 0,
            difference: security.difference || 0,
            differencePercent: getDiffPercent(
              security.currentPercent || 0,
              security.targetPercent || 0,
            ),
            action: securityAction,
            tradeQty: securityTradeQty,
            tradeValue: securityTradeValue,
            postTradePercent: securityPostTradePercent,
            postTradeDiff: securityPostTradeDiff,
            postTradeDiffPercent: securityPostTradeDiffPercent,
          });
        });
      });
    });
  }

  const columns = [
    { header: 'Type', accessor: 'type' as const },
    { header: 'Name', accessor: 'name' as const },
    { header: 'Sleeve', accessor: 'sleeve' as const },
    { header: 'Account', accessor: 'account' as const },
    { header: 'Account Number', accessor: 'accountNumber' as const },
    { header: 'Current $', accessor: 'currentValue' as const },
    { header: 'Current %', accessor: 'currentPercent' as const },
    { header: 'Current QTY', accessor: 'currentQty' as const },
    { header: 'Price', accessor: 'price' as const },
    { header: 'Target $', accessor: 'targetValue' as const },
    { header: 'Target %', accessor: 'targetPercent' as const },
    { header: 'Target QTY', accessor: 'targetQty' as const },
    { header: 'Diff $', accessor: 'difference' as const },
    { header: 'Diff %', accessor: 'differencePercent' as const },
    { header: 'Action', accessor: 'action' as const },
    { header: 'Trade QTY', accessor: 'tradeQty' as const },
    { header: 'Trade $', accessor: 'tradeValue' as const },
    { header: 'Post-Trade %', accessor: 'postTradePercent' as const },
    { header: 'Post-Trade Diff $', accessor: 'postTradeDiff' as const },
    { header: 'Post-Trade Diff %', accessor: 'postTradeDiffPercent' as const },
  ];

  await exportTableToExcel(exportData as Record<string, unknown>[], columns, {
    filename,
    sheetName: 'Sleeve Allocation',
  });
}

// Export parameter types for better type safety
export type ExportSleeveAllocationToExcelSleeveTableData = Parameters<
  typeof exportSleeveAllocationToExcel
>[0];
export type ExportSleeveAllocationToExcelSleeveAllocationData = Parameters<
  typeof exportSleeveAllocationToExcel
>[1];

// Lazy-loaded Excel export hooks for use in React components
export function useExcelExport() {
  return {
    exportPositionsToExcel,
    exportTransactionsToExcel,
    exportSP500ToExcel,
    exportSleeveAllocationToExcel,
  };
}
