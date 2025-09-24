// Client-side API functions that call server functions
// Database operations are kept server-side only

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
  getIndexMembersServerFn,
  getIndicesServerFn,
  getPortfolioMetricsServerFn,
  getPositionsServerFn,
  getProposedTradesServerFn,
  getRestrictedSecuritiesServerFn,
  getSecuritiesByIndexServerFn,
  getSleevesServerFn,
  getSp500DataServerFn,
  getTransactionsServerFn,
  seedDemoDataServerFn,
} from './server-functions';
// Server-side functions that can be called from client
export const getPositions = async (): Promise<Position[]> => {
  return getPositionsServerFn();
};

export const getTransactions = async (): Promise<Transaction[]> => {
  return getTransactionsServerFn();
};

export const getPortfolioMetrics = async (): Promise<PortfolioMetrics> => {
  return getPortfolioMetricsServerFn();
};

export const getSleeves = async (): Promise<Sleeve[]> => {
  return getSleevesServerFn();
};

export const getRestrictedSecurities = async (): Promise<RestrictedSecurity[]> => {
  return getRestrictedSecuritiesServerFn();
};

export const getProposedTrades = async (): Promise<Trade[]> => {
  return getProposedTradesServerFn();
};

export const getSnP500Data = async (): Promise<SP500Stock[]> => {
  return getSp500DataServerFn();
};

// Demo data seeding function
export const seedDemoData = async () => {
  return seedDemoDataServerFn();
};

export const getIndices = async (): Promise<Array<{ id: string; name: string }>> => {
  return getIndicesServerFn();
};

export const getSecuritiesByIndex = async (indexId?: string): Promise<SP500Stock[]> => {
  return getSecuritiesByIndexServerFn({ data: { indexId } });
};

export const getIndexMembers = async (): Promise<
  Array<{ indexId: string; securityId: string }>
> => {
  return getIndexMembersServerFn();
};
