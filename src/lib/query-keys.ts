/**
 * Centralized Query Key Factory
 *
 * Provides type-safe, consistent query keys for React Query throughout the application.
 * All query keys are organized by feature and follow consistent naming patterns.
 */

export const queryKeys = {
  // Dashboard data
  dashboard: {
    positions: () => ['dashboard', 'positions'] as const,
    metrics: () => ['dashboard', 'metrics'] as const,
    transactions: () => ['dashboard', 'transactions'] as const,
    sleeves: () => ['dashboard', 'sleeves'] as const,
    groups: () => ['dashboard', 'rebalancing-groups'] as const,
    all: () => ['dashboard'] as const,
  },

  // Schwab integration
  schwab: {
    credentials: () => ['schwab', 'credentials-status'] as const,
    activeCredentials: () => ['schwab', 'active-credentials'] as const,
    accounts: () => ['schwab', 'accounts'] as const,
  },

  // Admin functionality
  admin: {
    users: () => ['admin', 'users'] as const,
    userData: (userId: string) => ['admin', 'userData', userId] as const,
    stats: () => ['admin', 'stats'] as const,
  },

  // Data feeds and securities
  dataFeeds: {
    securities: () => ['data-feeds', 'securities'] as const,
    securitiesData: () => ['data-feeds', 'securities-data'] as const,
    models: () => ['data-feeds', 'models'] as const,
    indices: () => ['data-feeds', 'indices'] as const,
    syncLogs: () => ['data-feeds', 'sync-logs'] as const,
    yahooSyncCounts: () => ['data-feeds', 'yahoo-sync-counts'] as const,
  },

  // Onboarding and status
  onboarding: {
    all: () => ['onboarding'] as const,
    securities: () => ['onboarding', 'securities-status'] as const,
    models: () => ['onboarding', 'models-status'] as const,
    schwab: () => ['onboarding', 'schwab-credentials-status'] as const,
  },

  // System and environment
  system: {
    environment: () => ['system', 'environment-info'] as const,
  },

  // Rebalancing groups
  rebalancingGroups: {
    allocationData: (groupId: string, allocationView: string, totalValue: number) =>
      ['rebalancing-groups', 'allocation-data', groupId, allocationView, totalValue] as const,
    topHoldings: (groupId: string, totalValue: number) =>
      ['rebalancing-groups', 'top-holdings', groupId, totalValue] as const,
  },
} as const;

/**
 * Type definitions for query keys
 */
export type DashboardQueryKeys = ReturnType<
  (typeof queryKeys.dashboard)[keyof typeof queryKeys.dashboard]
>;
export type SchwabQueryKeys = ReturnType<(typeof queryKeys.schwab)[keyof typeof queryKeys.schwab]>;
export type AdminQueryKeys = ReturnType<(typeof queryKeys.admin)[keyof typeof queryKeys.admin]>;
