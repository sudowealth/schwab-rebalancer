import { createServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '~/db/schema';
import type { RebalancingGroup } from '~/features/auth/schemas';
import {
  calculateSleeveAllocations,
  generateAllocationData,
  generateSleeveTableData,
  generateTopHoldingsData,
  type transformAccountHoldingsForClient,
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
import {
  validateAccountIds,
  validateCreateGroup,
  validateGroupId,
  validateModelAssignment,
  validateUpdateGroup,
} from '~/lib/runtime-validation';
import { requireAuth } from '../../auth/auth-utils';

// Consistent error handling for server functions
function handleServerFunctionError(error: unknown, context: string): never {
  if (process.env.NODE_ENV === 'development') {
    // Fail fast in development to surface real issues
    throw error;
  }

  // In production, log and throw a user-friendly error
  console.error(`${context}:`, error);
  throw new Error(`Failed to load ${context.toLowerCase()}. Please try again.`);
}

// Base data fetcher to eliminate redundant database calls
// This fetches the core data that multiple functions need
async function fetchBaseGroupData(groupId: string, userId: string) {
  // Get the group first (required for all operations)
  const group = await getRebalancingGroupById(groupId, userId);
  if (!group) {
    throwServerError('Rebalancing group not found', 404);
  }

  const safeGroup = group as NonNullable<typeof group>;
  const accountIds = safeGroup.members.map((member) => member.accountId);

  // Fetch core data in parallel (single round-trip for shared data)
  const [accountHoldingsResult, sp500DataResult] = await Promise.allSettled([
    accountIds.length > 0 ? getAccountHoldings(accountIds) : Promise.resolve([]),
    getSnP500Data(),
  ]);

  const accountHoldings =
    accountHoldingsResult.status === 'fulfilled' ? accountHoldingsResult.value : [];
  const sp500Data = sp500DataResult.status === 'fulfilled' ? sp500DataResult.value : [];

  return {
    group: safeGroup,
    accountHoldings,
    sp500Data,
    accountIds,
  };
}

// Type for transformed account holdings
interface TransformedHolding {
  accountId: string;
  ticker: string;
  qty: number;
  costBasis: number;
  marketValue: number;
  unrealizedGain: number;
  isTaxable: boolean;
  purchaseDate: Date;
}

// Cached transformed account holdings to avoid duplicate transformations
const transformedHoldingsCache = new Map<string, TransformedHolding[]>();
let holdingsCacheTimestamp = 0;
const HOLDINGS_CACHE_TTL = 30_000; // 30 seconds

async function getTransformedAccountHoldingsCached(accountHoldings: AccountHoldingsResult) {
  const cacheKey = JSON.stringify(
    accountHoldings.map((h) => ({ accountId: h.accountId, holdings: h.holdings.length })),
  );
  const now = Date.now();

  if (transformedHoldingsCache.has(cacheKey) && now - holdingsCacheTimestamp < HOLDINGS_CACHE_TTL) {
    return transformedHoldingsCache.get(cacheKey) as TransformedHolding[];
  }

  // Transform account holdings for client (server-side caching)
  const transformed = accountHoldings.flatMap((account) =>
    account.holdings.map((holding) => ({
      accountId: account.accountId,
      ticker: holding.ticker,
      qty: holding.qty,
      costBasis: holding.costBasisTotal,
      marketValue: holding.marketValue,
      unrealizedGain: holding.unrealizedGain || 0,
      isTaxable: account.accountType === 'taxable',
      purchaseDate: holding.openedAt,
    })),
  );

  transformedHoldingsCache.set(cacheKey, transformed);
  holdingsCacheTimestamp = now;

  return transformed;
}

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

// Legacy Zod schemas - now using runtime validation from ~/lib/runtime-validation

// Server function to get all rebalancing groups - runs ONLY on server
export const getRebalancingGroupsServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  try {
    const { user } = await requireAuth();
    const groups = await getRebalancingGroups(user.id);
    return groups;
  } catch (error) {
    handleServerFunctionError(error, 'Rebalancing Groups');
  }
});

// Server function to create a new rebalancing group - runs ONLY on server
export const createRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateCreateGroup(data))

  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = getDb();
    const { name, members, updateExisting } = data;

    const groupId = await createRebalancingGroup({ name, members, updateExisting }, user.id);
    return { success: true, groupId };
  });

// Server function to update a rebalancing group - runs ONLY on server
export const updateRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateUpdateGroup(data))
  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = getDb();
    const { groupId, name, members } = data;

    await updateRebalancingGroup(groupId, { name, members }, user.id);
    return { success: true };
  });

// Server function to delete a rebalancing group - runs ONLY on server
export const deleteRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateGroupId(data))

  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = getDb();
    const { groupId } = data;

    await deleteRebalancingGroup(groupId, user.id);
    return { success: true };
  });

// Server function to get rebalancing group by ID - runs ONLY on server
export const getRebalancingGroupByIdServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator((data: unknown) => validateGroupId(data))

  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const _db = getDb();
    const { groupId } = data;

    const group = await getRebalancingGroupById(groupId, user.id);
    return group;
  });

// Server function to get account holdings for rebalancing group - runs ONLY on server
export const getGroupAccountHoldingsServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator((data: unknown) => validateAccountIds(data))
  .handler(async ({ data }): Promise<AccountHoldingsResult> => {
    try {
      const { user } = await requireAuth();
      const { accountIds } = data;

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
      handleServerFunctionError(error, 'Group Account Holdings');
    }
  });

export type GetGroupAccountHoldingsResult = Awaited<
  ReturnType<typeof getGroupAccountHoldingsServerFn>
>;

// Server function to get rebalancing groups with balances for list display - runs ONLY on server
export const getRebalancingGroupsListDataServerFn = createServerFn({
  method: 'GET',
}).handler(
  async (): Promise<{ groups: RebalancingGroup[]; accountBalances: Record<string, number> }> => {
    const { user } = await requireAuth();
    const _db = getDb();

    // Get all groups for the user with member accounts in a single optimized query
    const groups = await getRebalancingGroups(user.id);

    // Collect all account IDs from all groups
    const allAccountIds = groups.flatMap((group) =>
      group.members.map((member) => member.accountId),
    );

    if (allAccountIds.length === 0) {
      return { groups, accountBalances: {} };
    }

    // Get account balances efficiently without loading full holdings data
    // This is much more efficient than getAccountHoldings() for list display
    const accountBalancesMap = await getAccountBalancesOnly(allAccountIds);
    const accountBalances = Object.fromEntries(accountBalancesMap);

    return { groups, accountBalances };
  },
);

// Helper function to get only account balances without full holdings data
async function getAccountBalancesOnly(accountIds: string[]): Promise<Map<string, number>> {
  const balances = new Map<string, number>();

  // Get S&P 500 data for current prices
  const sp500Data = await getSnP500Data();
  const priceMap = new Map<string, number>(sp500Data.map((stock) => [stock.ticker, stock.price]));

  // Get holdings aggregated by account for balance calculation only
  const holdingsData = await getDb()
    .select({
      accountId: schema.account.id,
      ticker: schema.holding.ticker,
      qty: schema.holding.qty,
      averageCost: schema.holding.averageCost,
    })
    .from(schema.holding)
    .innerJoin(schema.account, eq(schema.holding.accountId, schema.account.id))
    .where(inArray(schema.account.id, accountIds));

  // Calculate balances by account
  const accountHoldings = new Map<
    string,
    Array<{ ticker: string; qty: number; averageCost: number }>
  >();
  holdingsData.forEach((holding) => {
    if (!accountHoldings.has(holding.accountId)) {
      accountHoldings.set(holding.accountId, []);
    }
    const holdings = accountHoldings.get(holding.accountId);
    if (holdings) {
      holdings.push({
        ticker: holding.ticker,
        qty: holding.qty,
        averageCost: holding.averageCost,
      });
    }
  });

  // Calculate total balance for each account
  accountHoldings.forEach((holdings, accountId) => {
    let totalBalance = 0;
    holdings.forEach((holding) => {
      const currentPrice = priceMap.get(holding.ticker) || 0;
      totalBalance += holding.qty * currentPrice;
    });
    balances.set(accountId, totalBalance);
  });

  return balances;
}

// Server function to get sleeve members (target securities) - runs ONLY on server
export const getSleeveMembersServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { sleeveIds: string[] }) => data)
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

// Server function to get rebalancing group analytics data - runs ONLY on server
const getRebalancingGroupAnalyticsServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator((data: unknown) => validateGroupId(data))
  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const { groupId } = data;

    // Use base data fetcher to get core data (eliminates redundant DB calls)
    const { group, accountHoldings, sp500Data } = await fetchBaseGroupData(groupId, user.id);

    // Calculate analytics data using shared base data
    const { updatedGroupMembers, allocationData, holdingsData } =
      calculateRebalancingGroupAnalytics(group, accountHoldings, sp500Data);

    return {
      updatedGroupMembers,
      allocationData,
      holdingsData,
    };
  });

export type GetRebalancingGroupAnalyticsResult = Awaited<
  ReturnType<typeof getRebalancingGroupAnalyticsServerFn>
>;

// Type for rebalancing group page data - derived from route loader
export type RebalancingGroupPageData = {
  group: {
    id: string;
    name: string;
    isActive: boolean;
    members: GetRebalancingGroupAnalyticsResult['updatedGroupMembers'];
    assignedModel: RebalancingGroup['assignedModel'];
    createdAt: Date;
    updatedAt: Date;
  };
  accountHoldings: Awaited<ReturnType<typeof transformAccountHoldingsForClient>>;
  sleeveMembers: Awaited<ReturnType<typeof getSleeveMembers>>;
  sp500Data: Awaited<ReturnType<typeof getSnP500Data>>;
  transactions: Awaited<ReturnType<typeof getGroupTransactions>>;
  positions: Awaited<ReturnType<typeof getPositions>>;
  proposedTrades: Awaited<ReturnType<typeof getProposedTrades>>;
  allocationData: Awaited<ReturnType<typeof generateAllocationData>>;
  holdingsData: Awaited<ReturnType<typeof generateTopHoldingsData>>;
  sleeveTableData: Awaited<ReturnType<typeof generateSleeveTableData>>;
  sleeveAllocationData: Awaited<ReturnType<typeof transformSleeveAllocationDataForClient>>;
  groupOrders: Awaited<ReturnType<typeof getOrdersForAccounts>>;
  transformedAccountHoldings: Array<{
    accountId: string;
    ticker: string;
    qty: number;
    costBasis: number;
    marketValue: number;
    unrealizedGain: number;
    isTaxable: boolean;
    purchaseDate: Date;
  }>;
};

// Export component data types derived from server functions
export type SleeveTableData = RebalancingGroupPageData['sleeveTableData'][number];
export type SleeveAllocationData = RebalancingGroupPageData['sleeveAllocationData'][number];
export type SleeveMember = RebalancingGroupPageData['sleeveMembers'][number];

// Server function to assign a model to a rebalancing group - runs ONLY on server
export const assignModelToGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateModelAssignment(data))

  .handler(async ({ data }) => {
    const { modelId, groupId } = data;

    const { user } = await requireAuth();
    const _db = getDb();
    await assignModelToGroup(modelId, groupId, user.id);
    return { success: true };
  });

// Server function to unassign a model from a rebalancing group - runs ONLY on server
export const unassignModelFromGroupServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => validateModelAssignment(data))
  .handler(async ({ data }) => {
    const { modelId, groupId } = data;

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

// Server function to get ALL rebalancing group data in a single consolidated call
// This replaces the need for 3 separate server function calls in the route loader
export const getRebalancingGroupAllDataServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator((data: unknown) => validateGroupId(data))
  .handler(async ({ data: { groupId } }) => {
    const { user } = await requireAuth();

    // 1. Use base data fetcher to get core data (eliminates redundant DB calls)
    const { group, accountHoldings, sp500Data, accountIds } = await fetchBaseGroupData(
      groupId,
      user.id,
    );

    // 2. Fetch additional required data in parallel
    const [
      transactionsResult,
      positionsResult,
      proposedTradesResult,
      groupOrdersResult,
      sleeveMembersResult,
    ] = await Promise.allSettled([
      accountIds.length > 0 ? getGroupTransactions(accountIds) : Promise.resolve([]),
      getPositions(),
      getProposedTrades(),
      getOrdersForAccounts(accountIds),

      // Conditional: only fetch if model assigned
      group.assignedModel?.members && group.assignedModel.members.length > 0
        ? getSleeveMembers(group.assignedModel.members.map((member) => member.sleeveId))
        : Promise.resolve([]),
    ]);

    // 3. Extract results with error handling
    const transactions = transactionsResult.status === 'fulfilled' ? transactionsResult.value : [];
    const positions = positionsResult.status === 'fulfilled' ? positionsResult.value : [];
    const proposedTrades =
      proposedTradesResult.status === 'fulfilled' ? proposedTradesResult.value : [];
    const groupOrders = groupOrdersResult.status === 'fulfilled' ? groupOrdersResult.value : [];
    const sleeveMembers =
      sleeveMembersResult.status === 'fulfilled' ? sleeveMembersResult.value : [];

    // 4. Calculate derived data using shared base data
    const { updatedGroupMembers, allocationData, holdingsData } =
      calculateRebalancingGroupAnalytics(group, accountHoldings, sp500Data);

    const rawSleeveAllocationData = calculateSleeveAllocations(
      group,
      accountHoldings,
      sleeveMembers,
      transactions,
    );

    const totalValue = updatedGroupMembers.reduce((sum, member) => sum + (member.balance || 0), 0);
    const rawSleeveTableData = generateSleeveTableData(rawSleeveAllocationData, 'all', totalValue);

    // 5. Transform for client (using cached transformation)
    const transformedAccountHoldings = await getTransformedAccountHoldingsCached(accountHoldings);
    const sleeveTableData = transformSleeveTableDataForClient(rawSleeveTableData);
    const sleeveAllocationData = transformSleeveAllocationDataForClient(rawSleeveAllocationData);

    return {
      // Complete data (original function 1)
      group,
      accountHoldings,
      sp500Data,
      updatedGroupMembers,
      allocationData,
      holdingsData,

      // Sleeve data (original function 2)
      sleeveMembers,
      sleeveTableData,
      sleeveAllocationData,

      // Trades data (original function 3)
      transactions,
      positions,
      proposedTrades,
      groupOrders: groupOrders.map((order) => ({
        ...order,
        avgFillPrice: order.avgFillPrice || undefined,
        batchLabel: order.batchLabel || undefined,
      })),

      // Cached transformed holdings (eliminates duplicate client-side transformations)
      transformedAccountHoldings,
    };
  });
