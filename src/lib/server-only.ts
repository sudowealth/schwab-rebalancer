// Server-only wrapper to prevent client-side imports
// This file uses dynamic imports to ensure database modules are never bundled for client

export async function loadDashboardData(
  userId?: string,
  user?: { id: string; name?: string; email: string },
) {
  // Double-check we're on the server
  if (typeof window !== 'undefined') {
    console.warn('loadDashboardData called on client, returning empty data');
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
      rebalancingRunsStatus: { hasRuns: false, runsCount: 0 },
      proposedTradesStatus: { hasTrades: false, tradesCount: 0 },
    };
  }

  try {
    // Dynamic import to prevent client-side bundling
    const dbApiModule = await import('./db-api');

    console.log('🔄 Loading dashboard data from database...');

    const [
      positions,
      metrics,
      transactions,
      sp500Data,
      proposedTrades,
      sleeves,
      indices,
      indexMembers,
    ] = await Promise.all([
      dbApiModule.getPositions(userId),
      dbApiModule.getPortfolioMetrics(userId),
      dbApiModule.getTransactions(userId),
      dbApiModule.getSnP500Data(),
      dbApiModule.getProposedTrades(userId),
      dbApiModule.getSleeves(userId),
      dbApiModule.getIndices(),
      dbApiModule.getIndexMembers(),
    ]);

    console.log('✅ Dashboard data loaded successfully');
    console.log(
      `📊 Data counts: positions=${positions.length}, transactions=${transactions.length}, sp500=${sp500Data.length}, sleeves=${sleeves.length}`,
    );

    if (sp500Data.length === 0) {
      console.warn('⚠️ SP500 data is empty in server-only loader!');
    }

    // Load Schwab environment variables status (for "Configure" step)
    let schwabCredentialsStatus = { hasCredentials: false };
    try {
      const { hasSchwabCredentialsConfigured } = await import('./schwab-api');
      const hasCredentials = hasSchwabCredentialsConfigured();
      schwabCredentialsStatus = { hasCredentials };
      console.log('📊 Schwab environment credentials status loaded:', hasCredentials);
    } catch (error) {
      console.warn('⚠️ Failed to load Schwab environment credentials status:', error);
    }

    // Load Schwab OAuth status (for "Connect" step)
    let schwabOAuthStatus = { hasCredentials: false };
    if (userId) {
      try {
        const { getSchwabApiService } = await import('./schwab-api');
        const schwabApi = getSchwabApiService();
        const hasOAuthCredentials = await schwabApi.hasValidCredentials(userId);
        schwabOAuthStatus = { hasCredentials: hasOAuthCredentials };
        console.log('📊 Schwab OAuth credentials status loaded:', hasOAuthCredentials);
      } catch (error) {
        console.warn('⚠️ Failed to load Schwab OAuth credentials status:', error);
        schwabOAuthStatus = { hasCredentials: false };
      }
    }

    // Count user accounts to control zero-state rendering on dashboard
    let accountsCount = 0;
    try {
      if (userId) {
        const { getDatabase } = await import('./db-config');
        const db = getDatabase();
        const schema = await import('../db/schema');
        const { eq, sql } = await import('drizzle-orm');
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.account)
          .where(eq(schema.account.userId, userId));
        accountsCount = result[0]?.count || 0;
      }
    } catch (error) {
      console.warn('⚠️ Failed to count accounts for dashboard:', error);
      accountsCount = 0;
    }

    // Check if securities exist (excluding cash)
    let securitiesStatus = { hasSecurities: false, securitiesCount: 0 };
    try {
      if (userId) {
        const { getDatabase } = await import('./db-config');
        const db = getDatabase();
        const schema = await import('../db/schema');
        const { ne, sql } = await import('drizzle-orm');
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.security)
          .where(ne(schema.security.ticker, '$$$'));
        securitiesStatus = {
          hasSecurities: (result[0]?.count || 0) > 0,
          securitiesCount: result[0]?.count || 0,
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to check securities status:', error);
      securitiesStatus = { hasSecurities: false, securitiesCount: 0 };
    }

    // Check if models exist for the user
    let modelsStatus = { hasModels: false, modelsCount: 0 };
    try {
      if (userId) {
        const { getDatabase } = await import('./db-config');
        const db = getDatabase();
        const schema = await import('../db/schema');
        const { eq, sql } = await import('drizzle-orm');
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.model)
          .where(eq(schema.model.userId, userId));
        modelsStatus = {
          hasModels: (result[0]?.count || 0) > 0,
          modelsCount: result[0]?.count || 0,
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to check models status:', error);
      modelsStatus = { hasModels: false, modelsCount: 0 };
    }

    // Check if rebalancing groups exist for the user
    let rebalancingGroupsStatus = { hasGroups: false, groupsCount: 0 };
    try {
      if (userId) {
        const { getDatabase } = await import('./db-config');
        const db = getDatabase();
        const schema = await import('../db/schema');
        const { eq, sql } = await import('drizzle-orm');
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.rebalancingGroup)
          .where(eq(schema.rebalancingGroup.userId, userId));
        rebalancingGroupsStatus = {
          hasGroups: (result[0]?.count || 0) > 0,
          groupsCount: result[0]?.count || 0,
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to check rebalancing groups status:', error);
      rebalancingGroupsStatus = { hasGroups: false, groupsCount: 0 };
    }

    // Check if rebalancing runs exist (trade orders that are not DRAFT status)
    let rebalancingRunsStatus = { hasRuns: false, runsCount: 0 };
    try {
      if (userId) {
        const { getDatabase } = await import('./db-config');
        const db = getDatabase();
        const schema = await import('../db/schema');
        const { eq, ne, sql, and } = await import('drizzle-orm');
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.tradeOrder)
          .where(and(eq(schema.tradeOrder.userId, userId), ne(schema.tradeOrder.status, 'DRAFT')));
        rebalancingRunsStatus = {
          hasRuns: (result[0]?.count || 0) > 0,
          runsCount: result[0]?.count || 0,
        };
      }
    } catch (error) {
      console.warn('⚠️ Failed to check rebalancing runs status:', error);
      rebalancingRunsStatus = { hasRuns: false, runsCount: 0 };
    }

    // Check if proposed trades exist
    let proposedTradesStatus = { hasTrades: false, tradesCount: 0 };
    proposedTradesStatus = {
      hasTrades: proposedTrades.length > 0,
      tradesCount: proposedTrades.length,
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
      rebalancingRunsStatus,
      proposedTradesStatus,
    };
  } catch (error) {
    console.error('❌ Error loading dashboard data:', error);
    // Return empty data to prevent crashes
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
      rebalancingRunsStatus: { hasRuns: false, runsCount: 0 },
      proposedTradesStatus: { hasTrades: false, tradesCount: 0 },
    };
  }
}

export type DashboardDataResult = Awaited<ReturnType<typeof loadDashboardData>>;
