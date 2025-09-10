import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { requireAdmin, requireAuth } from './auth-utils';
import { CASH_TICKER, isAnyCashTicker, isBaseCashTicker, MANUAL_CASH_TICKER } from './constants';
import type { AccountHoldingsResult } from './db-api';
import {
  DatabaseError,
  getErrorMessage,
  logError,
  ValidationError,
  withRetry,
} from './error-handler';
import type { RebalanceSecurityData, RebalanceSleeveDataNew } from './rebalance-logic';
import type { Trade } from './schemas';
import type { SyncResult } from './schwab-sync';
import { SessionManager } from './session-manager';

// Server function to get sleeves data - runs ONLY on server
export const getSleevesServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { user } = await requireAuth();

    return await withRetry(
      async () => {
        const { getSleeves } = await import('./db-api');
        return await getSleeves(user.id);
      },
      2,
      500,
      'getSleeves',
    );
  } catch (error) {
    logError(error, 'Failed to get sleeves', { userId: 'redacted' });
    throw new DatabaseError('Failed to retrieve sleeves', error);
  }
});

// Server function to get dashboard data - runs ONLY on server
export const getDashboardDataServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAuth();

  // Import server-only functions
  const { loadDashboardData } = await import('./server-only');
  const data = await loadDashboardData(user.id);
  return data;
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

  const { getDatabase } = await import('./db-config');
  const db = getDatabase();
  const schema = await import('../db/schema');
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

// Server function to seed demo data - runs ONLY on server
export const seedDemoDataServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { user } = await requireAuth();

  const { seedDatabase } = await import('./seeds/main');
  await seedDatabase(user.id);
  const { cleanupDatabase } = await import('./db-config');
  cleanupDatabase();
  return {
    success: true,
    summary: {
      securitiesSeeded: 503,
      accountsSeeded: 2,
      sleevesCreated: 8,
      holdingsSeeded: 7,
      transactionsSeeded: 8,
      message: 'Full S&P 500 demo portfolio seeded successfully',
    },
  };
});

// Server function to create a new sleeve - runs ONLY on server
export const createSleeveServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      name: string;
      members: Array<{ ticker: string; rank: number; isLegacy?: boolean }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const { user } = await requireAuth();

      const { name, members } = data;

      if (!name?.trim()) {
        throw new ValidationError('Sleeve name is required', 'name');
      }

      if (!members || !Array.isArray(members) || members.length === 0) {
        throw new ValidationError('At least one member is required', 'members');
      }

      if (members.some((m) => !m.ticker?.trim() || typeof m.rank !== 'number')) {
        throw new ValidationError('All members must have valid ticker and rank', 'members');
      }

      return await withRetry(
        async () => {
          const { createSleeve } = await import('./db-api');
          const sleeveId = await createSleeve(name.trim(), members, user.id);
          return { success: true, sleeveId };
        },
        2,
        500,
        'createSleeve',
      );
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      logError(error, 'Failed to create sleeve', {
        name: data.name,
        memberCount: data.members?.length,
      });
      throw new DatabaseError('Failed to create sleeve', error);
    }
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

// Server function to update a sleeve - runs ONLY on server
export const updateSleeveServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      sleeveId: string;
      name: string;
      members: Array<{ ticker: string; rank: number; isLegacy?: boolean }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveId, name, members } = data;

    if (!sleeveId || !name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: sleeveId, name and members array required');
    }

    // Import database API only on the server
    const { updateSleeve } = await import('./db-api');
    await updateSleeve(sleeveId, name, members);
    return { success: true };
  });

// Server function to delete a sleeve - runs ONLY on server
export const deleteSleeveServerFn = createServerFn({ method: 'POST' })
  .validator((data: { sleeveId: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveId } = data;

    if (!sleeveId) {
      throw new Error('Invalid request: sleeveId required');
    }

    // Import database API only on the server
    const { deleteSleeve } = await import('./db-api');
    await deleteSleeve(sleeveId);
    return { success: true };
  });

// Server function to get sleeve by ID - runs ONLY on server
export const getSleeveByIdServerFn = createServerFn({ method: 'POST' })
  .validator((data: { sleeveId: string }) => data)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const { sleeveId } = data;

    if (!sleeveId) {
      throw new Error('Invalid request: sleeveId required');
    }

    // Import database API only on the server
    const { getSleeveById } = await import('./db-api');
    const sleeve = await getSleeveById(sleeveId, user.id);
    return sleeve;
  });

// Server function to get sleeve holdings info - runs ONLY on server
export const getSleeveHoldingsInfoServerFn = createServerFn({ method: 'POST' })
  .validator((data: { sleeveId: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveId } = data;

    if (!sleeveId) {
      throw new Error('Invalid request: sleeveId required');
    }

    // Import database API only on the server
    const { getSleeveHoldingsInfo } = await import('./db-api');
    const holdingsInfo = await getSleeveHoldingsInfo(sleeveId);
    return holdingsInfo;
  });

// Server function to get all models - runs ONLY on server
export const getModelsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();

  // Import database API only on the server
  const { getModels } = await import('./db-api');
  const models = await getModels(user.id);
  return models;
});

// Server function to create a new model - runs ONLY on server
export const createModelServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      name: string;
      description?: string;
      members: Array<{ sleeveId: string; targetWeight: number }>;
      updateExisting?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const { name, description, members, updateExisting } = data;

    if (!name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: name and members array required');
    }

    // Import database API only on the server
    const { createModel } = await import('./db-api');
    const modelId = await createModel(
      {
        name,
        description,
        members,
        updateExisting,
      },
      user.id,
    );
    return { success: true, modelId };
  });

// Server function to update a model - runs ONLY on server
export const updateModelServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      modelId: string;
      name: string;
      description?: string;
      members: Array<{ sleeveId: string; targetWeight: number }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();

    const { modelId, name, description, members } = data;

    if (!modelId || !name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: modelId, name and members array required');
    }

    // Import database API only on the server
    const { updateModel } = await import('./db-api');
    await updateModel(modelId, { name, description, members });
    return { success: true };
  });

// Server function to delete a model - runs ONLY on server
export const deleteModelServerFn = createServerFn({ method: 'POST' })
  .validator((data: { modelId: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();

    const { modelId } = data;

    if (!modelId) {
      throw new Error('Invalid request: modelId required');
    }

    // Import database API only on the server
    const { deleteModel } = await import('./db-api');
    await deleteModel(modelId);
    return { success: true };
  });

// Server function to get model by ID - runs ONLY on server
export const getModelByIdServerFn = createServerFn({ method: 'POST' })
  .validator((data: { modelId: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();

    const { modelId } = data;

    if (!modelId) {
      throw new Error('Invalid request: modelId required');
    }

    // Import database API only on the server
    const { getModelById } = await import('./db-api');
    const model = await getModelById(modelId);
    return model;
  });

// Server function to get available sleeves for model creation/editing - runs ONLY on server
export const getAvailableSleevesServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireAuth();

  // Import database API only on the server
  const { getAvailableSleeves } = await import('./db-api');
  const sleeves = await getAvailableSleeves();
  return sleeves;
});

// Note: getDemoUserId() has been removed - all server functions now use proper authentication

// Server function to get all rebalancing groups - runs ONLY on server
export const getRebalancingGroupsServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAuth();

  const { getRebalancingGroups } = await import('./db-api');
  const groups = await getRebalancingGroups(user.id);
  return groups;
});

// Server function to create a new rebalancing group - runs ONLY on server
export const createRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: { name: string; members: Array<{ accountId: string }>; updateExisting?: boolean }) =>
      data,
  )

  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const { name, members, updateExisting } = data;

    if (!name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: name and members array required');
    }
    // Import database API only on the server
    const { createRebalancingGroup } = await import('./db-api');
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

    const { groupId, name, members } = data;

    if (!groupId || !name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: groupId, name and members array required');
    }
    // Import database API only on the server
    const { updateRebalancingGroup } = await import('./db-api');
    await updateRebalancingGroup(groupId, { name, members }, user.id);
    return { success: true };
  });

// Server function to delete a rebalancing group - runs ONLY on server
export const deleteRebalancingGroupServerFn = createServerFn({ method: 'POST' })
  .validator((data: { groupId: string }) => data)

  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const { groupId } = data;

    if (!groupId) {
      throw new Error('Invalid request: groupId required');
    }

    // Import database API only on the server
    const { deleteRebalancingGroup } = await import('./db-api');
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

    const { groupId } = data;

    if (!groupId) {
      throw new Error('Invalid request: groupId required');
    }

    // Import database API only on the server
    const { getRebalancingGroupById } = await import('./db-api');
    const group = await getRebalancingGroupById(groupId, user.id);
    return group;
  });

export type RebalancingGroupByIdResult = Awaited<
  ReturnType<typeof getRebalancingGroupByIdServerFn>
>;

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

    const { user } = await requireAuth();

    // Verify that all accountIds belong to the authenticated user
    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq, inArray, and } = await import('drizzle-orm');

    const ownedAccounts = await db
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(eq(schema.account.userId, user.id), inArray(schema.account.id, accountIds)));

    if (ownedAccounts.length !== accountIds.length) {
      throw new Error('Access denied: One or more accounts do not belong to you');
    }

    // Import database API only on the server
    const { getAccountHoldings } = await import('./db-api');
    const result = await getAccountHoldings(accountIds);
    return result;
  });

export type GroupAccountHoldingsResult = AccountHoldingsResult;

// Server function to get sleeve members (target securities) - runs ONLY on server
export const getSleeveMembersServerFn = createServerFn({ method: 'POST' })
  .validator((data: { sleeveIds: string[] }) => data)
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveIds } = data;

    if (!sleeveIds || sleeveIds.length === 0) {
      throw new Error('Invalid request: sleeveIds required');
    }

    // Import database API only on the server
    const { getSleeveMembers } = await import('./db-api');
    const sleeveMembers = await getSleeveMembers(sleeveIds);
    return sleeveMembers;
  });

export type SleeveMember = Awaited<ReturnType<typeof getSleeveMembersServerFn>>[number];

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

// Server function to assign a model to a rebalancing group - runs ONLY on server
export const assignModelToGroupServerFn = createServerFn({ method: 'POST' })
  .validator((data: { modelId: string; groupId: string }) => data)

  .handler(async ({ data }) => {
    const { modelId, groupId } = data;

    if (!modelId || !groupId) {
      throw new Error('Invalid request: modelId and groupId required');
    }

    const { user } = await requireAuth();

    // Import database API only on the server
    const { assignModelToGroup } = await import('./db-api');
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

    // Verify that the rebalancing group belongs to the authenticated user
    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    const group = await db
      .select({ userId: schema.rebalancingGroup.userId })
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.id, groupId))
      .limit(1);

    if (group.length === 0 || group[0].userId !== user.id) {
      throw new Error('Access denied: Rebalancing group not found or does not belong to you');
    }

    // Import database API only on the server
    const { unassignModelFromGroup } = await import('./db-api');
    await unassignModelFromGroup(modelId, groupId);
    return { success: true };
  });

// Server function to rebalance a portfolio - runs ONLY on server
export const rebalancePortfolioServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      portfolioId: string;
      method: 'allocation' | 'tlhSwap' | 'tlhRebalance' | 'investCash';
      allowOverinvestment?: boolean;
      maxOverinvestmentPercent?: number;
      cashAmount?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const {
      portfolioId,
      method,
      allowOverinvestment = false,
      maxOverinvestmentPercent = 5.0,
      cashAmount,
    } = data;

    console.log(`🎯 SERVER DEBUG: Received method: ${method}, cashAmount: ${cashAmount}`);

    if (!portfolioId || !method) {
      throw new Error('Invalid request: portfolioId and method required');
    }

    const { user } = await requireAuth();

    // Verify that the portfolio (rebalancing group) belongs to the authenticated user
    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    const portfolio = await db
      .select({ userId: schema.rebalancingGroup.userId })
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.id, portfolioId))
      .limit(1);

    if (portfolio.length === 0 || portfolio[0].userId !== user.id) {
      throw new Error('Access denied: Portfolio not found or does not belong to you');
    }

    // Import additional necessary functions
    const { and, inArray, gt, desc } = await import('drizzle-orm');
    const { executeRebalance } = await import('./rebalance-logic');

    try {
      // Get rebalancing group and its accounts
      const group = await db
        .select()
        .from(schema.rebalancingGroup)
        .where(eq(schema.rebalancingGroup.id, portfolioId))
        .limit(1);

      if (!group.length) {
        throw new Error('Rebalancing group not found');
      }

      // Get group members (accounts)
      const groupMembers = await db
        .select()
        .from(schema.rebalancingGroupMember)
        .where(eq(schema.rebalancingGroupMember.groupId, portfolioId));

      const accountIds = groupMembers.map((m) => m.accountId);

      // Get model assignment
      const modelAssignment = await db
        .select()
        .from(schema.modelGroupAssignment)
        .where(eq(schema.modelGroupAssignment.rebalancingGroupId, portfolioId))
        .limit(1);

      if (!modelAssignment.length) {
        throw new Error('No model assigned to this rebalancing group');
      }

      // Get model sleeves
      const modelSleeves = await db
        .select()
        .from(schema.modelMember)
        .where(eq(schema.modelMember.modelId, modelAssignment[0].modelId));

      // Get current holdings
      const holdings = await db
        .select({
          accountId: schema.holding.accountId,
          ticker: schema.holding.ticker,
          qty: schema.holding.qty,
          costBasis: schema.holding.averageCost,
          openedAt: schema.holding.openedAt,
          price: schema.security.price,
          accountType: schema.account.type,
        })
        .from(schema.holding)
        .innerJoin(schema.security, eq(schema.holding.ticker, schema.security.ticker))
        .innerJoin(schema.account, eq(schema.holding.accountId, schema.account.id))
        .where(inArray(schema.holding.accountId, accountIds));

      // Get wash sale restrictions from database
      const restrictions = await db
        .select()
        .from(schema.restrictedSecurity)
        .where(
          and(
            inArray(
              schema.restrictedSecurity.sleeveId,
              modelSleeves.map((s) => s.sleeveId),
            ),
            gt(schema.restrictedSecurity.blockedUntil, Date.now()),
          ),
        );

      const washSaleRestrictions = restrictions.map((r) => ({
        ticker: r.ticker,
        restrictedUntil: new Date(r.blockedUntil),
        reason: `Tax loss harvested on ${new Date(r.soldAt).toLocaleDateString()}`,
      }));

      // Get transaction history to check for wash sale restrictions
      const transactionData = await db
        .select({
          ticker: schema.transaction.ticker,
          type: schema.transaction.type,
          realizedGainLoss: schema.transaction.realizedGainLoss,
          executedAt: schema.transaction.executedAt,
          accountId: schema.transaction.accountId,
          accountName: schema.account.name,
          accountType: schema.account.type,
        })
        .from(schema.transaction)
        .innerJoin(schema.account, eq(schema.transaction.accountId, schema.account.id))
        .where(inArray(schema.transaction.accountId, accountIds))
        .orderBy(desc(schema.transaction.executedAt));

      // Convert executedAt to Date for Transaction interface
      const transactions = transactionData.map((tx) => ({
        ...tx,
        executedAt: new Date(tx.executedAt),
        realizedGainLoss: tx.realizedGainLoss ?? 0,
      }));

      console.log(
        `🔍 WASH SALE CHECK: Loaded ${transactions.length} transactions from ${accountIds.length} accounts`,
      );

      // Debug: Show what transactions we have
      transactions.forEach((tx) => {
        console.log(
          `🔍 Transaction: ${tx.ticker} ${tx.type} $${tx.realizedGainLoss?.toFixed(2) ?? 0} on ${new Date(tx.executedAt).toLocaleDateString()} in ${tx.accountName} (${tx.accountType})`,
        );
      });

      // Now using unified wash sale logic for both UI and rebalancing

      // Transform data to new format

      const sleeves: RebalanceSleeveDataNew[] = [];
      const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.qty * h.price, 0);

      console.log(
        `🎯 PORTFOLIO VALUE DEBUG: totalPortfolioValue: $${totalPortfolioValue.toFixed(2)} (raw: ${totalPortfolioValue})`,
      );

      // Add Cash sleeve first to track cash flow during rebalancing
      // Calculate total account value from account holdings (which includes calculated balances)

      // Build cash sleeve securities from actual cash holdings
      const cashSecurities: RebalanceSecurityData[] = [];
      let totalCashValue = 0;

      // Group cash holdings by ticker
      const cashHoldingsMap = new Map<
        string,
        Array<{
          ticker: string;
          qty: number;
          price: number;
          costBasis: number;
          accountType: string;
          accountId: string;
        }>
      >();
      holdings.forEach((holding) => {
        if (isAnyCashTicker(holding.ticker)) {
          const key = isBaseCashTicker(holding.ticker) ? CASH_TICKER : MANUAL_CASH_TICKER;
          if (!cashHoldingsMap.has(key)) {
            cashHoldingsMap.set(key, []);
          }
          cashHoldingsMap.get(key)?.push({ ...holding, ticker: key });
        }
      });

      // Create securities for each cash type
      cashHoldingsMap.forEach((holdingList, ticker) => {
        const totalQty = holdingList.reduce((sum, h) => sum + h.qty, 0);
        const currentValue = totalQty * holdingList[0].price;
        totalCashValue += currentValue;

        cashSecurities.push({
          securityId: ticker,
          rank: isBaseCashTicker(ticker) ? 1 : 2, // Base cash first, then MCASH
          currentQty: totalQty,
          targetPct: 0, // Cash target is 0%
          price: holdingList[0].price,
          accountId: holdingList[0].accountId,
          isTaxable: holdingList.some((h) => h.accountType === 'TAXABLE'),
          unrealizedGain: holdingList.reduce(
            (sum, h) => sum + (h.qty * h.price - h.qty * h.costBasis),
            0,
          ),
        });
      });

      sleeves.unshift({
        // Add at beginning
        sleeveId: 'cash',
        targetValue: 0, // Target is to invest all cash
        targetPct: 0, // We target 0% cash allocation
        currentValue: totalCashValue,
        securities: cashSecurities,
      });

      // Build sleeve-based data structure with rank information
      for (const modelSleeve of modelSleeves) {
        const sleeveMembers = await db
          .select({
            ticker: schema.sleeveMember.ticker,
            rank: schema.sleeveMember.rank,
          })
          .from(schema.sleeveMember)
          .where(eq(schema.sleeveMember.sleeveId, modelSleeve.sleeveId))
          .orderBy(schema.sleeveMember.rank); // Order by rank for processing

        const sleeveTargetValue = (totalPortfolioValue * modelSleeve.targetWeight) / 10000;
        const sleeveTargetPct = modelSleeve.targetWeight / 100; // Convert basis points to percentage

        const sleeveSecurities: RebalanceSecurityData[] = [];
        let sleeveCurrentValue = 0;

        for (const member of sleeveMembers) {
          // Get current holdings for this security
          const securityHoldings = holdings.filter((h) => h.ticker === member.ticker);
          const currentQty = securityHoldings.reduce((sum, h) => sum + h.qty, 0);

          // Get security price from holdings or database
          let price = 1.0; // Default price $1.00
          const securityHolding = holdings.find((h) => h.ticker === member.ticker);

          if (securityHolding) {
            price = securityHolding.price;
          } else {
            // Get price from security table if not held
            const securityPrice = await db
              .select({ price: schema.security.price })
              .from(schema.security)
              .where(eq(schema.security.ticker, member.ticker))
              .limit(1);
            if (securityPrice.length > 0) {
              price = securityPrice[0].price;
            }
          }

          const currentValue = currentQty * price;
          sleeveCurrentValue += currentValue;

          const unrealizedGain = securityHoldings.reduce(
            (sum, h) => sum + (h.qty * h.price - h.qty * h.costBasis),
            0,
          );
          sleeveSecurities.push({
            securityId: member.ticker,
            rank: member.rank,
            currentQty,
            targetPct: sleeveTargetPct / sleeveMembers.length, // Distribute target evenly among sleeve members
            price: price,
            accountId: securityHoldings[0]?.accountId || accountIds[0],
            isTaxable: securityHoldings.some(
              (h) =>
                holdings.find((hold) => hold.accountId === h.accountId)?.accountType === 'TAXABLE',
            ),
            unrealizedGain,
          });
        }

        sleeves.push({
          sleeveId: modelSleeve.sleeveId,
          targetValue: sleeveTargetValue,
          targetPct: sleeveTargetPct,
          currentValue: sleeveCurrentValue,
          securities: sleeveSecurities,
        });
      }

      // Add securities that are held but not in any sleeve (should be sold to 0)
      const sleeveTickers = new Set<string>();
      for (const sleeve of sleeves) {
        for (const sec of sleeve.securities) {
          sleeveTickers.add(sec.securityId);
        }
      }

      const orphanSecurities: RebalanceSecurityData[] = [];
      holdings.forEach((holding) => {
        if (!sleeveTickers.has(holding.ticker)) {
          const currentValue = holding.qty * holding.price;
          if (currentValue > 0) {
            orphanSecurities.push({
              securityId: holding.ticker,
              rank: 999, // High rank so they get sold first
              currentQty: holding.qty,
              targetPct: 0,
              price: holding.price,
              accountId: holding.accountId,
              isTaxable: holding.accountType === 'TAXABLE',
              unrealizedGain: (holding.qty * holding.price - holding.qty * holding.costBasis) / 100,
            });
          }
        }
      });

      // Add orphan securities as a special sleeve with 0% target
      if (orphanSecurities.length > 0) {
        sleeves.push({
          sleeveId: 'orphan-securities',
          targetValue: 0,
          targetPct: 0,
          currentValue: orphanSecurities.reduce((sum, sec) => sum + sec.currentQty * sec.price, 0),
          securities: orphanSecurities,
        });
      }

      // Create replacement candidates for TLH
      const allSecurities = sleeves.flatMap((sleeve) => sleeve.securities);
      const replacementCandidates = allSecurities.map((sec, index) => ({
        originalTicker: sec.securityId,
        replacementTicker: allSecurities[(index + 1) % allSecurities.length].securityId,
        rank: index + 1,
      }));

      // Execute rebalance using new function with transaction history
      const result = executeRebalance(
        portfolioId,
        method,
        sleeves,
        washSaleRestrictions,
        replacementCandidates,
        allowOverinvestment,
        maxOverinvestmentPercent,
        transactions,
        cashAmount,
      );

      return result;
    } catch (error) {
      console.error('Error calculating rebalance:', error);
      throw new Error(`Failed to calculate rebalance: ${getErrorMessage(error)}`);
    }
  });

export type RebalancePortfolioServerFnResult = Awaited<
  ReturnType<typeof rebalancePortfolioServerFn>
>;

// Server function to update manual cash for an account - runs ONLY on server
export const updateManualCashServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId: string; amount: number }) => data)
  .handler(async ({ data }) => {
    const { accountId, amount } = data;

    if (!accountId || amount < 0) {
      throw new Error('Invalid request: accountId required and amount must be >= 0');
    }

    const { user } = await requireAuth();

    // Verify that the account belongs to the authenticated user
    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    const account = await db
      .select({ userId: schema.account.userId })
      .from(schema.account)
      .where(eq(schema.account.id, accountId))
      .limit(1);

    if (account.length === 0 || account[0].userId !== user.id) {
      throw new Error('Access denied: Account not found or does not belong to you');
    }

    const { and } = await import('drizzle-orm');
    const now = Date.now();

    try {
      // Check if MCASH holding already exists for this account
      const existingHolding = await db
        .select()
        .from(schema.holding)
        .where(and(eq(schema.holding.accountId, accountId), eq(schema.holding.ticker, 'MCASH')))
        .limit(1);

      if (amount === 0) {
        // Delete the holding if amount is 0
        if (existingHolding.length > 0) {
          await db.delete(schema.holding).where(eq(schema.holding.id, existingHolding[0].id));
        }
      } else {
        // Store amount as quantity (MCASH price is $1.00 per share)
        const qtyInDollars = Math.round(amount);

        if (existingHolding.length > 0) {
          // Update existing holding
          await db
            .update(schema.holding)
            .set({
              qty: qtyInDollars,
              updatedAt: now,
            })
            .where(eq(schema.holding.id, existingHolding[0].id));
        } else {
          // Create new holding
          const holdingId = `manual-cash-${accountId}-${Date.now()}`;
          await db.insert(schema.holding).values({
            id: holdingId,
            accountId,
            ticker: 'MCASH',
            qty: qtyInDollars,
            averageCost: 1.0, // $1.00 per "share"
            openedAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // Clear cache to ensure fresh data
      const { clearCache } = await import('./db-api');
      clearCache();

      return { success: true };
    } catch (error) {
      console.error('Error updating manual cash:', error);
      throw new Error(`Failed to update manual cash: ${getErrorMessage(error)}`);
    }
  });

// Server function to get manual cash amount for an account - runs ONLY on server
export const getManualCashServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
    const { accountId } = data;

    if (!accountId) {
      throw new Error('Invalid request: accountId required');
    }

    const { user } = await requireAuth();

    // Import database API only on the server
    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Verify that the account belongs to the authenticated user
    const account = await db
      .select({ userId: schema.account.userId })
      .from(schema.account)
      .where(eq(schema.account.id, accountId))
      .limit(1);

    if (account.length === 0 || account[0].userId !== user.id) {
      throw new Error('Access denied: Account not found or does not belong to you');
    }

    const { and } = await import('drizzle-orm');
    try {
      // Get MCASH holding for this account
      const manualCashHolding = await db
        .select({
          qty: schema.holding.qty,
        })
        .from(schema.holding)
        .where(and(eq(schema.holding.accountId, accountId), eq(schema.holding.ticker, 'MCASH')))
        .limit(1);

      const amount = manualCashHolding.length > 0 ? manualCashHolding[0].qty : 0;

      return { amount };
    } catch (error) {
      console.error('Error getting manual cash:', error);
      throw new Error(`Failed to get manual cash: ${getErrorMessage(error)}`);
    }
  });

// Schwab Integration Server Functions

// Server function to get Schwab OAuth URL
export const getSchwabOAuthUrlServerFn = createServerFn({ method: 'POST' })
  .validator((data: { redirectUri: string }) => data)
  .handler(async ({ data }) => {
    console.log('🚀 [ServerFn] getSchwabOAuthUrl started');
    console.log('📋 [ServerFn] Request data:', data);

    try {
      console.log('📦 [ServerFn] Importing Schwab API service...');
      const { getSchwabApiService } = await import('./schwab-api');
      const schwabApi = getSchwabApiService();

      console.log('🔗 [ServerFn] Getting OAuth URL...');
      const authUrl = await schwabApi.getOAuthUrl(data.redirectUri);

      console.log('✅ [ServerFn] Successfully generated OAuth URL');
      console.log('🔗 [ServerFn] OAuth URL length:', authUrl.length);

      return { authUrl };
    } catch (error) {
      console.error('❌ [ServerFn] Error getting Schwab OAuth URL:', error);
      console.error(
        '❌ [ServerFn] Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );
      throw new Error(`Failed to get OAuth URL: ${getErrorMessage(error)}`);
    }
  });

// Server function to handle Schwab OAuth callback
export const handleSchwabOAuthCallbackServerFn = createServerFn({
  method: 'POST',
})
  .validator((data: { code: string; redirectUri: string }) => data)

  .handler(async ({ data }) => {
    console.log('🔄 [ServerFn] handleSchwabOAuthCallback started');
    console.log('📋 [ServerFn] Request data:', {
      code: data.code ? `${data.code.substring(0, 10)}...` : 'NOT PROVIDED',
      redirectUri: data.redirectUri,
    });

    try {
      const { user } = await requireAuth();

      console.log('👤 [ServerFn] Using authenticated user ID:', user.id);

      console.log('📦 [ServerFn] Importing Schwab API service...');
      const { getSchwabApiService } = await import('./schwab-api');
      const schwabApi = getSchwabApiService();

      console.log('🔄 [ServerFn] Handling OAuth callback...');
      await schwabApi.handleOAuthCallback(data.code, data.redirectUri, user.id);

      console.log('✅ [ServerFn] OAuth callback handled successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ [ServerFn] Error handling Schwab OAuth callback:', error);
      console.error(
        '❌ [ServerFn] Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );
      throw new Error(`Failed to handle OAuth callback: ${getErrorMessage(error)}`);
    }
  });

// Server function to check Schwab credentials status
export const getSchwabCredentialsStatusServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  console.log('🔍 [ServerFn] getSchwabCredentialsStatus started');

  try {
    const { user } = await requireAuth();

    console.log('👤 [ServerFn] Using authenticated user ID:', user.id);

    console.log('📦 [ServerFn] Importing Schwab API service...');
    const { getSchwabApiService } = await import('./schwab-api');
    const schwabApi = getSchwabApiService();

    console.log('✅ [ServerFn] Checking credentials validity...');
    const hasCredentials = await schwabApi.hasValidCredentials(user.id);

    console.log('📊 [ServerFn] Credentials status:', hasCredentials);
    return { hasCredentials };
  } catch (error) {
    console.error('❌ [ServerFn] Error checking Schwab credentials:', error);
    console.error(
      '❌ [ServerFn] Error stack:',
      error instanceof Error ? error.stack : 'No stack trace',
    );
    return { hasCredentials: false };
  }
});

// Server function to sync Schwab accounts
export const syncSchwabAccountsServerFn = createServerFn({
  method: 'POST',
}).handler(async (): Promise<SyncResult> => {
  console.log('🏦 [ServerFn] Starting Schwab accounts sync');
  try {
    const { user } = await requireAuth();

    console.log('👤 [ServerFn] Using user ID:', user.id);

    const { getSchwabSyncService } = await import('./schwab-sync');
    const syncService = getSchwabSyncService();
    console.log('🔧 [ServerFn] Schwab sync service initialized');

    const result = await syncService.syncAccounts(user.id);
    console.log('✅ [ServerFn] Accounts sync completed:', result);
    return result;
  } catch (error) {
    console.error('❌ [ServerFn] Error syncing Schwab accounts:', error);
    const errorResult = {
      success: false,
      recordsProcessed: 0,
      errorMessage: getErrorMessage(error),
    };
    console.log('🔄 [ServerFn] Returning error result:', errorResult);
    return errorResult;
  }
});

// Server function to sync Schwab holdings
export const syncSchwabHoldingsServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId?: string }) => data)

  .handler(async ({ data }): Promise<SyncResult> => {
    console.log('📊 [ServerFn] Starting Schwab holdings sync');
    console.log('📋 [ServerFn] Request data:', data);
    try {
      const { user } = await requireAuth();

      console.log('👤 [ServerFn] Using user ID:', user.id);

      const { getSchwabSyncService } = await import('./schwab-sync');
      const syncService = getSchwabSyncService();
      console.log('🔧 [ServerFn] Schwab sync service initialized');

      const result = await syncService.syncHoldings(user.id, data.accountId);
      console.log('✅ [ServerFn] Holdings sync completed:', result);
      return result;
    } catch (error) {
      console.error('❌ [ServerFn] Error syncing Schwab holdings:', error);
      const errorResult = {
        success: false,
        recordsProcessed: 0,
        errorMessage: getErrorMessage(error),
      };
      console.log('🔄 [ServerFn] Returning error result:', errorResult);
      return errorResult;
    }
  });

// Server function to sync Schwab transactions
export const syncSchwabTransactionsServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId?: string; startDate?: string; endDate?: string }) => data)

  .handler(async ({ data }): Promise<SyncResult> => {
    try {
      const { user } = await requireAuth();

      const { getSchwabSyncService } = await import('./schwab-sync');
      const syncService = getSchwabSyncService();
      const startDate = data.startDate ? new Date(data.startDate) : undefined;
      const endDate = data.endDate ? new Date(data.endDate) : undefined;
      const result = await syncService.syncTransactions(user.id, {
        accountId: data.accountId,
        startDate,
        endDate,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        recordsProcessed: 0,
        errorMessage: getErrorMessage(error),
      };
    }
  });

// Server function to get held position tickers
export const getHeldPositionTickersServerFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<string[]> => {
  const { user } = await requireAuth();

  const { getPositions } = await import('./db-api');
  const positions = await getPositions(user.id);

  // Get unique tickers from positions
  const uniqueTickers = [...new Set(positions.map((position) => position.ticker))];
  console.log(
    `📊 [ServerFn] Found ${uniqueTickers.length} unique tickers in held positions:`,
    uniqueTickers,
  );

  return uniqueTickers;
});

// Server function to sync prices from Schwab
export const syncSchwabPricesServerFn = createServerFn({ method: 'POST' })
  .validator((data: { symbols?: string[] }) => data)

  .handler(
    async ({
      data,
      context: _context,
    }): Promise<
      SyncResult & {
        details?: Array<{
          ticker: string;
          oldPrice: number;
          newPrice: number;
          source: string;
          success: boolean;
          error?: string;
        }>;
        logId?: string;
      }
    > => {
      console.log('💰 [ServerFn] Starting Schwab prices sync');
      console.log('📋 [ServerFn] Request data:', data);

      const { user } = await requireAuth();

      console.log('👤 [ServerFn] Using user ID:', user.id);

      try {
        const { getDatabase } = await import('./db-config');
        const db = getDatabase();
        const schema = await import('../db/schema');
        const { eq } = await import('drizzle-orm');

        const { getPriceSyncService } = await import('./price-sync');
        const priceSyncService = getPriceSyncService();
        console.log('🔧 [ServerFn] Price sync service initialized');

        // Create sync log entry (RUNNING)
        const logId = crypto.randomUUID();
        const startLog = {
          id: logId,
          userId: user.id,
          syncType: 'SECURITIES',
          status: 'RUNNING' as const,
          recordsProcessed: 0,
          startedAt: new Date(),
          createdAt: new Date(),
        };
        await db.insert(schema.syncLog).values(startLog);
        console.log('📝 [ServerFn] Created sync log for prices:', logId);

        const results = await priceSyncService.syncPrices({
          userId: user.id,
          symbols: data.symbols,
          forceRefresh: true,
        });
        console.log('📊 [ServerFn] Price sync results received:', results);

        // Persist per-ticker as generic change entries
        try {
          for (const r of results) {
            const changes = r.changes ?? {
              price: { old: r.oldPrice, new: r.newPrice },
              source: { old: undefined, new: r.source },
            };
            await db.insert(schema.syncLogDetail).values({
              id: crypto.randomUUID(),
              logId,
              entityType: 'SECURITY',
              entityId: r.ticker,
              operation: r.success ? 'UPDATE' : 'NOOP',
              changes: JSON.stringify(changes),
              success: r.success,
              message: r.error,
              createdAt: new Date(),
            });
          }
        } catch (persistErr) {
          console.warn('⚠️ [ServerFn] Failed to persist sync details:', persistErr);
        }

        // Log individual price updates for verification
        console.log('💲 [ServerFn] Individual price updates:');
        results.forEach((result, index) => {
          if (result.success) {
            console.log(
              `  ${index + 1}. ${result.ticker}: $${result.oldPrice} → $${result.newPrice} (${result.source})`,
            );
          } else {
            console.log(`  ${index + 1}. ${result.ticker}: FAILED - ${result.error}`);
          }
        });

        const successCount = results.filter((r) => r.success).length;
        const errorCount = results.filter((r) => !r.success).length;
        console.log(
          '📈 [ServerFn] Price sync summary - Success:',
          successCount,
          'Errors:',
          errorCount,
        );

        // Complete sync log
        await db
          .update(schema.syncLog)
          .set({
            status: errorCount > 0 ? 'PARTIAL' : 'SUCCESS',
            recordsProcessed: successCount,
            errorMessage: errorCount > 0 ? `${errorCount} securities failed to update` : undefined,
            completedAt: new Date(),
          })
          .where(eq(schema.syncLog.id, logId));
        console.log('🏁 [ServerFn] Completed sync log for prices:', logId);

        const finalResult = {
          success: errorCount === 0,
          recordsProcessed: successCount,
          errorMessage: errorCount > 0 ? `${errorCount} securities failed to update` : undefined,
          details: results,
          logId,
        };
        console.log('✅ [ServerFn] Prices sync completed:', finalResult);
        return finalResult;
      } catch (error) {
        console.error('❌ [ServerFn] Error syncing prices:', error);
        // Attempt to log error in sync log if we started one
        try {
          const { getDatabase } = await import('./db-config');
          const db = getDatabase();
          const schema = await import('../db/schema');
          await db.insert(schema.syncLog).values({
            id: crypto.randomUUID(),
            userId: user.id,
            syncType: 'SECURITIES',
            status: 'ERROR',
            recordsProcessed: 0,
            errorMessage: error instanceof Error ? error.message : String(error),
            startedAt: new Date(),
            completedAt: new Date(),
            createdAt: new Date(),
          });
        } catch (logErr) {
          console.warn('⚠️ [ServerFn] Failed to write error sync log:', logErr);
        }

        const errorResult = {
          success: false,
          recordsProcessed: 0,
          errorMessage: getErrorMessage(error),
        };
        console.log('🔄 [ServerFn] Returning error result:', errorResult);
        return errorResult;
      }
    },
  );

// Server function to revoke Schwab credentials
export const revokeSchwabCredentialsServerFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  console.log('🗑️ [ServerFn] Starting Schwab credentials revocation');
  try {
    const { user } = await requireAuth();

    console.log('👤 [ServerFn] Using user ID:', user.id);

    const { getSchwabApiService } = await import('./schwab-api');
    const schwabApi = getSchwabApiService();
    console.log('🔧 [ServerFn] Schwab API service initialized');

    await schwabApi.revokeCredentials(user.id);
    console.log('✅ [ServerFn] Credentials revoked successfully');

    return { success: true };
  } catch (error) {
    console.error('❌ [ServerFn] Error revoking Schwab credentials:', error);
    throw new Error(`Failed to revoke credentials: ${getErrorMessage(error)}`);
  }
});

// Server function to get sync logs
export const getSyncLogsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { user } = await requireAuth();

    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq, desc } = await import('drizzle-orm');

    const logs = await db
      .select()
      .from(schema.syncLog)
      .where(eq(schema.syncLog.userId, user.id))
      .orderBy(desc(schema.syncLog.createdAt))
      .limit(50);

    // Attach details for all logs (accounts, holdings, prices, etc.)
    const logsWithDetails = await Promise.all(
      logs.map(async (log) => {
        try {
          const details = await db
            .select()
            .from(schema.syncLogDetail)
            .where(eq(schema.syncLogDetail.logId, log.id))
            .orderBy(desc(schema.syncLogDetail.createdAt));
          return { ...log, details };
        } catch {
          return log;
        }
      }),
    );

    return logsWithDetails;
  } catch (error) {
    console.error('Error getting sync logs:', error);
    throw new Error(`Failed to get sync logs: ${getErrorMessage(error)}`);
  }
});

// Yahoo Finance Integration - Update security fundamentals and price
export const syncYahooFundamentalsServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      scope?:
        | 'all-securities'
        | 'all-holdings'
        | 'five-holdings'
        | 'missing-fundamentals'
        | 'missing-fundamentals-holdings';
      symbols?: string[];
    }) => data,
  )

  .handler(
    async ({
      data,
      context: _context,
    }): Promise<
      | {
          success: boolean;
          recordsProcessed: number;
          // biome-ignore lint/complexity/noBannedTypes: Upstream generic expects {}
          details: { [x: string]: {} }[];
          logId: `${string}-${string}-${string}-${string}-${string}`;
        }
      | {
          success: boolean;
          recordsProcessed: number;
          errorMessage?: `${number} updates failed` | undefined;
          details: Array<{
            ticker: string;
            success: boolean;
            error?: string;
            changes?: Record<string, { old: unknown; new: unknown }>;
          }>;
          logId: `${string}-${string}-${string}-${string}-${string}`;
        }
    > => {
      const { user } = await requireAuth();

      const scope = data.scope;
      const explicitSymbols = data.symbols;

      const { getDatabase } = await import('./db-config');
      const db = getDatabase();
      const schema = await import('../db/schema');
      const { eq } = await import('drizzle-orm');
      const yahooFinance = (await import('yahoo-finance2')).default;
      const { isAnyCashTicker } = await import('./constants');

      // Determine symbols to update
      let symbols: string[] = [];
      if (Array.isArray(explicitSymbols) && explicitSymbols.length > 0) {
        symbols = explicitSymbols;
      } else if (scope === 'all-holdings' || scope === 'five-holdings') {
        const { getPositions } = await import('./db-api');
        const positions = await getPositions(user.id);
        const tickers = [...new Set(positions.map((p) => p.ticker))];
        symbols = (scope === 'five-holdings' ? tickers.slice(0, 5) : tickers).filter(
          (t) => !isAnyCashTicker(t),
        );
      } else if (scope === 'missing-fundamentals') {
        // Securities missing sector or industry
        const rows = await db
          .select({
            ticker: schema.security.ticker,
            sector: schema.security.sector,
            industry: schema.security.industry,
          })
          .from(schema.security);
        symbols = rows
          .filter((r) => (!r.sector || !r.industry) && !isAnyCashTicker(r.ticker))
          .map((r) => r.ticker);
      } else if (scope === 'missing-fundamentals-holdings') {
        // Held securities that are missing sector or industry
        const { getPositions } = await import('./db-api');
        const positions = await getPositions(user.id);
        const held = new Set(positions.map((p) => p.ticker));
        const rows = await db
          .select({
            ticker: schema.security.ticker,
            sector: schema.security.sector,
            industry: schema.security.industry,
          })
          .from(schema.security);
        symbols = rows
          .filter((r) => held.has(r.ticker))
          .filter((r) => (!r.sector || !r.industry) && !isAnyCashTicker(r.ticker))
          .map((r) => r.ticker);
      } else {
        // Default and 'all-securities' -> all securities
        const all = await db.select({ ticker: schema.security.ticker }).from(schema.security);
        symbols = all.map((s) => s.ticker).filter((t) => !isAnyCashTicker(t));
      }

      if (symbols.length === 0) {
        const emptyLogId = crypto.randomUUID();
        return {
          success: true,
          recordsProcessed: 0,
          details: [],
          logId: emptyLogId as `${string}-${string}-${string}-${string}-${string}`,
        };
      }

      // Create sync log entry
      const logId = crypto.randomUUID();
      try {
        await db.insert(schema.syncLog).values({
          id: logId,
          userId: user.id,
          syncType: 'YAHOO',
          status: 'RUNNING',
          recordsProcessed: 0,
          startedAt: new Date(),
          createdAt: new Date(),
        } as unknown as typeof schema.syncLog.$inferInsert);
      } catch {
        // Ignore logging failure when creating sync log
      }

      const results: Array<{
        ticker: string;
        success: boolean;
        error?: string;
        changes?: Record<string, { old: unknown; new: unknown }>;
      }> = [];

      // Fetch and update each symbol
      for (const symbol of symbols) {
        try {
          const summary = await yahooFinance.quoteSummary(symbol, {
            modules: ['assetProfile', 'price', 'summaryDetail', 'defaultKeyStatistics'],
          } as unknown as Record<string, unknown>);

          const price = summary.price?.regularMarketPrice ?? null;
          const marketCapRaw = summary.price?.marketCap ?? summary.summaryDetail?.marketCap ?? null;
          const marketCapMillions = marketCapRaw
            ? Math.round(Number(marketCapRaw) / 1_000_000)
            : null;
          const peRatio = summary.summaryDetail?.trailingPE ?? null;
          const sector = summary.assetProfile?.sector ?? null;
          const industry = summary.assetProfile?.industry ?? null;
          const yahooName = (summary.price?.longName || summary.price?.shortName || null) as
            | string
            | null;

          // Read existing values for change set
          const current = await db
            .select({
              name: schema.security.name,
              price: schema.security.price,
              marketCap: schema.security.marketCap,
              peRatio: schema.security.peRatio,
              sector: schema.security.sector,
              industry: schema.security.industry,
              assetType: schema.security.assetType,
              assetTypeSub: schema.security.assetTypeSub,
            })
            .from(schema.security)
            .where(eq(schema.security.ticker, symbol))
            .limit(1);

          if (current.length === 0) {
            results.push({
              ticker: symbol,
              success: false,
              error: 'Security not found',
            });
            continue;
          }

          const updateData: Record<string, unknown> = { updatedAt: Date.now() };
          const changes: Record<string, { old: unknown; new: unknown }> = {};

          if (typeof price === 'number') {
            updateData.price = price;
            changes.price = { old: current[0].price, new: price };
          }
          // Only update name from Yahoo when the existing name is short (likely a placeholder), e.g. ticker
          if (yahooName) {
            const currentName = current[0].name as string | undefined;
            if (!currentName || currentName.length < 6) {
              updateData.name = yahooName;
              changes.name = { old: currentName, new: yahooName };
            }
          }
          if (typeof marketCapMillions === 'number') {
            updateData.marketCap = marketCapMillions;
            changes.marketCap = {
              old: current[0].marketCap,
              new: marketCapMillions,
            };
          }
          if (typeof peRatio === 'number') {
            updateData.peRatio = peRatio;
            changes.peRatio = { old: current[0].peRatio, new: peRatio };
          }
          if (sector) {
            updateData.sector = sector;
            changes.sector = { old: current[0].sector, new: sector };
          }
          if (industry) {
            updateData.industry = industry;
            changes.industry = { old: current[0].industry, new: industry };
          }

          if (Object.keys(updateData).length > 0) {
            await db
              .update(schema.security)
              .set(updateData)
              .where(eq(schema.security.ticker, symbol));
          }

          // Persist per-symbol detail
          try {
            await db.insert(schema.syncLogDetail).values({
              id: crypto.randomUUID(),
              logId,
              entityType: 'SECURITY',
              entityId: symbol,
              operation: 'UPDATE',
              changes: JSON.stringify(changes),
              success: true,
              createdAt: new Date(),
            } as unknown as typeof schema.syncLogDetail.$inferInsert);
          } catch {
            // Non-fatal detail logging failure
          }

          results.push({ ticker: symbol, success: true, changes });
          // small delay to avoid rate limits
          await new Promise((r) => setTimeout(r, 100));
        } catch (error) {
          const message = getErrorMessage(error);
          try {
            await db.insert(schema.syncLogDetail).values({
              id: crypto.randomUUID(),
              logId,
              entityType: 'SECURITY',
              entityId: symbol,
              operation: 'NOOP',
              changes: JSON.stringify({}),
              success: false,
              message,
              createdAt: new Date(),
            } as unknown as typeof schema.syncLogDetail.$inferInsert);
          } catch {
            // Non-fatal detail logging failure
          }
          results.push({ ticker: symbol, success: false, error: message });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const errorCount = results.length - successCount;
      try {
        await db
          .update(schema.syncLog)
          .set({
            status: errorCount > 0 ? 'PARTIAL' : 'SUCCESS',
            recordsProcessed: successCount,
            errorMessage: errorCount > 0 ? `${errorCount} updates failed` : undefined,
            completedAt: new Date(),
          })
          .where(eq(schema.syncLog.id, logId));
      } catch {
        // Ignore completion logging failure
      }

      return {
        success: errorCount === 0,
        recordsProcessed: successCount,
        errorMessage: errorCount > 0 ? (`${errorCount} updates failed` as const) : undefined,
        details: results,
        logId: logId as `${string}-${string}-${string}-${string}-${string}`,
      };
    },
  );

// Orders / Blotter server functions
export const addGroupTradesToBlotterServerFn = createServerFn({
  method: 'POST',
})
  .validator(
    (data: {
      groupId: string;
      trades: Array<{
        ticker: string;
        type: 'BUY' | 'SELL';
        qty: number;
        currentPrice?: number;
        accountId?: string;
      }>;
      batchLabel?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { groupId, trades, batchLabel } = data;
    if (!groupId || !Array.isArray(trades)) {
      throw new Error('Invalid request: groupId and trades required');
    }

    const { user } = await requireAuth();

    // Normalize trades into existing Trade type used by db-api
    const normalizedTrades = trades.map((t) => ({
      id: crypto.randomUUID(),
      type: t.type,
      ticker: t.ticker,
      sleeveId: '',
      sleeveName: '',
      qty: Math.abs(t.qty),
      currentPrice: t.currentPrice ?? 0,
      estimatedValue: (t.currentPrice ?? 0) * Math.abs(t.qty),
      reason: 'Added to blotter',
      realizedGainLoss: 0,
      canExecute: true,
      accountId: t.accountId ?? '',
      accountName: '',
      accountType: '',
      accountNumber: '',
    }));

    const { addDraftOrdersFromProposedTrades } = await import('./db-api');
    const result = await addDraftOrdersFromProposedTrades({
      userId: user.id,
      groupId,
      trades: normalizedTrades as Trade[],
      batchLabel,
    });
    return result;
  });

export const getGroupOrdersServerFn = createServerFn({ method: 'POST' })
  .validator((data: { groupId: string }) => data)
  .handler(async ({ data }) => {
    const { groupId } = data;
    if (!groupId) throw new Error('groupId required');

    const { user } = await requireAuth();

    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Verify that the rebalancing group belongs to the authenticated user
    const group = await db
      .select({ userId: schema.rebalancingGroup.userId })
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.id, groupId))
      .limit(1);

    if (group.length === 0 || group[0].userId !== user.id) {
      throw new Error('Access denied: Rebalancing group not found or does not belong to you');
    }
    // Find group members (accounts)
    const members = await db
      .select({ accountId: schema.rebalancingGroupMember.accountId })
      .from(schema.rebalancingGroupMember)
      .where(eq(schema.rebalancingGroupMember.groupId, groupId));
    const accountIds = members.map((m) => m.accountId);
    const { getOrdersForAccounts } = await import('./db-api');
    const orders = await getOrdersForAccounts(accountIds);
    return orders;
  });

export const updateOrderServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      id: string;
      updates: Partial<{
        symbol: string;
        side: 'BUY' | 'SELL';
        qty: number;
        type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
        limit: number | null;
        stop: number | null;
        tif: 'DAY' | 'GTC';
        session: 'NORMAL' | 'AM' | 'PM' | 'ALL';
      }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id, updates } = data;
    if (!id) throw new Error('id required');

    const { user } = await requireAuth();

    // Verify that the order belongs to the authenticated user
    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    const order = await db
      .select({
        userId: schema.account.userId,
      })
      .from(schema.tradeOrder)
      .innerJoin(schema.account, eq(schema.tradeOrder.accountId, schema.account.id))
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);

    if (order.length === 0 || order[0].userId !== user.id) {
      throw new Error('Access denied: Order not found or does not belong to you');
    }

    const { updateTradeOrder } = await import('./db-api');
    await updateTradeOrder(id, updates);
    return { success: true };
  });

export const deleteOrderServerFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { id } = data;
    if (!id) throw new Error('id required');

    const { user } = await requireAuth();

    // Verify that the order belongs to the authenticated user
    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    const order = await db
      .select({
        userId: schema.account.userId,
      })
      .from(schema.tradeOrder)
      .innerJoin(schema.account, eq(schema.tradeOrder.accountId, schema.account.id))
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);

    if (order.length === 0 || order[0].userId !== user.id) {
      throw new Error('Access denied: Order not found or does not belong to you');
    }

    const { deleteTradeOrder } = await import('./db-api');
    await deleteTradeOrder(id);
    return { success: true };
  });

// Preview an order with Schwab and persist preview results to the draft order
export const previewOrderServerFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { id } = data;
    if (!id) throw new Error('id required');

    const { user } = await requireAuth();

    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Verify that the order belongs to the authenticated user
    const order = await db
      .select({
        userId: schema.account.userId,
      })
      .from(schema.tradeOrder)
      .innerJoin(schema.account, eq(schema.tradeOrder.accountId, schema.account.id))
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);

    if (order.length === 0 || order[0].userId !== user.id) {
      throw new Error('Access denied: Order not found or does not belong to you');
    }

    const { getSchwabApiService } = await import('./schwab-api');
    const schwab = getSchwabApiService();

    // Load order and account
    const rows = await db
      .select()
      .from(schema.tradeOrder)
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);
    if (rows.length === 0) throw new Error('Order not found');
    const o = rows[0] as typeof schema.tradeOrder.$inferSelect;

    // Map to Schwab preview payload (align with Schwab schema)
    const payload = {
      session: o.session,
      duration: o.tif,
      orderType: o.type,
      price: o.type === 'LIMIT' ? Number(o.limit) : undefined,
      stopPrice: o.type === 'STOP' || o.type === 'STOP_LIMIT' ? Number(o.stop) : undefined,
      taxLotMethod: o.taxLotMethod ?? undefined,
      orderStrategyType: o.orderStrategyType ?? 'SINGLE',
      orderLegCollection: [
        {
          instruction: o.side,
          quantity: Number(o.qty),
          instrument: { symbol: o.symbol, assetType: 'EQUITY' },
        },
      ],
    } as Record<string, unknown>;

    // Resolve Schwab account identifier from our internal account
    const acctRow = await db
      .select({
        schwabAccountId: schema.account.schwabAccountId,
        accountNumber: schema.account.accountNumber,
      })
      .from(schema.account)
      .where(eq(schema.account.id, o.accountId))
      .limit(1);
    if (!acctRow.length) {
      throw new Error('Account not found for order');
    }
    // For Orders API, Schwab expects the hashed account id (accountId/displayAcctId).
    // Fall back to accountNumber if hash is unavailable (e.g., demo or during migration).
    // Prefer accountNumber for Orders API; fall back to Schwab hashed id
    const accountIdentifier = acctRow[0].accountNumber || acctRow[0].schwabAccountId || '';
    if (!accountIdentifier) {
      throw new Error('Schwab account identifier not available. Link account before preview.');
    }

    let resp: unknown;
    try {
      resp = await schwab.previewOrder(user.id, accountIdentifier, payload);
    } catch (e) {
      const errMsg = String(e instanceof Error ? e.message : e);
      // Retry with alternate identifier if available (switch between acct# and hash)
      const altIdentifier =
        accountIdentifier === acctRow[0].accountNumber
          ? acctRow[0].schwabAccountId
          : acctRow[0].accountNumber;
      if ((/404/.test(errMsg) || /Invalid account number/i.test(errMsg)) && altIdentifier) {
        console.warn(
          '⚠️ [PreviewOrder] Preview failed with',
          accountIdentifier,
          '— retrying with',
          altIdentifier,
        );
        try {
          resp = await schwab.previewOrder(user.id, altIdentifier, payload);
        } catch (e2) {
          // Persist preview error and rethrow
          await db
            .update(schema.tradeOrder)
            .set({
              status: 'PREVIEW_ERROR',
              previewWarnCount: 0,
              previewErrorCount: 1,
              previewFirstMessage: String(e2 instanceof Error ? e2.message : e2).slice(0, 500),
              previewJson: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.tradeOrder.id, id));
          throw e2;
        }
      } else {
        // Persist preview error and rethrow
        await db
          .update(schema.tradeOrder)
          .set({
            status: 'PREVIEW_ERROR',
            previewWarnCount: 0,
            previewErrorCount: 1,
            previewFirstMessage: errMsg.slice(0, 500),
            previewJson: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.tradeOrder.id, id));
        throw e;
      }
    }
    // Extract values
    const respObj = resp as Record<string, unknown>;
    const orderBalance =
      ((respObj?.orderStrategy as Record<string, unknown>)?.orderBalance as Record<
        string,
        unknown
      >) ?? {};
    const warns =
      ((respObj?.orderValidationResult as Record<string, unknown>)?.warns as unknown[]) ?? [];
    const rejects =
      ((respObj?.orderValidationResult as Record<string, unknown>)?.rejects as unknown[]) ?? [];

    // Persist preview details
    await db
      .update(schema.tradeOrder)
      .set({
        previewJson: JSON.stringify(resp),
        previewOrderValue: ((orderBalance as Record<string, unknown>).orderValue as number) ?? null,
        previewProjectedCommission:
          ((orderBalance as Record<string, unknown>).projectedCommission as number) ?? null,
        previewWarnCount: warns.length,
        previewErrorCount: rejects.length,
        previewFirstMessage: ((rejects[0] as Record<string, unknown>)?.message ??
          (warns[0] as Record<string, unknown>)?.message ??
          null) as string | null,
        status:
          rejects.length > 0 ? 'PREVIEW_ERROR' : warns.length > 0 ? 'PREVIEW_WARN' : 'PREVIEW_OK',
        updatedAt: new Date(),
      })
      .where(eq(schema.tradeOrder.id, id));

    // Best-effort: if preview payload contains a mark price, persist it to security table
    const tryFindMarkPrice = (obj: unknown, depth = 0): number | null => {
      if (!obj || typeof obj !== 'object' || depth > 6) return null;
      const o = obj as Record<string, unknown>;
      for (const [k, v] of Object.entries(o)) {
        const key = k.toLowerCase();
        if (
          (key === 'mark' || key === 'markprice' || key === 'mark_price') &&
          typeof v === 'number' &&
          Number.isFinite(v) &&
          v > 0
        ) {
          return v;
        }
        if (v && typeof v === 'object') {
          const nested = tryFindMarkPrice(v, depth + 1);
          if (nested && nested > 0) return nested;
        }
      }
      return null;
    };

    const tryFindLastPrice = (obj: unknown, depth = 0): number | null => {
      if (!obj || typeof obj !== 'object' || depth > 6) return null;
      const o = obj as Record<string, unknown>;
      for (const [k, v] of Object.entries(o)) {
        const key = k.toLowerCase();
        if (
          (key === 'lastprice' ||
            key === 'last' ||
            key === 'last_price' ||
            key === 'lasttradeprice') &&
          typeof v === 'number' &&
          Number.isFinite(v) &&
          v > 0
        ) {
          return v;
        }
        if (v && typeof v === 'object') {
          const nested = tryFindLastPrice(v, depth + 1);
          if (nested && nested > 0) return nested;
        }
      }
      return null;
    };

    const lastPrice = tryFindLastPrice(respObj);
    let markPrice = tryFindMarkPrice(respObj);
    // Fallback: derive price from orderValue/qty when available
    if (
      (!markPrice || !(markPrice > 0)) &&
      (!lastPrice || !(lastPrice > 0)) &&
      typeof o.qty === 'number' &&
      o.qty > 0
    ) {
      const ov = (orderBalance as Record<string, unknown>).orderValue as number | undefined;
      const derived = typeof ov === 'number' && Number.isFinite(ov) && ov > 0 ? ov / o.qty : null;
      if (derived && derived > 0) markPrice = derived;
    }
    // Choose price per rules:
    // - For MARKET orders: prefer markPrice, then lastPrice, then derived
    // - For non-MARKET: only use lastPrice (accurate last traded)
    let chosenPrice: number | null = null;
    if (o.type === 'MARKET') {
      chosenPrice =
        markPrice && markPrice > 0
          ? markPrice
          : lastPrice && lastPrice > 0
            ? lastPrice
            : markPrice && markPrice > 0 // keep as-is
              ? markPrice
              : (markPrice ?? null);
      // If neither explicit mark nor last, allow derived fallback
      if ((!chosenPrice || !(chosenPrice > 0)) && markPrice && markPrice > 0) {
        chosenPrice = markPrice;
      }
      if ((!chosenPrice || !(chosenPrice > 0)) && typeof o.qty === 'number' && o.qty > 0) {
        const ov = (orderBalance as Record<string, unknown>).orderValue as number | undefined;
        const derived = typeof ov === 'number' && Number.isFinite(ov) && ov > 0 ? ov / o.qty : null;
        if (derived && derived > 0) chosenPrice = derived;
      }
    } else {
      chosenPrice = lastPrice && lastPrice > 0 ? lastPrice : null;
    }

    if (chosenPrice && chosenPrice > 0) {
      try {
        await db
          .update(schema.security)
          .set({ price: chosenPrice, updatedAt: Date.now() })
          .where(eq(schema.security.ticker, o.symbol));
      } catch (e) {
        console.warn('⚠️ Failed to persist mark price for', o.symbol, e);
      }
    }

    return { success: true };
  });

// Submit an order to Schwab after a successful preview
export const submitOrderServerFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { id } = data;
    if (!id) throw new Error('id required');

    const { user } = await requireAuth();

    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Verify order belongs to user and load
    const rows = await db
      .select({
        orderUserId: schema.account.userId,
        all: schema.tradeOrder,
      })
      .from(schema.tradeOrder)
      .innerJoin(schema.account, eq(schema.tradeOrder.accountId, schema.account.id))
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);
    if (!rows.length || rows[0].orderUserId !== user.id) {
      throw new Error('Access denied: Order not found or does not belong to you');
    }
    const o = rows[0].all as typeof schema.tradeOrder.$inferSelect;

    // Require a preview step without errors before submit
    if (o.status !== 'PREVIEW_OK' && o.status !== 'PREVIEW_WARN') {
      throw new Error('Order must be previewed successfully (OK or WARN) before submission');
    }

    // Map to Schwab order payload
    const payload = {
      session: o.session,
      duration: o.tif,
      orderType: o.type,
      price: o.type === 'LIMIT' ? Number(o.limit) : undefined,
      stopPrice: o.type === 'STOP' || o.type === 'STOP_LIMIT' ? Number(o.stop) : undefined,
      taxLotMethod: o.taxLotMethod ?? undefined,
      orderStrategyType: o.orderStrategyType ?? 'SINGLE',
      orderLegCollection: [
        {
          instruction: o.side,
          quantity: Number(o.qty),
          instrument: { symbol: o.symbol, assetType: 'EQUITY' },
        },
      ],
    } as Record<string, unknown>;

    // Resolve Schwab account identifier
    const acctRow = await db
      .select({
        schwabAccountId: schema.account.schwabAccountId,
        accountNumber: schema.account.accountNumber,
      })
      .from(schema.account)
      .where(eq(schema.account.id, o.accountId))
      .limit(1);
    if (!acctRow.length) throw new Error('Account not found for order');
    const accountIdentifier = acctRow[0].accountNumber || acctRow[0].schwabAccountId || '';
    if (!accountIdentifier) {
      throw new Error('Schwab account identifier not available. Link account before submit.');
    }

    const { getSchwabApiService } = await import('./schwab-api');
    const schwab = getSchwabApiService();

    let resp: unknown;
    try {
      resp = await schwab.placeOrder(user.id, accountIdentifier, payload);
    } catch (e) {
      // Persist failure snapshot and rethrow
      await db
        .update(schema.tradeOrder)
        .set({
          status: 'REJECTED',
          statusDescription: String(e instanceof Error ? e.message : e).slice(0, 500),
          lastSnapshot: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.tradeOrder.id, id));
      throw e;
    }

    const respObj = (resp || {}) as Record<string, unknown>;
    const getPath = (o: Record<string, unknown>, path: string[]): unknown => {
      let cur: unknown = o;
      for (const p of path) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[p];
      }
      return cur;
    };
    const schwabOrderId: string | null =
      (respObj.orderId as string | undefined) ||
      (Array.isArray(respObj.orders) && respObj.orders[0]
        ? ((respObj.orders[0] as Record<string, unknown>).orderId as string | undefined)
        : undefined) ||
      (getPath(respObj, ['orderStrategy', 'orderId']) as string | undefined) ||
      null;
    const rawStatus = String(
      (respObj.status as string | undefined) ||
        (respObj.orderStatus as string | undefined) ||
        (getPath(respObj, ['orderStrategy', 'status']) as string | undefined) ||
        'ACCEPTED',
    ).toUpperCase();
    const allowed = new Set([
      'ACCEPTED',
      'WORKING',
      'PARTIALLY_FILLED',
      'REPLACED',
      'FILLED',
      'CANCELED',
      'REJECTED',
      'EXPIRED',
    ]);
    const status = allowed.has(rawStatus) ? rawStatus : 'ACCEPTED';

    await db
      .update(schema.tradeOrder)
      .set({
        schwabOrderId: schwabOrderId ?? undefined,
        status,
        statusDescription:
          typeof (respObj as { statusDescription?: unknown }).statusDescription === 'string'
            ? (respObj as { statusDescription?: string }).statusDescription
            : null,
        cancelable: true,
        editable: false,
        placedAt: new Date(),
        updatedAt: new Date(),
        lastSnapshot: (() => {
          try {
            return JSON.stringify(respObj);
          } catch {
            return null;
          }
        })(),
      })
      .where(eq(schema.tradeOrder.id, id));

    return { success: true, schwabOrderId };
  });

// Admin-only functions

// Get all users (admin only)
export const getAllUsersServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin();

  const { getDatabase } = await import('./db-config');
  const db = getDatabase();
  const schema = await import('../db/schema');

  const users = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      name: schema.user.name,
      role: schema.user.role,
      emailVerified: schema.user.emailVerified,
      createdAt: schema.user.createdAt,
      updatedAt: schema.user.updatedAt,
    })
    .from(schema.user)
    .orderBy(schema.user.createdAt);

  return users;
});

// Update user role (admin only)
export const updateUserRoleServerFn = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; role: 'user' | 'admin' }) => data)
  .handler(async ({ data }) => {
    const { userId, role } = data;

    await requireAdmin();

    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Verify user exists
    const existingUser = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    // Update role
    await db
      .update(schema.user)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, userId));

    return { success: true, message: `User role updated to ${role}` };
  });

// Get system statistics (admin only)
export const getSystemStatsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin();

  const { getDatabase } = await import('./db-config');
  const db = getDatabase();
  const schema = await import('../db/schema');
  const { sql } = await import('drizzle-orm');

  // Get various counts
  const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

  const accountCount = await db.select({ count: sql<number>`count(*)` }).from(schema.account);

  const sleeveCount = await db.select({ count: sql<number>`count(*)` }).from(schema.sleeve);

  const modelCount = await db.select({ count: sql<number>`count(*)` }).from(schema.model);

  const holdingCount = await db.select({ count: sql<number>`count(*)` }).from(schema.holding);

  const transactionCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.transaction);

  const rebalancingGroupCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.rebalancingGroup);

  const orderCount = await db.select({ count: sql<number>`count(*)` }).from(schema.tradeOrder);

  return {
    users: userCount[0]?.count || 0,
    accounts: accountCount[0]?.count || 0,
    sleeves: sleeveCount[0]?.count || 0,
    models: modelCount[0]?.count || 0,
    holdings: holdingCount[0]?.count || 0,
    transactions: transactionCount[0]?.count || 0,
    rebalancingGroups: rebalancingGroupCount[0]?.count || 0,
    orders: orderCount[0]?.count || 0,
  };
});

// Get audit logs (admin only)
export const getAuditLogsServerFn = createServerFn({ method: 'GET' })
  .validator((data?: { limit?: number; offset?: number; userId?: string }) => data || {})
  .handler(async ({ data = {} }) => {
    await requireAdmin();

    const { limit = 100, offset = 0, userId } = data;

    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq, desc } = await import('drizzle-orm');

    const baseQuery = db
      .select({
        id: schema.auditLog.id,
        userId: schema.auditLog.userId,
        userEmail: schema.user.email,
        action: schema.auditLog.action,
        entityType: schema.auditLog.entityType,
        entityId: schema.auditLog.entityId,
        metadata: schema.auditLog.metadata,
        createdAt: schema.auditLog.createdAt,
        ipAddress: schema.auditLog.ipAddress,
        userAgent: schema.auditLog.userAgent,
      })
      .from(schema.auditLog)
      .leftJoin(schema.user, eq(schema.auditLog.userId, schema.user.id))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const logs = userId
      ? await baseQuery.where(eq(schema.auditLog.userId, userId))
      : await baseQuery;
    return logs;
  });

// Delete user and all associated data (admin only)
export const deleteUserServerFn = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; confirmation: string }) => data)
  .handler(async ({ data }) => {
    const { userId, confirmation } = data;

    if (confirmation !== 'DELETE_USER_DATA') {
      throw new Error('Invalid confirmation');
    }

    const { user: currentUser } = await requireAdmin();

    // Prevent admins from deleting themselves
    if (currentUser.id === userId) {
      throw new Error('Cannot delete your own account');
    }

    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Verify user exists
    const existingUser = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    // Delete user (cascading deletes will handle associated data)
    await db.delete(schema.user).where(eq(schema.user.id, userId));

    return {
      success: true,
      message: `User ${existingUser[0].email} and all associated data deleted successfully`,
    };
  });

// Get all data for a specific user (admin only)
export const getUserDataServerFn = createServerFn({ method: 'GET' })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = data;

    await requireAdmin();

    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    // Get user info
    const user = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Get all user data
    const accounts = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, userId));

    const sleeves = await db.select().from(schema.sleeve).where(eq(schema.sleeve.userId, userId));

    const models = await db.select().from(schema.model).where(eq(schema.model.userId, userId));

    const rebalancingGroups = await db
      .select()
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.userId, userId));

    return {
      user: user[0],
      accounts,
      sleeves,
      models,
      rebalancingGroups,
    };
  });

// Custom signup server function that assigns admin role to first user
export const signUpWithFirstAdminServerFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string; name: string }) => data)
  .handler(async ({ data }) => {
    const { email, password, name } = data;

    const { getDatabase } = await import('./db-config');
    const db = getDatabase();
    const schema = await import('../db/schema');
    const { sql, eq } = await import('drizzle-orm');

    try {
      // Check if user creation is allowed
      const individualUse = process.env.INDIVIDUAL_USE === 'true';

      if (individualUse) {
        const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

        const totalUsers = userCount[0]?.count || 0;

        if (totalUsers > 0) {
          throw new Error(
            'This application is configured for individual use only. Only one user account is allowed. To enable multiple users, set INDIVIDUAL_USE=false in your environment variables.',
          );
        }
      }

      // Check if this would be the first user
      const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

      const totalUsers = userCount[0]?.count || 0;
      const isFirstUser = totalUsers === 0;

      // Use Better Auth's signUp.email method directly
      const { signUp } = await import('./auth-client');

      // Create user with Better Auth
      await signUp.email({
        email,
        password,
        name,
      });

      // If this was the first user, update their role to admin
      if (isFirstUser) {
        console.log('🔑 First user created, setting admin role for:', email);

        // Find the newly created user
        const newUser = await db
          .select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.email, email))
          .limit(1);

        if (newUser.length > 0) {
          await db
            .update(schema.user)
            .set({
              role: 'admin',
              updatedAt: new Date(),
            })
            .where(eq(schema.user.id, newUser[0].id));

          console.log('✅ Admin role assigned to first user');
        }
      }

      return {
        success: true,
        isFirstUser,
        message: isFirstUser
          ? 'Admin account created successfully!'
          : 'Account created successfully!',
      };
    } catch (error) {
      console.error('❌ Signup error:', error);
      throw error;
    }
  });

// Server function to verify admin access (for route loaders)
export const verifyAdminAccessServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAdmin();
  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
});

// Check if there are any users in the system (for determining first admin)
export const checkIsFirstUserServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { getDatabase } = await import('./db-config');
  const db = getDatabase();
  const schema = await import('../db/schema');
  const { sql } = await import('drizzle-orm');

  const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

  const totalUsers = userCount[0]?.count || 0;
  return {
    isFirstUser: totalUsers === 0,
    totalUsers,
  };
});

// Check if user creation is allowed based on INDIVIDUAL_USE setting
export const checkUserCreationAllowedServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  // Get environment variable
  const individualUse = process.env.INDIVIDUAL_USE === 'true';

  if (!individualUse) {
    return {
      allowed: true,
      reason: null,
    };
  }

  // If INDIVIDUAL_USE is enabled, check if there are already users
  const { getDatabase } = await import('./db-config');
  const db = getDatabase();
  const schema = await import('../db/schema');
  const { sql } = await import('drizzle-orm');

  const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

  const totalUsers = userCount[0]?.count || 0;
  const allowed = totalUsers === 0;

  return {
    allowed,
    reason: allowed
      ? null
      : 'This application is configured for individual use only. Only one user account is allowed. To enable multiple users, set INDIVIDUAL_USE=false in your environment variables.',
    totalUsers,
    individualUse,
  };
});

// Session Management Server Functions

export const getActiveSessionsServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAuth();
  const sessions = await SessionManager.getActiveSessions(user.id);
  return sessions;
});

export const invalidateSessionServerFn = createServerFn({
  method: 'POST',
}).handler(async (ctx) => {
  const { user } = await requireAuth();
  const data = ctx.data as { sessionId: string; reason: string } | undefined;

  if (!data || !data.sessionId || !data.reason) {
    throw new Error('Invalid request data');
  }

  const count = await SessionManager.invalidateSessions({
    sessionId: data.sessionId,
    reason: data.reason as
      | 'password_change'
      | 'suspicious_activity'
      | 'admin_action'
      | 'logout_all',
    userId: user.id,
  });

  return { success: true, sessionsInvalidated: count };
});

export const logoutAllSessionsServerFn = createServerFn({
  method: 'POST',
}).handler(async (ctx) => {
  const { user } = await requireAuth();
  const { currentSessionId } = (ctx.data || {}) as {
    currentSessionId?: string;
  };

  await SessionManager.logoutAllSessions(user.id, currentSessionId);

  return { success: true, message: 'All sessions have been logged out' };
});

export const cleanupExpiredSessionsServerFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  await requireAdmin(); // Only admins can cleanup sessions

  const cleanedCount = await SessionManager.cleanupExpiredSessions();

  return { success: true, cleanedSessions: cleanedCount };
});

// Server function to import Nasdaq securities - runs ONLY on server
export const importNasdaqSecuritiesServerFn = createServerFn({
  method: 'POST',
})
  .validator(
    (data: {
      limit?: number;
      skipExisting?: boolean;
      feedType?: 'all' | 'nasdaqonly' | 'nonnasdaq';
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();

    const { limit, skipExisting = true, feedType = 'all' } = data;

    try {
      // Determine URLs to fetch based on feed type
      const urls: string[] = [];
      if (feedType === 'all') {
        urls.push(
          'https://nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt',
          'https://nasdaqtrader.com/dynamic/symdir/otherlisted.txt',
        );
      } else if (feedType === 'nasdaqonly') {
        urls.push('https://nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt');
      } else if (feedType === 'nonnasdaq') {
        urls.push('https://nasdaqtrader.com/dynamic/symdir/otherlisted.txt');
      }

      // Fetch data from all URLs
      const fetchPromises = urls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch Nasdaq data from ${url}: ${response.status} ${response.statusText}`,
          );
        }
        return response.text();
      });

      const responses = await Promise.all(fetchPromises);

      // Combine all lines from all responses
      const allLines: string[] = [];
      for (const responseText of responses) {
        const lines = responseText.split('\n').filter((line) => line.trim());
        allLines.push(...lines.slice(1)); // Skip header from each file
      }

      // Parse pipe-delimited data based on feed type
      interface NasdaqSecurity {
        ticker: string;
        securityName: string;
        exchange?: string;
        marketCategory?: string;
        etf: string;
        roundLotSize: string;
        testIssue: string;
        financialStatus?: string;
      }

      const parsedSecurities: NasdaqSecurity[] = [];
      for (const line of allLines) {
        const parts = line.split('|');
        if (parts.length >= 7) {
          // Determine format based on ETF field position
          // otherlisted.txt: ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
          // nasdaqlisted.txt: Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares

          if (parts.length === 8) {
            // Check if this looks like nasdaqlisted format (Test Issue field at index 3)
            const testIssueField = parts[3]?.trim() || '';
            if (testIssueField === 'N' || testIssueField === 'Y') {
              // nasdaqlisted.txt format: ETF at index 6
              parsedSecurities.push({
                ticker: parts[0]?.trim() || '',
                securityName: parts[1]?.trim() || '',
                marketCategory: parts[2]?.trim() || '',
                testIssue: parts[3]?.trim() || '',
                financialStatus: parts[4]?.trim() || '',
                roundLotSize: parts[5]?.trim() || '',
                etf: parts[6]?.trim() || '',
                exchange: 'NASDAQ', // nasdaqlisted.txt is specifically NASDAQ securities
              });
            } else {
              // otherlisted.txt format: ETF at index 4
              parsedSecurities.push({
                ticker: parts[0]?.trim() || parts[7]?.trim() || '', // Use ACT Symbol or NASDAQ Symbol as fallback
                securityName: parts[1]?.trim() || '',
                exchange: parts[2]?.trim() || '',
                etf: parts[4]?.trim() || '',
                roundLotSize: parts[5]?.trim() || '',
                testIssue: parts[6]?.trim() || '',
              });
            }
          } else if (parts.length === 7) {
            // nasdaqlisted.txt without NextShares field: ETF at index 6
            parsedSecurities.push({
              ticker: parts[0]?.trim() || '',
              securityName: parts[1]?.trim() || '',
              marketCategory: parts[2]?.trim() || '',
              testIssue: parts[3]?.trim() || '',
              financialStatus: parts[4]?.trim() || '',
              roundLotSize: parts[5]?.trim() || '',
              etf: parts[6]?.trim() || '',
              exchange: 'NASDAQ',
            });
          }
        }
      }

      // Apply limit if specified
      const securitiesToProcess = limit ? parsedSecurities.slice(0, limit) : parsedSecurities;

      // Import to database
      const { getDatabase } = await import('./db-config');
      const db = getDatabase();
      const schema = await import('../db/schema');
      const { clearCache } = await import('./db-api');

      let importedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      const importedTickers: string[] = [];

      for (const security of securitiesToProcess) {
        try {
          // Skip test issues
          if (security.testIssue === 'Y') {
            skippedCount++;
            continue;
          }

          // Use ticker field (already determined based on feed type)
          const ticker = security.ticker;
          if (!ticker) {
            skippedCount++;
            continue;
          }

          // Validate ticker format: must be 9 characters or less and all uppercase
          if (ticker.length > 9) {
            skippedCount++;
            continue;
          }

          if (ticker !== ticker.toUpperCase()) {
            skippedCount++;
            continue;
          }

          // Check if security already exists
          if (skipExisting) {
            const existing = await db
              .select()
              .from(schema.security)
              .where(eq(schema.security.ticker, ticker))
              .limit(1);

            if (existing.length > 0) {
              skippedCount++;
              continue;
            }
          }

          // Determine asset type
          let assetType = 'EQUITY';
          let assetTypeSub = null;

          if (security.etf === 'Y') {
            assetType = 'EQUITY';
            assetTypeSub = 'ETF';
          }

          // Create a descriptive name
          const exchangeInfo = security.exchange || security.marketCategory || 'NASDAQ';
          const name = security.securityName || `${ticker} - ${exchangeInfo}`;

          // Insert security
          await db.insert(schema.security).values({
            ticker: ticker,
            name: name,
            price: 1, // Will be updated by price sync
            marketCap: null,
            peRatio: null,
            industry: null,
            sector: null,
            assetType: assetType,
            assetTypeSub: assetTypeSub,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          importedCount++;
          importedTickers.push(ticker);
        } catch (error) {
          const errorMsg = `Failed to import ${security.ticker}: ${getErrorMessage(error)}`;
          errors.push(errorMsg);
          logError(error, errorMsg);
        }
      }

      // Clear cache to refresh data
      clearCache();

      return {
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        errors: errors,
        totalParsed: parsedSecurities.length,
        totalProcessed: securitiesToProcess.length,
        importedTickers: importedTickers,
      };
    } catch (error) {
      logError(error, 'Failed to import Nasdaq securities');
      throw new DatabaseError('Failed to import Nasdaq securities', error);
    }
  });
