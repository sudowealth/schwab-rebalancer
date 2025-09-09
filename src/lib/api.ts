// Client-side API functions that call server endpoints
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

// Import types
export type {
  PortfolioMetrics,
  Position,
  RestrictedSecurity,
  Sleeve,
  SP500Stock,
  Trade,
  Transaction,
} from './schemas';
