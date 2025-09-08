import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AddRebalancingGroupModal } from "../../components/rebalancing-groups/add-rebalancing-group-modal";
import { Badge } from "../../components/ui/badge";
import type { RebalancingGroup } from "../../lib/schemas";
import { getRebalancingGroupsServerFn, getGroupAccountHoldingsServerFn } from "../../lib/server-functions";

export const Route = createFileRoute("/rebalancing-groups/")({
  component: RebalancingGroupsComponent,
  loader: async () => {
    try {
      // Server function handles authentication
      const groups = await getRebalancingGroupsServerFn();

      // Get account holdings for all groups to calculate proper balances
      const updatedGroups = await Promise.all(
        groups.map(async (group) => {
          const accountIds = group.members.map((member) => member.accountId);
          const accountHoldings = accountIds.length > 0
            ? await getGroupAccountHoldingsServerFn({
                data: { accountIds },
              })
            : [];

          // Update group members with calculated balances from holdings
          const updatedMembers = group.members.map((member) => {
            const accountData = accountHoldings.find(
              (ah) => ah.accountId === member.accountId
            );
            return {
              ...member,
              balance: accountData ? accountData.accountBalance : member.balance,
            };
          });

          return {
            ...group,
            members: updatedMembers,
          };
        })
      );

      return { groups: updatedGroups };
    } catch (error) {
      // If authentication error, redirect to login
      if (error instanceof Error && error.message.includes("Authentication required")) {
        throw redirect({ to: "/login", search: { reset: "" } });
      }
      // Re-throw other errors
      throw error;
    }
  },
});

function RebalancingGroupsComponent() {
  const loaderData = Route.useLoaderData();
  const groups = loaderData.groups;

  // Server-side auth check in loader handles authentication

  // Helper to format account balance
  const formatBalance = (balance: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(balance);
  };

  // Helper to calculate total group value
  const calculateGroupValue = (group: RebalancingGroup): number => {
    return group.members.reduce(
      (total, member) => total + (member.balance || 0),
      0
    );
  };

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Rebalancing Groups
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage account groups for portfolio rebalancing and model
              assignment
            </p>
          </div>
          <AddRebalancingGroupModal />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {groups.map((group) => (
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
                  <span className="text-sm text-gray-500 font-medium">
                    Total Value:
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatBalance(calculateGroupValue(group))}
                  </span>
                </div>
              </div>

              {/* Account Members */}
              <div className="space-y-3">
                {group.members.slice(0, 3).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-700">
                      {member.accountName}
                    </span>
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
                    {group.members.length - 3 > 1 ? "s" : ""}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {groups.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No rebalancing groups found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new rebalancing group.
          </p>
        </div>
      )}
    </div>
  );
}
