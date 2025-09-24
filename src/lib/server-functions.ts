// Administrative functions
import { createServerFn } from '@tanstack/react-start';
import { verifyAdminAccessServerFn } from '~/features/auth/auth.server';

// Static imports for authentication utilities
import { requireAuth } from '~/features/auth/auth-utils';
import { getEnv } from '~/lib/env';

// Get environment information for client-side use
export const getEnvironmentInfoServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const env = getEnv();
  return {
    isDevelopment: env.NODE_ENV === 'development',
    nodeEnv: env.NODE_ENV,
  };
});

// Lightweight auth check server function for route guards
export const checkAuthServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  return { authenticated: true, user };
});

// Lightweight admin check server function for route guards
export const checkAdminServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  await verifyAdminAccessServerFn();
  return { authenticated: true, isAdmin: true };
});

// Auth server functions
export {
  checkIsFirstUserServerFn,
  checkUserCreationAllowedServerFn,
  cleanupExpiredSessionsServerFn,
  deleteUserServerFn,
  getActiveSessionsServerFn,
  getAllUsersServerFn,
  getUserDataServerFn,
  invalidateSessionServerFn,
  logoutAllSessionsServerFn,
  signUpWithFirstAdminServerFn,
  updateUserRoleServerFn,
  verifyAdminAccessServerFn,
} from '~/features/auth/auth.server';
export type { RebalancingGroup, Trade } from '~/features/auth/schemas';
export {
  getAuditLogsServerFn,
  getSystemStatsServerFn,
} from '~/features/dashboard/admin.server';
// Dashboard and basic data access functions
export {
  clearCacheServerFn,
  generateAllocationDataServerFn,
  generateTopHoldingsDataServerFn,
  getAccountsForRebalancingGroupsServerFn,
  getAvailableAccountsServerFn,
  getAvailableSecuritiesServerFn,
  getCompleteDashboardDataServerFn,
  getGroupTransactionsServerFn,
  getPortfolioMetricsServerFn,
  getPositionsServerFn,
  getProposedTradesServerFn,
  getRestrictedSecuritiesServerFn,
  getSecuritiesDataServerFn,
  getSp500DataServerFn,
  getTransactionsServerFn,
  truncateSecurityTableServerFn,
  updateAccountServerFn,
} from '~/features/dashboard/dashboard.server';
// Data import and seeding functions
export {
  checkModelsExistServerFn,
  checkRebalancingGroupsExistServerFn,
  checkSchwabCredentialsServerFn,
  checkSecuritiesExistServerFn,
  getYahooSyncCountsServerFn,
  importNasdaqSecuritiesServerFn,
  seedDemoDataServerFn,
  seedGlobalEquityModelServerFn,
  seedModelsDataServerFn,
  seedSecuritiesDataServerFn,
  truncateDataServerFn,
} from '~/features/data-feeds/import.server';
// Yahoo Finance integration
export { syncYahooFundamentalsServerFn } from '~/features/data-feeds/yahoo.server';
// Model CRUD operations
export {
  createModelServerFn,
  deleteModelServerFn,
  getModelByIdServerFn,
  getModelsServerFn,
  updateModelServerFn,
} from '~/features/models/model.server';
export type {
  GroupAccountHoldingsResult,
  SleeveMember,
} from '~/features/rebalancing/server/groups.server';
// Rebalancing group operations
export {
  assignModelToGroupServerFn,
  createRebalancingGroupServerFn,
  deleteRebalancingGroupServerFn,
  getGroupAccountHoldingsServerFn,
  getHoldingsForMultipleGroupsServerFn,
  getRebalancingGroupByIdServerFn,
  getRebalancingGroupsServerFn,
  getSleeveMembersServerFn,
  unassignModelFromGroupServerFn,
  updateRebalancingGroupServerFn,
} from '~/features/rebalancing/server/groups.server';
export type { RebalancePortfolioServerFnResult } from '~/features/rebalancing/server/portfolio.server';
// Portfolio management and rebalancing
export {
  calculateTradeMetricsServerFn,
  getManualCashServerFn,
  rebalancePortfolioServerFn,
  updateManualCashServerFn,
} from '~/features/rebalancing/server/portfolio.server';
export type {
  RebalanceSecurityData,
  RebalanceSleeveDataNew,
} from '~/features/rebalancing/server/rebalance-logic.server';
// Schwab integration functions
export {
  addGroupTradesToBlotterServerFn,
  deleteOrderServerFn,
  deleteSyncLogServerFn,
  getGroupOrdersServerFn,
  getGroupSecuritiesNeedingPriceUpdatesServerFn,
  getHeldAndSleeveTickersServerFn,
  getHeldPositionTickersServerFn,
  getSchwabCredentialsStatusServerFn,
  getSchwabOAuthUrlServerFn,
  getSleeveTargetTickersServerFn,
  getSyncLogsServerFn,
  handleSchwabOAuthCallbackServerFn,
  previewOrderServerFn,
  revokeSchwabCredentialsServerFn,
  submitOrderServerFn,
  syncGroupPricesIfNeededServerFn,
  syncSchwabAccountsServerFn,
  syncSchwabHoldingsServerFn,
  syncSchwabPricesServerFn,
  syncSchwabTransactionsServerFn,
  updateOrderServerFn,
} from '~/features/schwab/schwab.server';
export type { SyncResult } from '~/features/schwab/schwab-sync.server';
// Sleeve CRUD operations
export {
  createSleeveServerFn,
  deleteSleeveServerFn,
  getAvailableSleevesServerFn,
  getSleeveByIdServerFn,
  getSleeveHoldingsInfoServerFn,
  getSleevesServerFn,
  updateSleeveServerFn,
} from '../features/sleeves/sleeves.server';
// Utility functions
export { healthCheckServerFn } from './utility.server';
