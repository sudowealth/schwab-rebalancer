import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowRight, ChevronDown, ChevronsUpDown, ChevronUp, Edit, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { SleeveModal } from '../../components/dashboard/sleeve-modal';
import { DeleteModelModal } from '../../components/models/delete-model-modal';
import { EditModelModal } from '../../components/models/edit-model-modal';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import type { RebalancingGroup, Sleeve } from '../../lib/schemas';
import {
  getDashboardDataServerFn,
  getModelByIdServerFn,
  getRebalancingGroupsServerFn,
} from '../../lib/server-functions';

export const Route = createFileRoute('/models/$modelId')({
  component: ModelDetailComponent,
  loader: async ({ params: { modelId } }) => {
    try {
      // Try to load the specific model and dashboard data
      const [model, dashboardData] = await Promise.all([
        getModelByIdServerFn({ data: { modelId } }),
        getDashboardDataServerFn(),
      ]);

      // Get all rebalancing groups and filter to those assigned to this model
      const allRebalancingGroups = await getRebalancingGroupsServerFn();
      const rebalancingGroups = allRebalancingGroups.filter(
        (group) => group.assignedModel?.id === modelId,
      );

      return { model, dashboardData, rebalancingGroups };
    } catch (error) {
      // If authentication error, redirect to login
      if (error instanceof Error && error.message.includes('Authentication required')) {
        throw redirect({ to: '/login', search: { reset: '' } });
      }
      // If model not found or other error, redirect to models list
      throw redirect({ to: '/models', search: { reset: '' } });
    }
  },
});

interface RebalancingGroupsTableProps {
  groups: RebalancingGroup[];
}

function RebalancingGroupsTable({ groups }: RebalancingGroupsTableProps) {
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
            <Link
              to="/models/$modelId"
              params={{ modelId: group.assignedModel.id }}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              <Badge variant="secondary" className="text-xs cursor-pointer">
                {group.assignedModel.name}
              </Badge>
            </Link>
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
        <p className="text-sm text-gray-400 mt-1">No groups are currently using this model</p>
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

function ModelDetailComponent() {
  const { model, dashboardData, rebalancingGroups } = Route.useLoaderData();

  // Transform rebalancing groups for the modal (only need id and name)
  const modalRebalancingGroups =
    rebalancingGroups?.map((group) => ({
      id: group.id,
      name: group.name,
    })) || [];

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null);
  const [showSleeveModal, setShowSleeveModal] = useState(false);

  const handleEditModel = () => {
    setEditModalOpen(true);
  };

  const handleDeleteModel = () => {
    setDeleteModalOpen(true);
  };

  const handleSleeveClick = (sleeveId: string) => {
    setSelectedSleeve(sleeveId);
    setShowSleeveModal(true);
  };

  const closeModals = () => {
    setEditModalOpen(false);
    setDeleteModalOpen(false);
    setShowSleeveModal(false);
    setSelectedSleeve(null);
  };

  if (!model) {
    return (
      <div className="px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Model not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{model.name}</h1>
            {model.description && <p className="mt-1 text-sm text-gray-600">{model.description}</p>}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleEditModel}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Model
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeleteModel}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Model
            </Button>
          </div>
        </div>
      </div>

      {/* Model Details */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Model Sleeve Members</h3>
              <Badge
                variant={model.isActive ? 'default' : 'secondary'}
                className={
                  model.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }
              >
                {model.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {model.members.length > 0 ? (
              <div className="space-y-3">
                {model.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div>
                        <button
                          type="button"
                          onClick={() => handleSleeveClick(member.sleeveId)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                        >
                          {member.sleeveName || member.sleeveId}
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {(member.targetWeight / 100).toFixed(1)}%
                      </div>
                      <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${member.targetWeight / 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No allocations found for this model.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rebalancing Groups Section */}
      <div className="bg-white shadow rounded-lg mt-6">
        <div className="px-4 py-5 sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">Rebalancing Groups</h3>
            <p className="mt-1 text-sm text-gray-600">Rebalancing groups that use this model.</p>
          </div>
          <RebalancingGroupsTable groups={rebalancingGroups || []} />
        </div>
      </div>

      {/* Edit Modal */}
      <EditModelModal
        model={model}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onClose={closeModals}
      />

      {/* Delete Modal */}
      <DeleteModelModal
        model={model}
        rebalancingGroups={modalRebalancingGroups}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onClose={closeModals}
      />

      {/* Sleeve Modal */}
      <SleeveModal
        isOpen={showSleeveModal}
        onClose={() => setShowSleeveModal(false)}
        sleeve={
          selectedSleeve
            ? dashboardData?.sleeves?.find((s: Sleeve) => s.id === selectedSleeve) || null
            : null
        }
      />
    </div>
  );
}
