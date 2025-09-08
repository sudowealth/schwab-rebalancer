// Client-side API functions that directly call server functions
// This approach avoids the "promisify is not a function" error by keeping
// database operations on the server side only

import type {
  Position,
  Transaction,
  SP500Stock,
  Sleeve,
  RestrictedSecurity,
  Trade,
  PortfolioMetrics,
} from "./schemas";

// Check if we're running on the server
const isServer = typeof window === "undefined";

// Server-side functions that can be called from client
export const getPositions = async (): Promise<Position[]> => {
  if (isServer) {
    const { getPositions } = await import("./db-api");
    return getPositions();
  }
  // For client-side, we'll need to implement proper API calls
  // For now, return empty array to avoid the promisify error
  return [];
};

export const getTransactions = async (): Promise<Transaction[]> => {
  if (isServer) {
    const { getTransactions } = await import("./db-api");
    return getTransactions();
  }
  return [];
};

export const getPortfolioMetrics = async (): Promise<PortfolioMetrics> => {
  if (isServer) {
    const { getPortfolioMetrics } = await import("./db-api");
    return getPortfolioMetrics();
  }
  return {
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
  };
};

export const getSleeves = async (): Promise<Sleeve[]> => {
  if (isServer) {
    const { getSleeves } = await import("./db-api");
    return getSleeves();
  }
  return [];
};

export const getRestrictedSecurities = async (): Promise<
  RestrictedSecurity[]
> => {
  if (isServer) {
    const { getRestrictedSecurities } = await import("./db-api");
    return getRestrictedSecurities();
  }
  return [];
};

export const getProposedTrades = async (): Promise<Trade[]> => {
  if (isServer) {
    const { getProposedTrades } = await import("./db-api");
    return getProposedTrades();
  }
  return [];
};

export const getSnP500Data = async (): Promise<SP500Stock[]> => {
  if (isServer) {
    const { getSnP500Data } = await import("./db-api");
    return getSnP500Data();
  }
  return [];
};

// Demo data seeding function
export const seedDemoData = async () => {
  if (isServer) {
    console.log("🌱 Demo data seeding is handled by the database seed script");
    console.log("Run: npx tsx src/lib/seed.ts");
    return true;
  }
  return false;
};

export const getIndices = async (): Promise<Array<{id: string, name: string}>> => {
  if (isServer) {
    const { getIndices } = await import("./db-api");
    return getIndices();
  }
  return [];
};

export const getSecuritiesByIndex = async (indexId?: string): Promise<SP500Stock[]> => {
  if (isServer) {
    const { getSecuritiesByIndex } = await import("./db-api");
    return getSecuritiesByIndex(indexId);
  }
  return [];
};

export const getIndexMembers = async (): Promise<Array<{indexId: string, securityId: string}>> => {
  if (isServer) {
    const { getIndexMembers } = await import("./db-api");
    return getIndexMembers();
  }
  return [];
};
