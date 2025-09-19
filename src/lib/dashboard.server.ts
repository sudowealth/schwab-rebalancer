import { createServerFn } from '@tanstack/react-start';
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDatabaseSync } from './db-config';

// Defer server-only auth utilities to runtime to avoid bundling them in the client build
const requireAuth = async () => {
  const mod = await import('./auth-utils');
  return mod.requireAuth();
};
const requireAdmin = async () => {
  const mod = await import('./auth-utils');
  return mod.requireAdmin();
};

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

    // Import database API only on the server
    const { getFilteredSecuritiesData } = await import('./db-api');

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
  const { user } = await requireAuth();

  // Import server-only functions
  const { loadDashboardData } = await import('./server-only');
  const data = await loadDashboardData(user.id, user);
  return data;
});

// Lightweight server functions for individual dashboard queries
export const getPositionsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  const { getPositions } = await import('./db-api');
  return getPositions(user.id);
});

export const getTransactionsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  const { getTransactions } = await import('./db-api');
  return getTransactions(user.id);
});

export const getProposedTradesServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  const { getProposedTrades } = await import('./db-api');
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
    const db = getDatabaseSync();

    const ownedAccounts = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(eq(schema.account.userId, user.id), inArray(schema.account.id, accountIds)));

    if (ownedAccounts.length !== accountIds.length) {
      throw new Error('Access denied: One or more accounts do not belong to you');
    }

    const { getGroupTransactions } = await import('./db-api');
    return getGroupTransactions(accountIds);
  });

export const getSp500DataServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { getSnP500Data } = await import('./db-api');
  return getSnP500Data();
});

export const getPortfolioMetricsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  const { getPortfolioMetrics } = await import('./db-api');
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

    // Import utilities and data access functions
    const { generateAllocationData } = await import('./rebalancing-utils');
    const { getAccountHoldings } = await import('./db-api');
    const { getRebalancingGroupById } = await import('./db-api');
    const { getSnP500Data } = await import('./db-api');

    // Get the group data to verify ownership
    const group = await getRebalancingGroupById(user.id, data.groupId);
    if (!group) {
      throw new Error('Group not found or access denied');
    }

    // Get account holdings and S&P 500 data in parallel
    const [accountHoldings, sp500Data] = await Promise.all([
      getAccountHoldings(group.members.map((m) => m.accountId)),
      getSnP500Data(),
    ]);

    // Generate allocation data on server
    const allocationData = generateAllocationData(
      data.allocationView,
      group,
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

    // Import utilities and data access functions
    const { generateTopHoldingsData } = await import('./rebalancing-utils');
    const { getAccountHoldings } = await import('./db-api');
    const { getRebalancingGroupById } = await import('./db-api');

    // Get the group data to verify ownership
    const group = await getRebalancingGroupById(user.id, data.groupId);
    if (!group) {
      throw new Error('Group not found or access denied');
    }

    // Get account holdings
    const accountHoldings = await getAccountHoldings(group.members.map((m) => m.accountId));

    // Generate top holdings data on server
    const holdingsData = generateTopHoldingsData(accountHoldings, data.totalValue, data.limit);

    return holdingsData;
  });

// Server function to clear cache - runs ONLY on server
export const clearCacheServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  await requireAdmin();

  const { clearCache } = await import('./db-api');
  clearCache();
  return { success: true, message: 'Cache cleared successfully' };
});

// Server function to truncate security table - runs ONLY on server
export const truncateSecurityTableServerFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  await requireAdmin();

  const db = getDatabaseSync();
  await db.delete(schema.security);
  const { clearCache } = await import('./db-api');
  clearCache();
  return { success: true, message: 'Security table truncated successfully' };
});

// Server function to get restricted securities - runs ONLY on server
export const getRestrictedSecuritiesServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireAuth();

  // Import database API only on the server
  const { getRestrictedSecurities } = await import('./db-api');
  const restricted = await getRestrictedSecurities();
  return restricted;
});

// Server function to get available securities - runs ONLY on server
export const getAvailableSecuritiesServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireAuth();

  // Import database API only on the server
  const { getAvailableSecurities } = await import('./db-api');
  const securities = await getAvailableSecurities();
  return securities;
});

// Server function to get available accounts for group creation/editing - runs ONLY on server
export const getAvailableAccountsServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAuth();

  const { getAvailableAccounts } = await import('./db-api');
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

    const { getAccountsForRebalancingGroups } = await import('./db-api');
    const accounts = await getAccountsForRebalancingGroups(user.id, data.excludeGroupId);
    return accounts;
  });

// Server function to update account details - runs ONLY on server
export const updateAccountServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId: string; name: string; type: string }) => data)

  .handler(async ({ data }) => {
    const { accountId, name, type } = data;

    if (!accountId || !name.trim()) {
      throw new Error('Invalid request: accountId and name are required');
    }

    // Validate account type if provided
    if (type && !['TAXABLE', 'TAX_DEFERRED', 'TAX_EXEMPT', ''].includes(type)) {
      throw new Error(
        'Invalid account type. Must be TAXABLE, TAX_DEFERRED, TAX_EXEMPT, or empty string',
      );
    }

    const { user } = await requireAuth();

    // Import database API only on the server
    const { updateAccount } = await import('./db-api');
    await updateAccount(accountId, { name: name.trim(), type }, user.id);
    return { success: true };
  });
