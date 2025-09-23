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
    groups: () => ['onboarding', 'groups'] as const,
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
      allocationData: (groupId: string, allocationView: string) =>
        ['rebalancing', 'groups', groupId, 'allocation', allocationView] as const,
      topHoldings: (groupId: string) => ['rebalancing', 'groups', groupId, 'top-holdings'] as const,
    },
  },

  // System and environment
  system: {
    environment: () => ['system', 'environment'] as const,
  },
} as const;

/**
 * Centralized Query Invalidation Helpers
 *
 * Provides type-safe invalidation methods for React Query cache management.
 * These helpers ensure consistent invalidation patterns across the application.
 */
export const queryInvalidators = {
  // Dashboard invalidation helpers
  dashboard: {
    all: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
    positions: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.positions() });
    },
    metrics: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.metrics() });
    },
    transactions: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.transactions() });
    },
    sleeves: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.sleeves() });
    },
    groups: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.groups() });
    },
  },

  // Models invalidation helpers
  models: {
    all: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.models.all() });
    },
    detail: (queryClient: import('@tanstack/react-query').QueryClient, id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.models.detail(id) });
    },
  },

  // Securities invalidation helpers
  securities: {
    all: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.securities.all() });
    },
    list: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.securities.list() });
    },
    data: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.securities.data() });
    },
    indices: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.securities.indices() });
    },
    syncLogs: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.securities.syncLogs() });
    },
    yahooSyncCounts: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.securities.yahooSyncCounts() });
    },
  },

  // Onboarding invalidation helpers
  onboarding: {
    all: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all() });
    },
    securities: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.securities() });
    },
    models: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.models() });
    },
    schwab: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.schwab() });
    },
    groups: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.groups() });
    },
  },

  // Schwab integration invalidation helpers
  schwab: {
    credentials: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.schwab.credentials() });
    },
    activeCredentials: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.schwab.activeCredentials(),
      });
    },
    accounts: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.schwab.accounts() });
    },
  },

  // Admin invalidation helpers
  admin: {
    all: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all() });
    },
    users: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
    },
    userData: (queryClient: import('@tanstack/react-query').QueryClient, userId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.userData(userId) });
    },
    stats: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats() });
    },
  },

  // Rebalancing invalidation helpers
  rebalancing: {
    groups: {
      all: (queryClient: import('@tanstack/react-query').QueryClient) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.rebalancing.groups.all() });
      },
      detail: (queryClient: import('@tanstack/react-query').QueryClient, id: string) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.rebalancing.groups.detail(id) });
      },
      allocationData: (
        queryClient: import('@tanstack/react-query').QueryClient,
        groupId: string,
        allocationView: string,
      ) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.rebalancing.groups.allocationData(groupId, allocationView),
        });
      },
      topHoldings: (queryClient: import('@tanstack/react-query').QueryClient, groupId: string) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.rebalancing.groups.topHoldings(groupId),
        });
      },
    },
  },

  // System invalidation helpers
  system: {
    environment: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.system.environment() });
    },
  },

  // Composite invalidation helpers for common operations
  composites: {
    // Invalidate only data that actually changes after Schwab sync
    afterSchwabSync: (queryClient: import('@tanstack/react-query').QueryClient) => {
      // Only invalidate what Schwab sync actually changes
      queryInvalidators.dashboard.positions(queryClient);
      queryInvalidators.dashboard.transactions(queryClient);
      queryInvalidators.dashboard.metrics(queryClient);
      queryInvalidators.onboarding.schwab(queryClient);
    },

    // Invalidate all data that changes after model operations
    afterModelOperation: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryInvalidators.models.all(queryClient);
      queryInvalidators.dashboard.all(queryClient);
      queryInvalidators.onboarding.models(queryClient);
    },

    // Invalidate all data that changes after security operations
    afterSecurityOperation: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryInvalidators.securities.all(queryClient);
      queryInvalidators.dashboard.all(queryClient);
      queryInvalidators.onboarding.securities(queryClient);
    },

    // Invalidate all onboarding-related data
    onboardingStatus: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryInvalidators.onboarding.all(queryClient);
      queryInvalidators.models.all(queryClient);
      queryInvalidators.securities.all(queryClient);
      queryInvalidators.schwab.credentials(queryClient);
      queryInvalidators.dashboard.groups(queryClient);
    },

    // Complete data refresh (use sparingly)
    completeRefresh: (queryClient: import('@tanstack/react-query').QueryClient) => {
      queryClient.invalidateQueries();
    },
  },
} as const;
