import type { NavigateOptions } from '@tanstack/react-router';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
  Filter,
  Search,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import type { SP500Stock } from '~/features/auth/schemas';

type SearchParams = {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  index?: string;
};

interface SecuritiesTableProps {
  sp500Data: SP500Stock[];
  indices?: Array<{ id: string; name: string }>;
  selectedIndex?: string;
  onIndexChange?: (indexId: string) => void;
  searchParams?: SearchParams;
  // Route-scoped navigate to ensure search updates target this route
  navigate?: (opts: NavigateOptions) => void;
}

export function SecuritiesTable({
  sp500Data,
  indices,
  selectedIndex,
  onIndexChange,
  searchParams,
  navigate,
}: SecuritiesTableProps) {
  // Require a route-scoped navigate passed from the parent route.
  // This avoids updating the root search and prevents URL reversion.
  // Derive all state directly from URL params - single source of truth
  const sorting: SortingState = [
    {
      id: searchParams?.sortBy ?? 'ticker',
      desc: searchParams?.sortOrder === 'desc',
    },
  ];
  const globalFilter = searchParams?.search ?? '';
  const pageSize = searchParams?.pageSize ?? 100;

  // Debug logging
  useEffect(() => {
    console.log(
      `🔍 SecuritiesTable: ${sp500Data?.length || 0} securities, selectedIndex: ${selectedIndex}`,
    );
    if (!sp500Data || sp500Data.length === 0) {
      console.warn('⚠️ SecuritiesTable: No securities data received');
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
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer block truncate max-w-[200px]"
              title={name}
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
            const num = Number.parseFloat(numStr.replace(/[TMB]/g, ''));
            if (value.includes('T')) {
              return num * 1000000; // Convert trillions to millions
            }
            if (value.includes('B')) {
              return num * 1000; // Convert billions to millions
            }
            return num; // Already in millions
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
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters: [],
      globalFilter,
      pagination: {
        pageIndex: (searchParams?.page ?? 1) - 1, // Convert 1-based to 0-based
        pageSize,
      },
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      if (newSorting.length > 0) {
        const sortBy = newSorting[0]?.id || 'ticker';
        const sortOrder = newSorting[0]?.desc ? 'desc' : 'asc';
        navigate?.({
          search: (prev: SearchParams) => ({
            ...prev,
            sortBy,
            sortOrder,
            page: 1, // Reset to first page when sorting changes
          }),
          replace: true,
        });
      }
    },
    onColumnFiltersChange: () => {},
    onGlobalFilterChange: (newFilter) => {
      navigate?.({
        search: (prev: SearchParams) => ({
          ...prev,
          search: newFilter || '',
          page: 1, // Reset to first page when search changes
        }),
        replace: true,
      });
    },
    // Do not use onPaginationChange; we drive pagination solely via URL
    onPaginationChange: undefined,
    globalFilterFn: 'includesString',
  });

  // Convenience values derived from URL
  const currentPage = (searchParams?.page ?? 1) as number;
  const pageCount = table.getPageCount();

  const goToPage = (page: number) => {
    const safe = Math.min(Math.max(1, page), Math.max(1, pageCount));
    if (safe === currentPage) return;
    navigate?.({
      search: (prev: SearchParams) => ({
        ...prev,
        page: safe,
      }),
      replace: true,
    });
  };

  if (!sp500Data || sp500Data.length === 0) {
    return <p className="text-gray-500">No securities data found.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Controls section */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Left side - Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
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
            </div>
          )}

          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                const newSize = Number.parseInt(value, 10);
                navigate?.({
                  search: (prev: SearchParams) => ({
                    ...prev,
                    pageSize: newSize,
                    page: 1, // Reset to first page when page size changes
                  }),
                  replace: true,
                });
              }}
            >
              <SelectTrigger className="h-7 w-[80px] text-sm border-gray-200 bg-gray-50 hover:bg-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="250">250</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600">per page</span>
          </div>
        </div>

        {/* Right side - Search */}
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
          </div>
          <div className="relative flex-1 sm:w-[300px]">
            <Input
              placeholder="Search securities..."
              value={globalFilter}
              onChange={(e) => {
                navigate?.({
                  search: (prev: SearchParams) => ({
                    ...prev,
                    search: e.target.value,
                    page: 1, // Reset to first page when search changes
                  }),
                  replace: true,
                });
              }}
              className="h-7 text-sm border-gray-200 bg-gray-50 hover:bg-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 pr-8"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => {
                  navigate?.({
                    search: (prev: SearchParams) => ({
                      ...prev,
                      search: '',
                      page: 1, // Reset to first page when search is cleared
                    }),
                    replace: true,
                  });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table info */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-4">
          <span>
            Showing {(table.getState().pagination.pageIndex * pageSize + 1).toLocaleString()} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * pageSize,
              table.getFilteredRowModel().rows.length,
            ).toLocaleString()}{' '}
            of {table.getFilteredRowModel().rows.length.toLocaleString()} securities
          </span>
          {globalFilter && (
            <span className="text-blue-600">
              Filtered from {sp500Data.length.toLocaleString()} total
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-md">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center space-x-1">
                        <span>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
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
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                    {globalFilter
                      ? 'No securities found matching your search.'
                      : 'No securities data available.'}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination controls */}
      {table.getFilteredRowModel().rows.length > pageSize && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Page</span>
            <span className="font-medium">{table.getState().pagination.pageIndex + 1}</span>
            <span>of</span>
            <span className="font-medium">{table.getPageCount()}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(1)}
              disabled={currentPage <= 1}
              className="h-8 px-2"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
                const pageIndex =
                  Math.max(
                    0,
                    Math.min(table.getPageCount() - 5, table.getState().pagination.pageIndex - 2),
                  ) + i;

                if (pageIndex >= table.getPageCount()) return null;

                return (
                  <Button
                    key={pageIndex}
                    variant={
                      pageIndex === table.getState().pagination.pageIndex ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => goToPage(pageIndex + 1)}
                    className="h-8 w-8 p-0"
                  >
                    {pageIndex + 1}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              className="h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pageCount)}
              disabled={currentPage >= pageCount}
              className="h-8 px-2"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
