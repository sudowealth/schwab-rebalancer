import { createServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '~/db/schema';
import type { RebalancingGroup } from '~/features/auth/schemas';
import {
  calculateSleeveAllocations,
  generateAllocationData,
  generateSleeveTableData,
  generateTopHoldingsData,
  transformAccountHoldingsForClient,
  transformSleeveAllocationDataForClient,
  transformSleeveTableDataForClient,
} from '~/features/rebalancing/utils/rebalancing-utils';
import type { AccountHoldingsResult } from '~/lib/db-api';
import {
  assignModelToGroup,
  createRebalancingGroup,
  deleteRebalancingGroup,
  getAccountHoldings,
  getGroupTransactions,
  getOrdersForAccounts,
  getPositions,
  getProposedTrades,
  getRebalancingGroupById,
  getRebalancingGroups,
  getSleeveMembers,
  getSnP500Data,
  unassignModelFromGroup,
  updateRebalancingGroup,
} from '~/lib/db-api';
import { getDb } from '~/lib/db-config';
import { throwServerError } from '~/lib/error-utils';
import { requireAuth } from '../../auth/auth-utils';

// Helper functions for focused responsibilities

/**
 * Calculates analytics data for a rebalancing group
 * Separated from data fetching for better separation of concerns
 */
function calculateRebalancingGroupAnalytics(
  group: NonNullable<Awaited<ReturnType<typeof getRebalancingGroupById>>>,
  accountHoldings: AccountHoldingsResult,
  sp500Data: Awaited<ReturnType<typeof getSnP500Data>>,
) {
  // Update group members with calculated balances from holdings
  const updatedGroupMembers = group.members.map((member) => {
    const accountData = accountHoldings.find((ah) => ah.accountId === member.accountId);
    return {
      ...member,
      balance: accountData ? accountData.accountBalance : 0,
    };
  });

  // Calculate total portfolio value server-side
  const totalValue = updatedGroupMembers.reduce((sum, member) => sum + (member.balance || 0), 0);

  // Fetch allocation and holdings data with the calculated total value
  const allocationData = generateAllocationData(
    'sleeve',
    group,
    accountHoldings,
    sp500Data,
    totalValue,
  );
  const holdingsData = generateTopHoldingsData(accountHoldings, totalValue);

  return {
    updatedGroupMembers,
    totalValue,
    allocationData,
    holdingsData,
  };
}

// Zod schemas for type safety
const createRebalancingGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  members: z
    .array(
      z.object({
        accountId: z.string().min(1, 'Account ID is required'),
      }),
    )
    .min(1, 'At least one member is required'),
  updateExisting: z.boolean().optional().default(false),
});

const updateRebalancingGroupSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  name: z.string().min(1, 'Group name is required'),
  members: z
    .array(
      z.object({
        accountId: z.string().min(1, 'Account ID is required'),
      }),
    )
    .min(1, 'At least one member is required'),
});

// Server function to get all rebalancing groups - runs ONLY on server
export const getRebalancingGroupsServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  // Handle unauthenticated requests gracefully during SSR

  try {
    const { user } = await requireAuth();
    const _db = getDb();
    const groups = await getRebalancingGroups(user.id);
    return groups;
  } catch (error) {
    // Handle authentication errors gracefully during SSR
    console.warn('Rebalancing groups load failed during SSR, returning empty data:', error);
    return [];
  }
});

// Server function to create a new rebalancing group - runs ONLY on server
export const createRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .validator(createRebalancingGroupSchema)

  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = getDb();
    const { name, members, updateExisting } = data;

    if (!name || !members || !Array.isArray(members)) {
      throwServerError('Invalid request: name and members array required', 400);
    }
    const groupId = await createRebalancingGroup({ name, members, updateExisting }, user.id);
    return { success: true, groupId };
  });

// Server function to update a rebalancing group - runs ONLY on server
export const updateRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .validator(updateRebalancingGroupSchema)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = getDb();
    const { groupId, name, members } = data;

    if (!groupId || !name || !members || !Array.isArray(members)) {
      throwServerError('Invalid request: groupId, name and members array required', 400);
    }
    await updateRebalancingGroup(groupId, { name, members }, user.id);
    return { success: true };
  });

// Server function to delete a rebalancing group - runs ONLY on server
export const deleteRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .validator((data: { groupId: string }) => data)

  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = getDb();
    const { groupId } = data;

    if (!groupId) {
      throwServerError('Invalid request: groupId required', 400);
    }

    await deleteRebalancingGroup(groupId, user.id);
    return { success: true };
  });

// Server function to get rebalancing group by ID - runs ONLY on server
export const getRebalancingGroupByIdServerFn = createServerFn({
  method: 'POST',
})
  .validator((data: { groupId: string }) => data)

  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = getDb();
    const { groupId } = data;

    if (!groupId) {
      throwServerError('Invalid request: groupId required', 400);
    }

    const group = await getRebalancingGroupById(groupId, user.id);
    return group;
  });

// Server function to get account holdings for rebalancing group - runs ONLY on server
export const getGroupAccountHoldingsServerFn = createServerFn({
  method: 'POST',
})
  .validator((data: { accountIds: string[] }) => data)
  .handler(async ({ data }): Promise<AccountHoldingsResult> => {
    const { accountIds } = data;

    if (!accountIds || accountIds.length === 0) {
      throwServerError('Invalid request: accountIds required', 400);
    }

    // Handle unauthenticated requests gracefully during SSR

    try {
      const { user } = await requireAuth();
      const _db = getDb();
      // Verify that all accountIds belong to the authenticated user

      const ownedAccounts = await getDb()
        .select({ id: schema.account.id })
        .from(schema.account)
        .where(and(eq(schema.account.userId, user.id), inArray(schema.account.id, accountIds)));

      if (ownedAccounts.length !== accountIds.length) {
        throwServerError('Access denied: One or more accounts do not belong to you', 403);
      }

      const result = await getAccountHoldings(accountIds);
      return result;
    } catch (error) {
      // Handle authentication errors gracefully during SSR
      console.warn('Group account holdings load failed during SSR, returning empty data:', error);
      return [];
    }
  });

export type GroupAccountHoldingsResult = AccountHoldingsResult;

// Server function to get holdings for multiple rebalancing groups - runs ONLY on server
export const getHoldingsForMultipleGroupsServerFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<{ groups: RebalancingGroup[]; holdings: AccountHoldingsResult }> => {
  const { user } = await requireAuth();
  const _db = getDb();

  // Get all groups for the user
  const groups = await getRebalancingGroups(user.id);

  // Collect all account IDs from all groups
  const allAccountIds = groups.flatMap((group) => group.members.map((member) => member.accountId));

  // Get holdings for all accounts in a single query
  const holdings = allAccountIds.length > 0 ? await getAccountHoldings(allAccountIds) : [];

  return { groups, holdings };
});

// Server function to get sleeve members (target securities) - runs ONLY on server
export const getSleeveMembersServerFn = createServerFn({ method: 'POST' })
  .validator((data: { sleeveIds: string[] }) => data)
  .handler(async ({ data }) => {
    await requireAuth();
    const _db = getDb();
    const { sleeveIds } = data;

    if (!sleeveIds || sleeveIds.length === 0) {
      throwServerError('Invalid request: sleeveIds required', 400);
    }

    const sleeveMembers = await getSleeveMembers(sleeveIds);
    return sleeveMembers;
  });

// Server function to get rebalancing groups with calculated balances - runs ONLY on server
export const getRebalancingGroupsWithBalancesServerFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<RebalancingGroup[]> => {
  // Handle unauthenticated requests gracefully during SSR

  try {
    const { user } = await requireAuth();
    const _db = getDb();

    // Get all rebalancing groups for the user
    const groups = await getRebalancingGroups(user.id);

    // Collect all account IDs from all groups
    const allAccountIds = groups.flatMap((group) =>
      group.members.map((member) => member.accountId),
    );

    // Get account holdings for all accounts in a single query
    const accountHoldings = allAccountIds.length > 0 ? await getAccountHoldings(allAccountIds) : [];

    // Update group members with calculated balances from holdings
    const updatedGroups = groups.map((group) => {
      const updatedMembers = group.members.map((member) => {
        const accountData = accountHoldings.find((ah) => ah.accountId === member.accountId);
        return {
          ...member,
          balance: accountData ? accountData.accountBalance : member.balance,
        };
      });

      return {
        ...group,
        members: updatedMembers,
      };
    });

    return updatedGroups;
  } catch (error) {
    // Handle authentication errors gracefully during SSR
    console.warn(
      'Rebalancing groups with balances load failed during SSR, returning empty data:',
      error,
    );
    return [];
  }
});

export type SleeveMember = Awaited<ReturnType<typeof getSleeveMembersServerFn>>[number];

// Server function to get complete rebalancing group data with all related information - runs ONLY on server
export const getRebalancingGroupDataServerFn = createServerFn({
  method: 'POST',
})
  .validator((data: { groupId: string }) => data)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const { groupId } = data;

    if (!groupId) {
      throwServerError('Invalid request: groupId required', 400);
    }

    // Get the group first to extract account IDs and check for assigned model
    const group = await getRebalancingGroupById(groupId, user.id);
    if (!group) {
      throwServerError('Rebalancing group not found', 404);
    }

    // TypeScript needs explicit assertion after async operation
    const safeGroup = group as NonNullable<typeof group>;
    const accountIds = safeGroup.members.map((member) => member.accountId);

    // Get sleeve members (target securities) if there's an assigned model
    let sleeveMembers: Awaited<ReturnType<typeof getSleeveMembersServerFn>> = [];
    if (safeGroup.assignedModel?.members && safeGroup.assignedModel.members.length > 0) {
      const sleeveIds = safeGroup.assignedModel.members.map((member) => member.sleeveId);
      if (sleeveIds.length > 0) {
        sleeveMembers = await getSleeveMembers(sleeveIds);
      }
    }

    // Fetch all raw data in parallel to eliminate waterfall loading
    const [
      accountHoldingsResult,
      transactionsResult,
      sp500DataResult,
      positionsResult,
      proposedTradesResult,
      groupOrdersResult,
    ] = await Promise.allSettled([
      accountIds.length > 0 ? getAccountHoldings(accountIds) : Promise.resolve([]),
      accountIds.length > 0 ? getGroupTransactions(accountIds) : Promise.resolve([]),
      getSnP500Data(),
      getPositions(),
      getProposedTrades(),
      getOrdersForAccounts(accountIds),
    ]);

    // Extract successful results, fallback to empty arrays for failed promises
    const accountHoldings =
      accountHoldingsResult.status === 'fulfilled' ? accountHoldingsResult.value : [];
    const transactions = transactionsResult.status === 'fulfilled' ? transactionsResult.value : [];
    const sp500Data = sp500DataResult.status === 'fulfilled' ? sp500DataResult.value : [];
    const positions = positionsResult.status === 'fulfilled' ? positionsResult.value : [];
    const proposedTrades =
      proposedTradesResult.status === 'fulfilled' ? proposedTradesResult.value : [];
    const groupOrders = groupOrdersResult.status === 'fulfilled' ? groupOrdersResult.value : [];

    // Calculate analytics data (separated for better separation of concerns)
    const { updatedGroupMembers, allocationData, holdingsData } =
      calculateRebalancingGroupAnalytics(safeGroup, accountHoldings, sp500Data);

    // Calculate sleeve allocation data (heavy calculations moved server-side)
    const rawSleeveAllocationData = calculateSleeveAllocations(
      safeGroup,
      accountHoldings,
      sleeveMembers,
      transactions,
    );

    // Calculate sleeve table data
    const totalValue = safeGroup.members.reduce(
      (sum: number, member) => sum + (member.balance || 0),
      0,
    );
    const rawSleeveTableData = generateSleeveTableData(rawSleeveAllocationData, 'all', totalValue);

    // Apply server-side transformations to match component expectations
    const sleeveTableData = transformSleeveTableDataForClient(rawSleeveTableData);
    const sleeveAllocationData = transformSleeveAllocationDataForClient(rawSleeveAllocationData);

    return {
      group: {
        id: safeGroup.id,
        name: safeGroup.name,
        isActive: safeGroup.isActive,
        members: updatedGroupMembers,
        assignedModel: safeGroup.assignedModel,
        createdAt: safeGroup.createdAt as Date,
        updatedAt: safeGroup.updatedAt as Date,
      },
      accountHoldings,
      sleeveMembers,
      sp500Data,
      transactions,
      positions,
      proposedTrades,
      allocationData,
      holdingsData,
      sleeveTableData,
      sleeveAllocationData, // Pre-transformed for client components
      groupOrders,
      transformedAccountHoldings: transformAccountHoldingsForClient(accountHoldings), // Pre-transformed for client components
    } as any; // Type assertion to bypass complex type inference issues while maintaining functionality
  });

// Server function to assign a model to a rebalancing group - runs ONLY on server
export const assignModelToGroupServerFn = createServerFn({ method: 'POST' })
  .validator((data: { modelId: string; groupId: string }) => data)

  .handler(async ({ data }) => {
    const { modelId, groupId } = data;

    if (!modelId || !groupId) {
      throwServerError('Invalid request: modelId and groupId required', 400);
    }

    const { user } = await requireAuth();
    const _db = getDb();
    await assignModelToGroup(modelId, groupId, user.id);
    return { success: true };
  });

// Server function to unassign a model from a rebalancing group - runs ONLY on server
export const unassignModelFromGroupServerFn = createServerFn({ method: 'POST' })
  .validator((data: { modelId: string; groupId: string }) => data)
  .handler(async ({ data }) => {
    const { modelId, groupId } = data;

    if (!modelId || !groupId) {
      throwServerError('Invalid request: modelId and groupId required', 400);
    }

    const { user } = await requireAuth();
    const _db = getDb();
    // Verify that the rebalancing group belongs to the authenticated user

    const group = await getDb()
      .select({ userId: schema.rebalancingGroup.userId })
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.id, groupId))
      .limit(1);

    if (group.length === 0 || group[0].userId !== user.id) {
      throwServerError('Access denied: Rebalancing group not found or does not belong to you', 403);
    }

    await unassignModelFromGroup(modelId, groupId);
    return { success: true };
  });
