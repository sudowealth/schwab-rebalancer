/**
 * Centralized Query Key Factory
 *
 * Provides type-safe, consistent query keys for React Query throughout the application.
 * All query keys are organized by feature and follow consistent naming patterns.
 */

export const queryKeys = {
  // Dashboard data - all dashboard-related queries
  dashboard: {
    all: () => ['dashboard'] as const,
    positions: () => ['dashboard', 'positions'] as const,
    metrics: () => ['dashboard', 'metrics'] as const,
    transactions: () => ['dashboard', 'transactions'] as const,
    sleeves: () => ['dashboard', 'sleeves'] as const,
    groups: () => ['dashboard', 'groups'] as const,
  },

  // Models - all model-related queries
  models: {
    all: () => ['models'] as const,
    list: () => ['models', 'list'] as const,
    detail: (id: string) => ['models', id] as const,
  },

  // Securities and data feeds - all security-related queries
  securities: {
    all: () => ['securities'] as const,
    list: () => ['securities', 'list'] as const,
    data: () => ['securities', 'data'] as const,
    indices: () => ['securities', 'indices'] as const,
    syncLogs: () => ['securities', 'sync-logs'] as const,
    yahooSyncCounts: () => ['securities', 'yahoo-sync-counts'] as const,
  },

  // Onboarding - all onboarding status queries
  onboarding: {
    all: () => ['onboarding'] as const,
    securities: () => ['onboarding', 'securities'] as const,
    models: () => ['onboarding', 'models'] as const,
    schwab: () => ['onboarding', 'schwab'] as const,
  },

  // Integration services - all external service queries
  integrations: {
    schwab: {
      credentials: () => ['integrations', 'schwab', 'credentials'] as const,
      activeCredentials: () => ['integrations', 'schwab', 'active-credentials'] as const,
      accounts: () => ['integrations', 'schwab', 'accounts'] as const,
    },
  },

  // Admin functionality - all admin-related queries
  admin: {
    all: () => ['admin'] as const,
    users: () => ['admin', 'users'] as const,
    userData: (userId: string) => ['admin', 'users', userId] as const,
    stats: () => ['admin', 'stats'] as const,
  },

  // Rebalancing - all rebalancing-related queries
  rebalancing: {
    groups: {
      all: () => ['rebalancing', 'groups'] as const,
      detail: (id: string) => ['rebalancing', 'groups', id] as const,
      allocationData: (groupId: string, allocationView: string, totalValue: number) =>
        ['rebalancing', 'groups', groupId, 'allocation', allocationView, totalValue] as const,
      topHoldings: (groupId: string, totalValue: number) =>
        ['rebalancing', 'groups', groupId, 'top-holdings', totalValue] as const,
    },
  },

  // System and environment
  system: {
    environment: () => ['system', 'environment'] as const,
  },
} as const;

/**
 * Type definitions for query keys
 */
export type DashboardQueryKeys = ReturnType<
  (typeof queryKeys.dashboard)[keyof typeof queryKeys.dashboard]
>;
export type ModelsQueryKeys = ReturnType<(typeof queryKeys.models)[keyof typeof queryKeys.models]>;
export type SecuritiesQueryKeys = ReturnType<
  (typeof queryKeys.securities)[keyof typeof queryKeys.securities]
>;
export type OnboardingQueryKeys = ReturnType<
  (typeof queryKeys.onboarding)[keyof typeof queryKeys.onboarding]
>;
export type SchwabQueryKeys = ReturnType<
  (typeof queryKeys.integrations.schwab)[keyof typeof queryKeys.integrations.schwab]
>;
export type AdminQueryKeys = ReturnType<(typeof queryKeys.admin)[keyof typeof queryKeys.admin]>;
export type RebalancingQueryKeys = ReturnType<
  (typeof queryKeys.rebalancing.groups)[keyof typeof queryKeys.rebalancing.groups]
>;
export type SystemQueryKeys = ReturnType<(typeof queryKeys.system)[keyof typeof queryKeys.system]>;
