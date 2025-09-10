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

    // Load Schwab credentials status
    let schwabCredentialsStatus = { hasCredentials: false };
    if (userId) {
      try {
        const { getSchwabApiService } = await import('./schwab-api');
        const schwabApi = getSchwabApiService();
        const hasCredentials = await schwabApi.hasValidCredentials(userId);
        schwabCredentialsStatus = { hasCredentials };
        console.log('📊 Schwab credentials status loaded:', hasCredentials);
      } catch (error) {
        console.warn('⚠️ Failed to load Schwab credentials status:', error);
      }
    }

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
    };
  }
}

export type DashboardDataResult = Awaited<ReturnType<typeof loadDashboardData>>;
