import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import type { RebalancingGroup } from '../../lib/schemas';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface RebalancingGroupsTabProps {
  groups: RebalancingGroup[];
}

export function RebalancingGroupsTab({ groups }: RebalancingGroupsTabProps) {
  console.log('🎯 [RebalancingGroupsTab] Component called with groups:', groups?.length || 0);
  console.log('🎯 [RebalancingGroupsTab] Groups data:', groups);

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

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No rebalancing groups found</p>
        <p className="text-sm text-gray-400 mt-1">Create a rebalancing group to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div
          key={group.id}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {/* Group Name */}
              <Link
                to="/rebalancing-groups/$groupId"
                params={{ groupId: group.id }}
                className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {group.name}
              </Link>

              {/* Group Statistics */}
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Total Value:</span>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatBalance(calculateGroupValue(group))}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-500">Model:</span>
                  <div className="mt-1">
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
                </div>

                <div>
                  <span className="text-sm text-gray-500">Accounts:</span>
                  <div className="text-sm text-gray-700 mt-1">
                    {group.members.length} account{group.members.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Account Members Preview */}
              <div className="mt-3">
                <span className="text-xs text-gray-500">Accounts:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {group.members.slice(0, 3).map((member) => (
                    <Badge key={member.id} variant="outline" className="text-xs">
                      {member.accountName || 'Unnamed Account'}
                    </Badge>
                  ))}
                  {group.members.length > 3 && (
                    <Badge variant="outline" className="text-xs text-gray-400">
                      +{group.members.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="ml-4 flex-shrink-0">
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
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
