// Client-side API functions that directly call server functions
// This approach avoids the "promisify is not a function" error by keeping
// database operations on the server side only

import type {
  PortfolioMetrics,
  Position,
  RestrictedSecurity,
  Sleeve,
  SP500Stock,
  Trade,
  Transaction,
} from '~/features/auth/schemas';
import {
  getIndexMembers as _getIndexMembers,
  getIndices as _getIndices,
  getPortfolioMetrics as _getPortfolioMetrics,
  getPositions as _getPositions,
  getProposedTrades as _getProposedTrades,
  getRestrictedSecurities as _getRestrictedSecurities,
  getSecuritiesByIndex as _getSecuritiesByIndex,
  getSleeves as _getSleeves,
  getSnP500Data as _getSnP500Data,
  getTransactions as _getTransactions,
} from './db-api';

// Check if we're running on the server
const isServer = typeof window === 'undefined';

// Server-side functions that can be called from client
export const getPositions = async (): Promise<Position[]> => {
  if (isServer) {
    return _getPositions();
  }
  // For client-side, we'll need to implement proper API calls
  // For now, return empty array to avoid the promisify error
  return [];
};

export const getTransactions = async (userId?: string): Promise<Transaction[]> => {
  if (isServer) {
    return _getTransactions(userId || '');
  }
  return [];
};

export const getPortfolioMetrics = async (): Promise<PortfolioMetrics> => {
  if (isServer) {
    return _getPortfolioMetrics();
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
    return _getSleeves();
  }
  return [];
};

export const getRestrictedSecurities = async (): Promise<RestrictedSecurity[]> => {
  if (isServer) {
    return _getRestrictedSecurities();
  }
  return [];
};

export const getProposedTrades = async (): Promise<Trade[]> => {
  if (isServer) {
    return _getProposedTrades();
  }
  return [];
};

export const getSnP500Data = async (): Promise<SP500Stock[]> => {
  if (isServer) {
    return _getSnP500Data();
  }
  return [];
};

// Demo data seeding function
export const seedDemoData = async () => {
  if (isServer) {
    console.log('🌱 Demo data seeding is handled by the database seed script');
    console.log('Run: npx tsx src/lib/seed.ts');
    return true;
  }
  return false;
};

export const getIndices = async (): Promise<Array<{ id: string; name: string }>> => {
  if (isServer) {
    return _getIndices();
  }
  return [];
};

export const getSecuritiesByIndex = async (indexId?: string): Promise<SP500Stock[]> => {
  if (isServer) {
    return _getSecuritiesByIndex(indexId);
  }
  return [];
};

export const getIndexMembers = async (): Promise<
  Array<{ indexId: string; securityId: string }>
> => {
  if (isServer) {
    return _getIndexMembers();
  }
  return [];
};
