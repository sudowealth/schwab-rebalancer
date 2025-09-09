// Server-only API functions
// This file should only be imported on the server side

export async function getServerData() {
  // Only import the database functions if we're on the server
  if (typeof window !== 'undefined') {
    throw new Error('This function should only be called on the server');
  }

  const {
    getPositions,
    getTransactions,
    getPortfolioMetrics,
    getSleeves,
    getProposedTrades,
    getSnP500Data,
  } = await import('./db-api');

  try {
    const [positions, metrics, transactions, sp500Data, proposedTrades, sleeves] =
      await Promise.all([
        getPositions(),
        getPortfolioMetrics(),
        getTransactions(),
        getSnP500Data(),
        getProposedTrades(),
        getSleeves(),
      ]);

    return {
      positions,
      metrics,
      transactions,
      sp500Data,
      proposedTrades,
      sleeves,
    };
  } catch (error) {
    console.error('Error loading server data:', error);
    // Return empty data instead of throwing to avoid breaking the page
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
    };
  }
}
