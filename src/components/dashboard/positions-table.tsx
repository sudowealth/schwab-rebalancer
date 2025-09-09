import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { AlertTriangle, ChevronDown, ChevronsUpDown, ChevronUp, Flame } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SimpleTooltip } from '../../components/ui/simple-tooltip';
import type { Position, Trade } from '../../lib/schemas';
import { formatQuantity } from '../../lib/utils';

interface PositionsTableProps {
  positions: Position[];
  proposedTrades?: Trade[];
  onTickerClick: (ticker: string) => void;
  onSleeveClick: (sleeveId: string) => void;
}

export function PositionsTable({
  positions,
  proposedTrades,
  onTickerClick,
  onSleeveClick,
}: PositionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'account', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns = useMemo<ColumnDef<Position>[]>(
    () => [
      {
        id: 'account',
        accessorKey: 'accountName',
        header: 'Account',
        cell: ({ row }) => row.original.accountName,
      },
      {
        id: 'accountNumber',
        header: 'Account #',
        cell: ({ row }) => row.original.accountNumber || 'N/A',
      },
      {
        accessorKey: 'ticker',
        header: 'Ticker',
        cell: ({ getValue, row }) => {
          const ticker = getValue() as string;
          const position = row.original;
          const dollarGainLoss = parseFloat(position.dollarGainLoss.replace(/[$,]/g, ''));
          const percentLoss = parseFloat(position.percentGainLoss.replace(/%/g, ''));
          const isHarvestable =
            dollarGainLoss < 0 && (percentLoss <= -5 || Math.abs(dollarGainLoss) >= 2500);
          const blockedTrade = proposedTrades?.find(
            (trade) =>
              trade.type === 'SELL' && trade.ticker === position.ticker && !trade.canExecute,
          );

          return (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onTickerClick(ticker)}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                {ticker}
              </button>
              {isHarvestable && <Flame className="w-4 h-4 text-orange-500" />}
              {blockedTrade && (
                <SimpleTooltip content={blockedTrade.blockingReason}>
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </SimpleTooltip>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'sleeveName',
        header: 'Sleeve',
        cell: ({ row }) => {
          const sleeveId = row.original.sleeveId;
          const sleeveName = row.original.sleeveName;

          // Check if there's no sleeve (either "No Sleeve" or empty)
          if (!sleeveName || sleeveName === 'No Sleeve') {
            return <span className="text-gray-500">None</span>;
          }

          return (
            <button
              type="button"
              onClick={() => onSleeveClick(sleeveId)}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {sleeveName}
            </button>
          );
        },
      },
      {
        accessorKey: 'qty',
        header: 'Qty',
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return formatQuantity(value);
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) as number;
          const b = rowB.getValue(columnId) as number;
          return a - b;
        },
      },
      {
        accessorKey: 'currentPrice',
        header: 'Price',
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return `$${value.toFixed(2)}`;
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = rowA.getValue(columnId) as number;
          const b = rowB.getValue(columnId) as number;
          return a - b;
        },
      },
      {
        accessorKey: 'marketValue',
        header: 'Market Value',
        cell: ({ getValue }) => getValue() as string,
        sortingFn: (rowA, rowB, columnId) => {
          const a = parseFloat((rowA.getValue(columnId) as string).replace(/[$,]/g, ''));
          const b = parseFloat((rowB.getValue(columnId) as string).replace(/[$,]/g, ''));
          return a - b;
        },
      },
      {
        id: 'costBasis',
        header: 'Cost Basis',
        cell: ({ row }) => {
          const position = row.original;
          return `$${(position.qty * position.costBasis).toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })}`;
        },
        sortingFn: (rowA, rowB, _columnId) => {
          const a = rowA.original.qty * rowA.original.costBasis;
          const b = rowB.original.qty * rowB.original.costBasis;
          return a - b;
        },
      },
      {
        id: 'gainLoss',
        header: 'Gain/Loss',
        cell: ({ row }) => {
          const position = row.original;
          return (
            <span
              className={
                position.dollarGainLoss.startsWith('-') ? 'text-red-600' : 'text-green-600'
              }
            >
              {position.dollarGainLoss} ({position.percentGainLoss})
            </span>
          );
        },
        sortingFn: (rowA, rowB, _columnId) => {
          const a = parseFloat(rowA.original.dollarGainLoss.replace(/[$,]/g, ''));
          const b = parseFloat(rowB.original.dollarGainLoss.replace(/[$,]/g, ''));
          return a - b;
        },
      },
      {
        accessorKey: 'daysHeld',
        header: 'Days Held',
        cell: ({ getValue }) => getValue() as number,
      },
    ],
    [proposedTrades, onTickerClick, onSleeveClick],
  );

  const table = useReactTable({
    data: positions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });

  if (!positions || positions.length === 0) {
    return <p className="text-gray-500">No positions found. Consider seeding demo data.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center space-x-1">
                    <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                    {header.column.getIsSorted() && (
                      <span>
                        {header.column.getIsSorted() === 'desc' ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </span>
                    )}
                    {!header.column.getIsSorted() && header.column.getCanSort() && (
                      <ChevronsUpDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
