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
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { withDashboardErrorBoundary } from '~/components/ErrorBoundary';
import type { Transaction } from '~/features/auth/schemas';
import { formatQuantity } from '~/lib/utils';

interface TransactionsTableProps {
  transactions: Transaction[];
  onTickerClick: (ticker: string) => void;
  onSleeveClick: (sleeveId: string) => void;
}

function TransactionsTableComponent({
  transactions,
  onTickerClick,
  onSleeveClick,
}: TransactionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'executedAt', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        id: 'account',
        header: 'Account',
        cell: ({ row }) => row.original.accountName,
      },
      {
        id: 'accountNumber',
        header: 'Account #',
        cell: ({ row }) => row.original.accountNumber || 'N/A',
      },
      {
        accessorKey: 'executedAt',
        header: 'Date',
        cell: ({ getValue }) => new Date(getValue() as Date).toLocaleDateString(),
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
              onClick={(e) => {
                e.stopPropagation();
                onSleeveClick(sleeveId);
              }}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {sleeveName}
            </button>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => {
          const type = getValue() as string;
          return (
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                type === 'SELL' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}
            >
              {type}
            </span>
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
        accessorKey: 'price',
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
        accessorKey: 'realizedGainLoss',
        header: 'Realized G&L',
        cell: ({ row }) => {
          const transaction = row.original;
          if (transaction.realizedGainLoss !== 0) {
            const totalValue = transaction.qty * transaction.price;
            const costBasis = totalValue - transaction.realizedGainLoss;
            const percentage =
              costBasis !== 0 ? (transaction.realizedGainLoss / costBasis) * 100 : 0;

            return (
              <span
                className={transaction.realizedGainLoss < 0 ? 'text-red-600' : 'text-green-600'}
              >
                $
                {transaction.realizedGainLoss.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
                {` (${percentage >= 0 ? '' : ''}${percentage.toFixed(2)}%)`}
              </span>
            );
          }
          return <span className="text-gray-500">—</span>;
        },
      },
    ],
    [onTickerClick, onSleeveClick],
  );

  const table = useReactTable({
    data: transactions,
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

  if (!transactions || transactions.length === 0) {
    return <p className="text-gray-500">No transactions found.</p>;
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

export const TransactionsTable = withDashboardErrorBoundary(TransactionsTableComponent);
