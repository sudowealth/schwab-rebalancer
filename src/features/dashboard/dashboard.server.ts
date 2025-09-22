import { createServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '~/db/schema';
// Static imports for rebalancing utilities
import {
  generateAllocationData,
  generateTopHoldingsData,
} from '~/features/rebalancing/rebalancing-utils';
import { getDb } from '~/lib/db-config';
import { throwServerError } from '~/lib/error-utils';

// Static imports for database operations
import {
  clearCache,
  getAccountHoldings,
  getAccountsForRebalancingGroups,
  getAvailableAccounts,
  getAvailableSecurities,
  getFilteredSecuritiesData,
  getGroupTransactions,
  getIndexMembers,
  getIndices,
  getPortfolioMetrics,
  getPositions,
  getProposedTrades,
  getRebalancingGroupById,
  getRebalancingGroupsWithBalances,
  getRestrictedSecurities,
  getSleeves,
  getSnP500Data,
  getTransactions,
  updateAccount,
} from '../../lib/db-api';

// Static imports for server-only utilities
// Note: loadDashboardData removed during server function cleanup
import { requireAdmin, requireAuth } from '../auth/auth-utils';

// Zod schemas for type safety
const getSecuritiesDataSchema = z.object({
  indexId: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).optional(),
  pageSize: z.number().min(1).max(1000).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const getGroupTransactionsSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1, 'At least one account ID is required'),
});

const generateAllocationDataSchema = z.object({
  allocationView: z.enum(['account', 'sector', 'industry', 'sleeve']),
  groupId: z.string().min(1, 'Group ID is required'),
  totalValue: z.number().positive('Total value must be positive'),
});

const generateTopHoldingsDataSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  totalValue: z.number().positive('Total value must be positive'),
  limit: z.number().min(1).max(50).optional(),
});

const getAccountsForRebalancingGroupsSchema = z.object({
  excludeGroupId: z.string().optional(),
});

const updateAccountSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['TAXABLE', 'TAX_DEFERRED', 'TAX_EXEMPT', '']).optional().default(''),
});

// Server function to get securities data with optional filtering and pagination - runs ONLY on server
export const getSecuritiesDataServerFn = createServerFn({ method: 'POST' })
  .validator(getSecuritiesDataSchema)
  .handler(async ({ data }) => {
    await requireAuth();

    // Server-side filtering, pagination, and sorting
    const securitiesData = await getFilteredSecuritiesData(
      data.indexId,
      data.search,
      data.page,
      data.pageSize,
      data.sortBy,
      data.sortOrder,
    );

    return {
      ...securitiesData,
    };
  });

// Removed unused _getDashboardDataSchema during server function cleanup

// Optimized server function that loads ALL dashboard data in parallel to eliminate waterfalls
export const getCompleteDashboardDataServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  try {
    const { user } = await requireAuth();
    const userId = user.id;

    // Load ALL data in parallel to eliminate waterfalls
    const [
      positions,
      metrics,
      transactions,
      sp500Data,
      proposedTrades,
      sleeves,
      indices,
      indexMembers,
      rebalancingGroups,
    ] = await Promise.all([
      getPositions(userId),
      getPortfolioMetrics(userId),
      getTransactions(userId),
      getSnP500Data(),
      getProposedTrades(userId),
      getSleeves(userId),
      getIndices(),
      getIndexMembers(),
      getRebalancingGroupsWithBalances(userId), // Single query with balances
    ]);

    // Load Schwab status in parallel with other data
    const [schwabCredentialsStatus, schwabOAuthStatus] = await Promise.all([
      // Schwab environment variables status
      (async () => {
        try {
          const { hasSchwabCredentialsConfigured } = await import(
            '~/features/schwab/schwab-api.server'
          );
          return { hasCredentials: hasSchwabCredentialsConfigured() };
        } catch {
          return { hasCredentials: false };
        }
      })(),
      // Schwab OAuth status
      (async () => {
        try {
          const clientId = process.env.SCHWAB_CLIENT_ID;
          const clientSecret = process.env.SCHWAB_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            return { hasCredentials: false };
          }

          const { getSchwabApiService } = await import('~/features/schwab/schwab-api.server');
          const schwabApi = getSchwabApiService();
          const hasOAuthCredentials = await schwabApi.hasValidCredentials(userId);
          return { hasCredentials: hasOAuthCredentials };
        } catch {
          return { hasCredentials: false };
        }
      })(),
    ]);

    // Calculate account balances from positions
    const accountBalances = new Map<string, number>();
    for (const position of positions) {
      if (position.accountId && typeof position.marketValue === 'number') {
        const currentBalance = accountBalances.get(position.accountId) || 0;
        accountBalances.set(position.accountId, currentBalance + position.marketValue);
      }
    }

    // Update rebalancing group member balances
    const updatedRebalancingGroups = rebalancingGroups.map((group) => ({
      ...group,
      members: group.members.map((member) => ({
        ...member,
        balance: accountBalances.get(member.accountId) ?? 0,
      })),
    }));

    // Compute status counts from main queries (no additional DB queries needed)
    const accountsCount = new Set(positions.map((pos) => pos.accountId).filter(Boolean)).size;

    const securitiesCount = positions.filter((pos) => pos.ticker !== '$$$' && pos.ticker).length;
    const securitiesStatus = {
      hasSecurities: securitiesCount > 0,
      securitiesCount,
    };

    const modelsStatus = {
      hasModels: sleeves.length > 0,
      modelsCount: sleeves.length,
    };

    const rebalancingGroupsStatus = {
      hasGroups: updatedRebalancingGroups.length > 0,
      groupsCount: updatedRebalancingGroups.length,
    };

    return {
      positions,
      metrics,
      transactions,
      sp500Data,
      proposedTrades,
      sleeves,
      indices,
      indexMembers,
      user,
      schwabCredentialsStatus,
      schwabOAuthStatus,
      accountsCount,
      securitiesStatus,
      modelsStatus,
      rebalancingGroupsStatus,
      rebalancingGroups: updatedRebalancingGroups,
    };
  } catch (error) {
    // Handle authentication errors gracefully during SSR
    console.warn('Complete dashboard data load failed during SSR, returning empty data:', error);

    return {
      positions: [],
      metrics: {
        totalMarketValue: 0,
        totalCostBasis: 0,
        unrealizedGain: 0,
        unrealizedGainPercent: 0,
        realizedGain: 0,
        realizedGainPercent: 0,
        totalGain: 0,
        totalGainPercent: 0,
        ytdHarvestedLosses: 0,
        harvestablelosses: 0,
        harvestingTarget: {
          year1Target: 0.03,
          steadyStateTarget: 0.02,
          currentProgress: 0,
        },
      },
      transactions: [],
      sp500Data: [],
      proposedTrades: [],
      sleeves: [],
      indices: [],
      indexMembers: [],
      user: null,
      schwabCredentialsStatus: { hasCredentials: false },
      schwabOAuthStatus: { hasCredentials: false },
      accountsCount: 0,
      securitiesStatus: { hasSecurities: false, securitiesCount: 0 },
      modelsStatus: { hasModels: false, modelsCount: 0 },
      rebalancingGroupsStatus: { hasGroups: false, groupsCount: 0 },
      rebalancingGroups: [],
    };
  }
});

// Removed duplicate getDashboardDataServerFn during server function cleanup
// Use getCompleteDashboardDataServerFn instead for optimized parallel loading

// Removed unused _getPositionsSchema during server function cleanup

// Lightweight server functions for individual dashboard queries
export const getPositionsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  return getPositions(user.id);
});

// Removed unused _getTransactionsSchema during server function cleanup

export const getTransactionsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  return getTransactions(user.id);
});

export const getProposedTradesServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  return getProposedTrades(user.id);
});

export const getGroupTransactionsServerFn = createServerFn({ method: 'POST' })
  .validator(getGroupTransactionsSchema)
  .handler(async ({ data }) => {
    const { accountIds } = data;
    const { user } = await requireAuth();
    // Verify that all accountIds belong to the authenticated user

    const ownedAccounts = await getDb()
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(eq(schema.account.userId, user.id), inArray(schema.account.id, accountIds)));

    if (ownedAccounts.length !== accountIds.length) {
      throwServerError('Access denied: One or more accounts do not belong to you', 403);
    }

    return getGroupTransactions(accountIds);
  });

// Removed unused _getSp500DataSchema during server function cleanup

// Removed unused _getPortfolioMetricsSchema during server function cleanup

export const getSp500DataServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  return getSnP500Data();
});

export const getPortfolioMetricsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  return getPortfolioMetrics(user.id);
});

// Server function to generate allocation data for rebalancing groups
export const generateAllocationDataServerFn = createServerFn({ method: 'POST' })
  .validator(generateAllocationDataSchema)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    if (!data.groupId) {
      throwServerError('Invalid request: groupId is required', 400);
    }

    // Get the group data to verify ownership
    const group = await getRebalancingGroupById(data.groupId, user.id);
    if (!group) {
      throwServerError('Group not found or access denied', 404);
    }

    // Get account holdings and S&P 500 data in parallel
    const accountIds = group?.members.map((m) => m.accountId).filter(Boolean) || [];
    const [accountHoldings, sp500Data] = await Promise.all([
      getAccountHoldings(accountIds),
      getSnP500Data(),
    ]);

    // Generate allocation data on server
    const allocationData = generateAllocationData(
      data.allocationView,
      group as NonNullable<typeof group>, // We know group is not null after the check above
      accountHoldings,
      sp500Data,
      data.totalValue,
    );

    return allocationData;
  });

// Server function to generate top holdings data for rebalancing groups
export const generateTopHoldingsDataServerFn = createServerFn({ method: 'POST' })
  .validator(generateTopHoldingsDataSchema)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    if (!data.groupId) {
      throwServerError('Invalid request: groupId is required', 400);
    }

    // Get the group data to verify ownership
    const group = await getRebalancingGroupById(data.groupId, user.id);
    if (!group) {
      throwServerError('Group not found or access denied', 404);
    }

    // Get account holdings
    const accountIds = group?.members.map((m) => m.accountId).filter(Boolean) || [];
    const accountHoldings = await getAccountHoldings(accountIds);

    // Generate top holdings data on server
    const holdingsData = generateTopHoldingsData(accountHoldings, data.totalValue, data.limit);

    return holdingsData;
  });

// Server function to clear cache - runs ONLY on server
export const clearCacheServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  await requireAdmin();

  clearCache();
  return { success: true, message: 'Cache cleared successfully' };
});

// Server function to truncate security table - runs ONLY on server
export const truncateSecurityTableServerFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  await requireAdmin();

  await getDb().delete(schema.security);
  clearCache();
  return { success: true, message: 'Security table truncated successfully' };
});

// Server function to get restricted securities - runs ONLY on server
export const getRestrictedSecuritiesServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireAuth();

  const restricted = await getRestrictedSecurities();
  return restricted;
});

// Server function to get available securities - runs ONLY on server
export const getAvailableSecuritiesServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireAuth();

  const securities = await getAvailableSecurities();
  return securities;
});

// Server function to get available accounts for group creation/editing - runs ONLY on server
export const getAvailableAccountsServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAuth();

  const accounts = await getAvailableAccounts(user.id);
  return accounts;
});

// Server function to get accounts for rebalancing groups with assignment status
export const getAccountsForRebalancingGroupsServerFn = createServerFn({ method: 'GET' })
  .validator(getAccountsForRebalancingGroupsSchema)

  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const accounts = await getAccountsForRebalancingGroups(user.id, data.excludeGroupId);
    return accounts;
  });

// Server function to update account details - runs ONLY on server
export const updateAccountServerFn = createServerFn({ method: 'POST' })
  .validator(updateAccountSchema)

  .handler(async ({ data }) => {
    const { accountId, name, type } = data;

    if (!accountId || !name.trim()) {
      throwServerError('Invalid request: accountId and name are required', 400);
    }

    // Validate account type if provided
    if (type && !['TAXABLE', 'TAX_DEFERRED', 'TAX_EXEMPT', ''].includes(type)) {
      throwServerError(
        'Invalid account type. Must be TAXABLE, TAX_DEFERRED, TAX_EXEMPT, or empty string',
        400,
      );
    }

    const { user } = await requireAuth();

    await updateAccount(accountId, { name: name.trim(), type }, user.id);
    return { success: true };
  });
