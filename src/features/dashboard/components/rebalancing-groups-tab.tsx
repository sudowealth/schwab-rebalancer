import { Link } from '@tanstack/react-router';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowRight, ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import type { RebalancingGroup } from '~/features/auth/schemas';

interface RebalancingGroupsTabProps {
  groups: RebalancingGroup[];
}

export function RebalancingGroupsTab({ groups }: RebalancingGroupsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'group', desc: false }]);

  // Helper to format account balance
  const formatBalance = useCallback((balance: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(balance);
  }, []);

  // Helper to calculate total group value
  const calculateGroupValue = useCallback((group: RebalancingGroup): number => {
    return group.members.reduce((total, member) => total + (member.balance || 0), 0);
  }, []);

  const columns = useMemo<ColumnDef<RebalancingGroup>[]>(
    () => [
      {
        id: 'group',
        accessorKey: 'name',
        header: 'Group',
        cell: ({ getValue, row }) => {
          const groupName = getValue() as string;
          const group = row.original;
          return (
            <Link
              to="/rebalancing-groups/$groupId"
              params={{ groupId: group.id }}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              {groupName}
            </Link>
          );
        },
      },
      {
        id: 'model',
        header: 'Model',
        cell: ({ row }) => {
          const group = row.original;
          return group.assignedModel ? (
            <a
              href={`/models/${group.assignedModel.id}`}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              <Badge variant="secondary" className="text-xs cursor-pointer">
                {group.assignedModel.name}
              </Badge>
            </a>
          ) : (
            <Badge variant="outline" className="text-xs text-gray-400">
              No model assigned
            </Badge>
          );
        },
      },
      {
        id: 'accounts',
        header: 'Accounts',
        cell: ({ row }) => {
          const group = row.original;
          return (
            <div className="flex flex-wrap gap-1">
              {group.members.slice(0, 2).map((member) => (
                <Badge key={member.id} variant="outline" className="text-xs">
                  {member.accountName || 'Unnamed Account'}
                </Badge>
              ))}
              {group.members.length > 2 && (
                <Badge variant="outline" className="text-xs text-gray-400">
                  +{group.members.length - 2}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'value',
        header: 'Value',
        cell: ({ row }) => {
          const group = row.original;
          const totalValue = calculateGroupValue(group);
          return <span className="font-medium text-gray-900">{formatBalance(totalValue)}</span>;
        },
        sortingFn: (rowA, rowB, _columnId) => {
          const a = calculateGroupValue(rowA.original);
          const b = calculateGroupValue(rowB.original);
          return a - b;
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const group = row.original;
          return (
            <Button asChild size="sm" className="flex items-center gap-2">
              <Link
                to="/rebalancing-groups/$groupId"
                params={{ groupId: group.id }}
                search={{ rebalance: 'true' }}
              >
                Rebalance
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          );
        },
      },
    ],
    [formatBalance, calculateGroupValue],
  );

  const table = useReactTable({
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  if (!groups || groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No rebalancing groups found</p>
        <p className="text-sm text-gray-400 mt-1">Create a rebalancing group to get started</p>
      </div>
    );
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
