// Client-side API functions that call server endpoints
export {
  getPositions,
  getTransactions,
  getPortfolioMetrics,
  getSleeves,
  getRestrictedSecurities,
  getProposedTrades,
  getSnP500Data,
  seedDemoData,
  getIndices,
  getSecuritiesByIndex,
  getIndexMembers,
} from "./client-api";

// Import types
export type {
  Position,
  Transaction,
  SP500Stock,
  Sleeve,
  RestrictedSecurity,
  Trade,
  PortfolioMetrics,
} from "./schemas";
