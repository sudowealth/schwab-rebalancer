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
import { ChevronDown, ChevronsUpDown, ChevronUp, Filter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SP500Stock } from '../../lib/schemas';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface SP500TableProps {
  sp500Data: SP500Stock[];
  indices?: Array<{ id: string; name: string }>;
  selectedIndex?: string;
  onIndexChange?: (indexId: string) => void;
}

export function SP500Table({ sp500Data, indices, selectedIndex, onIndexChange }: SP500TableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'ticker', desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Debug logging
  useEffect(() => {
    console.log(
      `🔍 SP500Table: ${sp500Data?.length || 0} securities, selectedIndex: ${selectedIndex}`,
    );
    if (!sp500Data || sp500Data.length === 0) {
      console.warn('⚠️ SP500Table: No securities data received');
    }
  }, [sp500Data, selectedIndex]);

  const columns = useMemo<ColumnDef<SP500Stock>[]>(
    () => [
      {
        accessorKey: 'ticker',
        header: 'Ticker',
        cell: ({ getValue }) => getValue() as string,
      },
      {
        accessorKey: 'name',
        header: 'Company Name',
        cell: ({ getValue, row }) => {
          const name = getValue() as string;
          const ticker = row.original.ticker;
          return (
            <a
              href={`https://finance.yahoo.com/quote/${ticker}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              {name}
            </a>
          );
        },
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: ({ getValue }) =>
          `$${(getValue() as number).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
      },
      {
        accessorKey: 'marketCap',
        header: 'Market Cap',
        cell: ({ getValue }) => getValue() as string,
        sortingFn: (rowA, rowB, columnId) => {
          const parseMarketCap = (value: string): number => {
            const numStr = value.replace(/[^\d.TMB]/g, '');
            const num = parseFloat(numStr.replace(/[TMB]/g, ''));
            if (value.includes('T')) {
              return num * 1000000; // Convert trillions to millions
            } else if (value.includes('B')) {
              return num * 1000; // Convert billions to millions
            } else {
              return num; // Already in millions
            }
          };
          const a = parseMarketCap(rowA.getValue(columnId) as string);
          const b = parseMarketCap(rowB.getValue(columnId) as string);
          return a - b;
        },
      },
      {
        accessorKey: 'peRatio',
        header: 'P/E Ratio',
        cell: ({ getValue }) => {
          const value = getValue() as number | undefined;
          return value ? value.toFixed(2) : 'N/A';
        },
        sortingFn: (rowA, rowB, columnId) => {
          const a = (rowA.getValue(columnId) as number | undefined) || 0;
          const b = (rowB.getValue(columnId) as number | undefined) || 0;
          return a - b;
        },
      },
      {
        accessorKey: 'industry',
        header: 'Industry',
        cell: ({ getValue }) => getValue() as string,
      },
      {
        accessorKey: 'sector',
        header: 'Sector',
        cell: ({ getValue }) => {
          const sector = getValue() as string;
          return (
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
              {sector}
            </span>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: sp500Data,
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

  if (!sp500Data || sp500Data.length === 0) {
    return <p className="text-gray-500">No securities data found.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Index filter */}
      {indices && indices.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Filter className="h-3.5 w-3.5" />
            <span>Index</span>
          </div>
          <Select
            value={selectedIndex || 'all'}
            onValueChange={(value) => onIndexChange?.(value === 'all' ? '' : value)}
          >
            <SelectTrigger className="h-7 w-[160px] text-sm border-gray-200 bg-gray-50 hover:bg-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
              <SelectValue placeholder="All Securities" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All Securities</SelectItem>
              {indices.map((index) => (
                <SelectItem key={index.id} value={index.id}>
                  {index.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500 tabular-nums">{sp500Data.length}</span>
        </div>
      )}

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
    </div>
  );
}
