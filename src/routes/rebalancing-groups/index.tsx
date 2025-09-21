import { createFileRoute, Link } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { Badge } from '~/components/ui/badge';
import type { RebalancingGroup, RebalancingGroupMember } from '~/features/auth/schemas';
import { AddRebalancingGroupModal } from '~/features/rebalancing/components/add-rebalancing-group-modal';
// Static import for server function
import { getHoldingsForMultipleGroupsServerFn } from '~/features/rebalancing/groups.server';
import { authGuard } from '~/lib/route-guards';

export const Route = createFileRoute('/rebalancing-groups/')({
  component: RebalancingGroupsComponent,
  validateSearch: (search: Record<string, unknown>) => {
    const result: { createGroup?: string } = {};
    if (typeof search.createGroup === 'string') {
      result.createGroup = search.createGroup;
    }
    return result;
  },
  beforeLoad: authGuard,
  loader: async () => {
    // Auth is handled by beforeLoad, loader only fetches data
    const { groups, holdings } = await getHoldingsForMultipleGroupsServerFn();

    // Create a map of account balances for efficient lookup
    const accountBalanceMap = new Map<string, number>();
    holdings.forEach((account) => {
      accountBalanceMap.set(account.accountId, account.accountBalance);
    });

    // Update group members with calculated balances from holdings
    const updatedGroups = groups.map((group: RebalancingGroup) => {
      const updatedMembers = group.members.map((member: RebalancingGroupMember) => {
        const balance = accountBalanceMap.get(member.accountId);
        return {
          ...member,
          balance: balance ?? member.balance ?? 0,
        };
      });

      return {
        ...group,
        members: updatedMembers,
      };
    });

    return { groups: updatedGroups };
  },
});

function RebalancingGroupsComponent() {
  // Use loader data for SSR
  const loaderData = Route.useLoaderData();
  const groups = loaderData?.groups || [];
  const searchParams = Route.useSearch();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Auth is handled by beforeLoad

  // Handle URL parameter to open create modal
  useEffect(() => {
    if (searchParams.createGroup === 'true') {
      setShowCreateModal(true);
      // Clean up URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams.createGroup]);

  // Helper to format account balance
  const formatBalance = (balance: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(balance);
  };

  // Helper to calculate total group value
  const calculateGroupValue = (group: RebalancingGroup): number => {
    return group.members.reduce((total, member) => total + (member.balance || 0), 0);
  };

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rebalancing Groups</h1>
            <p className="mt-2 text-sm text-gray-600">
              Groups of accounts for portfolio rebalancing
            </p>
          </div>
          <AddRebalancingGroupModal
            isOpen={showCreateModal}
            onOpenChange={setShowCreateModal}
            autoSelectSingleOptions={true}
          />
        </div>
      </div>

      <ErrorBoundaryWrapper
        title="Rebalancing Groups Error"
        description="Failed to load rebalancing groups. This might be due to a temporary data issue."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {groups.map((group: RebalancingGroup) => (
            <div
              key={group.id}
              className="bg-white shadow rounded-lg hover:shadow-md transition-shadow relative"
            >
              <div className="p-6">
                <div className="mb-6">
                  <Link
                    to="/rebalancing-groups/$groupId"
                    params={{ groupId: group.id }}
                    className="text-xl font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {group.name}
                  </Link>
                </div>

                {/* Model */}
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-gray-500 font-medium">Model:</span>
                  {group.assignedModel ? (
                    <Badge variant="secondary" className="text-xs">
                      {group.assignedModel.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-gray-400">
                      No model assigned
                    </Badge>
                  )}
                </div>

                {/* Group Statistics */}
                <div className="border-t border-b border-gray-100 py-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 font-medium">Total Value:</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatBalance(calculateGroupValue(group))}
                    </span>
                  </div>
                </div>

                {/* Account Members */}
                <div className="space-y-3">
                  {group.members.slice(0, 3).map((member: RebalancingGroupMember) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{member.accountName}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatBalance(member.balance || 0)}
                      </span>
                    </div>
                  ))}
                  {group.members.length > 3 && (
                    <Link
                      to="/rebalancing-groups/$groupId"
                      params={{ groupId: group.id }}
                      className="text-xs text-gray-500 cursor-pointer hover:text-blue-600 transition-colors block pt-2"
                    >
                      +{group.members.length - 3} more account
                      {group.members.length - 3 > 1 ? 's' : ''}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ErrorBoundaryWrapper>
      {groups.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No rebalancing groups found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new rebalancing group.
          </p>
        </div>
      )}
    </div>
  );
}
