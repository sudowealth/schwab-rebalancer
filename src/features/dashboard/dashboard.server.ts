import { createServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
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
  getPortfolioMetrics,
  getPositions,
  getProposedTrades,
  getRebalancingGroupById,
  getRestrictedSecurities,
  getSnP500Data,
  getTransactions,
  updateAccount,
} from '../../lib/db-api';

// Static imports for server-only utilities
import { loadDashboardData } from '../../lib/server-only';
import { requireAdmin, requireAuth } from '../auth/auth-utils';

// Server function to get securities data with optional filtering and pagination - runs ONLY on server
export const getSecuritiesDataServerFn = createServerFn({
  method: 'POST',
})
  .validator(
    (data: {
      indexId?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }) => data,
  )
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

export const getDashboardDataServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  // Handle unauthenticated requests gracefully during SSR

  try {
    const { user } = await requireAuth();

    const data = await loadDashboardData(user.id, user);
    return data;
  } catch (error) {
    // Handle authentication errors gracefully during SSR
    console.warn('Dashboard data load failed during SSR, returning empty data:', error);
    // Don't re-throw during SSR - return fallback data instead

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
      accountsCount: 0,
      securitiesStatus: { hasSecurities: false, securitiesCount: 0 },
      modelsStatus: { hasModels: false, modelsCount: 0 },
      rebalancingGroupsStatus: { hasGroups: false, groupsCount: 0 },
    };
  }
});

// Lightweight server functions for individual dashboard queries
export const getPositionsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  return getPositions(user.id);
});

export const getTransactionsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  return getTransactions(user.id);
});

export const getProposedTradesServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  return getProposedTrades(user.id);
});

export const getGroupTransactionsServerFn = createServerFn({
  method: 'POST',
})
  .validator((data: { accountIds: string[] }) => data)
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
export const generateAllocationDataServerFn = createServerFn({
  method: 'POST',
})
  .validator(
    (data: {
      allocationView: 'account' | 'sector' | 'industry' | 'sleeve';
      groupId: string;
      totalValue: number;
    }) => data,
  )
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
export const generateTopHoldingsDataServerFn = createServerFn({
  method: 'POST',
})
  .validator((data: { groupId: string; totalValue: number; limit?: number }) => data)
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
export const getAccountsForRebalancingGroupsServerFn = createServerFn({
  method: 'GET',
})
  .validator((data: { excludeGroupId?: string }) => data)

  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const accounts = await getAccountsForRebalancingGroups(user.id, data.excludeGroupId);
    return accounts;
  });

// Server function to update account details - runs ONLY on server
export const updateAccountServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId: string; name: string; type: string }) => data)

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
