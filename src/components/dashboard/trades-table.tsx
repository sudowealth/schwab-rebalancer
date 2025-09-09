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
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { WashSaleRestrictionIndicator } from '../../components/ui/wash-sale-tooltip';
import type { Trade } from '../../lib/schemas';
import { formatQuantity } from '../../lib/utils';

interface TradesTableProps {
  trades: Trade[];
  onTickerClick: (ticker: string) => void;
  onSleeveClick: (sleeveId: string) => void;
}

export function TradesTable({ trades, onTickerClick, onSleeveClick }: TradesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'account', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns = useMemo<ColumnDef<Trade>[]>(
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
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => {
          const type = getValue() as string;
          return (
            <span
              className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-full ${
                type === 'SELL' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}
            >
              {type === 'SELL' ? (
                <ArrowDownLeft className="w-3 h-3" />
              ) : (
                <ArrowUpRight className="w-3 h-3" />
              )}
              <span>{type}</span>
            </span>
          );
        },
      },
      {
        accessorKey: 'ticker',
        header: 'Ticker',
        cell: ({ getValue }) => {
          const ticker = getValue() as string;
          return (
            <button
              type="button"
              onClick={() => onTickerClick(ticker)}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              {ticker}
            </button>
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
        accessorKey: 'estimatedValue',
        header: 'Est. Value',
        cell: ({ getValue }) =>
          `$${(getValue() as number).toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })}`,
      },
      {
        id: 'reason',
        header: 'Reason',
        cell: ({ row }) => {
          const trade = row.original;
          return !trade.canExecute ? (
            <WashSaleRestrictionIndicator blockingReason={trade.blockingReason} />
          ) : (
            <span>{trade.reason}</span>
          );
        },
      },
      {
        accessorKey: 'canExecute',
        header: 'Status',
        cell: ({ getValue }) => {
          const canExecute = getValue() as boolean;
          return canExecute ? (
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              Ready
            </span>
          ) : (
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
              Blocked
            </span>
          );
        },
      },
    ],
    [onTickerClick, onSleeveClick],
  );

  const table = useReactTable({
    data: trades,
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

  if (!trades || trades.length === 0) {
    return (
      <p className="text-gray-500">
        No trades proposed. No positions meet the harvesting criteria or all potential trades are
        blocked.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Proposed Tax-Loss Harvesting Trades
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                These trades would harvest losses from positions meeting the -5% or -$2,500
                threshold. Only executable trades have replacement securities available in their
                sleeves.
              </p>
            </div>
          </div>
        </div>
      </div>
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
              <tr key={row.id} className={row.original.canExecute ? '' : 'bg-red-50'}>
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
    </div>
  );
}
