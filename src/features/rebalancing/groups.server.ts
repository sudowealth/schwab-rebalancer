import { createServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '~/db/schema';
import type { RebalancingGroup } from '~/features/auth/schemas';
import type { AccountHoldingsResult } from '~/lib/db-api';
import { dbProxy } from '~/lib/db-config';
import { requireAuth } from '../auth/auth-utils';

// Server function to get all rebalancing groups - runs ONLY on server
export const getRebalancingGroupsServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  // Handle unauthenticated requests gracefully during SSR

  try {
    const { user } = await requireAuth();
    const _db = dbProxy;
    const { getRebalancingGroups } = await import('~/lib/db-api');
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
  .validator(
    (data: { name: string; members: Array<{ accountId: string }>; updateExisting?: boolean }) =>
      data,
  )

  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = dbProxy;
    const { name, members, updateExisting } = data;

    if (!name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: name and members array required');
    }
    // Import database API only on the server
    const { createRebalancingGroup } = await import('~/lib/db-api');
    const groupId = await createRebalancingGroup({ name, members, updateExisting }, user.id);
    return { success: true, groupId };
  });

// Server function to update a rebalancing group - runs ONLY on server
export const updateRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: { groupId: string; name: string; members: Array<{ accountId: string }> }) => data,
  )
  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = dbProxy;
    const { groupId, name, members } = data;

    if (!groupId || !name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: groupId, name and members array required');
    }
    // Import database API only on the server
    const { updateRebalancingGroup } = await import('~/lib/db-api');
    await updateRebalancingGroup(groupId, { name, members }, user.id);
    return { success: true };
  });

// Server function to delete a rebalancing group - runs ONLY on server
export const deleteRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .validator((data: { groupId: string }) => data)

  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = dbProxy;
    const { groupId } = data;

    if (!groupId) {
      throw new Error('Invalid request: groupId required');
    }

    // Import database API only on the server
    const { deleteRebalancingGroup } = await import('~/lib/db-api');
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
    const _db = dbProxy;
    const { groupId } = data;

    if (!groupId) {
      throw new Error('Invalid request: groupId required');
    }

    // Import database API only on the server
    const { getRebalancingGroupById } = await import('~/lib/db-api');
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
      throw new Error('Invalid request: accountIds required');
    }

    // Handle unauthenticated requests gracefully during SSR

    try {
      const { user } = await requireAuth();
      const _db = dbProxy;
      // Verify that all accountIds belong to the authenticated user

      const ownedAccounts = await dbProxy
        .select({ id: schema.account.id })
        .from(schema.account)
        .where(and(eq(schema.account.userId, user.id), inArray(schema.account.id, accountIds)));

      if (ownedAccounts.length !== accountIds.length) {
        throw new Error('Access denied: One or more accounts do not belong to you');
      }

      // Import database API only on the server
      const { getAccountHoldings } = await import('~/lib/db-api');
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
  const _db = dbProxy;
  // Import database API only on the server
  const { getRebalancingGroups, getAccountHoldings } = await import('~/lib/db-api');

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
    const _db = dbProxy;
    const { sleeveIds } = data;

    if (!sleeveIds || sleeveIds.length === 0) {
      throw new Error('Invalid request: sleeveIds required');
    }

    // Import database API only on the server
    const { getSleeveMembers } = await import('~/lib/db-api');
    const sleeveMembers = await getSleeveMembers(sleeveIds);
    return sleeveMembers;
  });

export type SleeveMember = Awaited<ReturnType<typeof getSleeveMembersServerFn>>[number];

// Server function to assign a model to a rebalancing group - runs ONLY on server
export const assignModelToGroupServerFn = createServerFn({ method: 'POST' })
  .validator((data: { modelId: string; groupId: string }) => data)

  .handler(async ({ data }) => {
    const { modelId, groupId } = data;

    if (!modelId || !groupId) {
      throw new Error('Invalid request: modelId and groupId required');
    }

    const { user } = await requireAuth();
    const _db = dbProxy;
    // Import database API only on the server
    const { assignModelToGroup } = await import('~/lib/db-api');
    await assignModelToGroup(modelId, groupId, user.id);
    return { success: true };
  });

// Server function to unassign a model from a rebalancing group - runs ONLY on server
export const unassignModelFromGroupServerFn = createServerFn({ method: 'POST' })
  .validator((data: { modelId: string; groupId: string }) => data)
  .handler(async ({ data }) => {
    const { modelId, groupId } = data;

    if (!modelId || !groupId) {
      throw new Error('Invalid request: modelId and groupId required');
    }

    const { user } = await requireAuth();
    const _db = dbProxy;
    // Verify that the rebalancing group belongs to the authenticated user

    const group = await dbProxy
      .select({ userId: schema.rebalancingGroup.userId })
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.id, groupId))
      .limit(1);

    if (group.length === 0 || group[0].userId !== user.id) {
      throw new Error('Access denied: Rebalancing group not found or does not belong to you');
    }

    // Import database API only on the server
    const { unassignModelFromGroup } = await import('~/lib/db-api');
    await unassignModelFromGroup(modelId, groupId);
    return { success: true };
  });
