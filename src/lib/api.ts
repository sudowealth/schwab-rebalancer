// Client-side API functions that call server endpoints

// Import types
export type {
  PortfolioMetrics,
  Position,
  RestrictedSecurity,
  Sleeve,
  SP500Stock,
  Trade,
  Transaction,
} from '~/features/auth/schemas';
export {
  getIndexMembers,
  getIndices,
  getPortfolioMetrics,
  getPositions,
  getProposedTrades,
  getRestrictedSecurities,
  getSecuritiesByIndex,
  getSleeves,
  getSnP500Data,
  getTransactions,
  seedDemoData,
} from './client-api';
