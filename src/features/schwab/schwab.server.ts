import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import * as schema from '~/db/schema';
import type { Trade } from '~/features/auth/schemas';
import type { SyncResult } from '~/features/schwab/schwab-sync.server';
import { isAnyCashTicker } from '~/lib/constants';
import { dbProxy } from '~/lib/db-config';
import { getErrorMessage } from '~/lib/error-handler';

// Defer server-only auth utilities to runtime to avoid bundling them in the client build
const requireAuth = async () => {
  const mod = await import('../auth/auth-utils');
  return mod.requireAuth();
};

// Server function to get Schwab OAuth URL
export const getSchwabOAuthUrlServerFn = createServerFn({ method: 'POST' })
  .validator((data: { redirectUri: string }) => data)
  .handler(async ({ data }) => {
    console.log('🚀 [ServerFn] getSchwabOAuthUrl started');
    console.log('📋 [ServerFn] Request data:', data);

    try {
      // Check for required Schwab environment variables
      const clientId = process.env.SCHWAB_CLIENT_ID;
      const clientSecret = process.env.SCHWAB_CLIENT_SECRET;

      if (!clientId) {
        console.error('❌ [ServerFn] SCHWAB_CLIENT_ID is not set in environment variables');
        throw new Error('SCHWAB_CLIENT_ID is not set in environment variables');
      }

      if (!clientSecret) {
        console.error('❌ [ServerFn] SCHWAB_CLIENT_SECRET is not set in environment variables');
        throw new Error('SCHWAB_CLIENT_SECRET is not set in environment variables');
      }

      console.log('📦 [ServerFn] Importing Schwab API service...');
      const { getSchwabApiService } = await import('~/features/schwab/schwab-api.server');
      const schwabApi = getSchwabApiService();

      console.log('🔗 [ServerFn] Getting OAuth URL...');
      const authUrl = await schwabApi.getOAuthUrl(data.redirectUri);

      console.log('✅ [ServerFn] Successfully generated OAuth URL');
      console.log('🔗 [ServerFn] OAuth URL length:', authUrl.length);

      return { authUrl };
    } catch (error) {
      console.error('❌ [ServerFn] Error getting Schwab OAuth URL:', error);
      console.error(
        '❌ [ServerFn] Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );
      throw new Error(`Failed to get OAuth URL: ${getErrorMessage(error)}`);
    }
  });

// Server function to handle Schwab OAuth callback
export const handleSchwabOAuthCallbackServerFn = createServerFn({
  method: 'POST',
})
  .validator((data: { code: string; redirectUri: string }) => data)

  .handler(async ({ data }) => {
    console.log('🔄 [ServerFn] handleSchwabOAuthCallback started');
    console.log('📋 [ServerFn] Request data:', {
      code: data.code ? `${data.code.substring(0, 10)}...` : 'NOT PROVIDED',
      redirectUri: data.redirectUri,
    });

    try {
      const { user } = await requireAuth();
  const _db = dbProxy;
      console.log(`👤 [ServerFn] Using authenticated user ID: ${user.id.substring(0, 10)}...`);

      // Check for required Schwab environment variables
      const clientId = process.env.SCHWAB_CLIENT_ID;
      const clientSecret = process.env.SCHWAB_CLIENT_SECRET;

      if (!clientId) {
        console.error('❌ [ServerFn] SCHWAB_CLIENT_ID is not set in environment variables');
        throw new Error('SCHWAB_CLIENT_ID is not set in environment variables');
      }

      if (!clientSecret) {
        console.error('❌ [ServerFn] SCHWAB_CLIENT_SECRET is not set in environment variables');
        throw new Error('SCHWAB_CLIENT_SECRET is not set in environment variables');
      }

      console.log('📦 [ServerFn] Importing Schwab API service...');
      const { getSchwabApiService } = await import('~/features/schwab/schwab-api.server');
      const schwabApi = getSchwabApiService();

      console.log('🔄 [ServerFn] Handling OAuth callback...');
      await schwabApi.handleOAuthCallback(data.code, data.redirectUri, user.id);

      console.log('✅ [ServerFn] OAuth callback handled successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ [ServerFn] Error handling Schwab OAuth callback:', error);
      console.error(
        '❌ [ServerFn] Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );
      throw new Error(`Failed to handle OAuth callback: ${getErrorMessage(error)}`);
    }
  });

// Server function to check Schwab credentials status
export const getSchwabCredentialsStatusServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  console.log('🔍 [ServerFn] getSchwabCredentialsStatus started');

  try {
    const { user } = await requireAuth();
  const _db = dbProxy;
    console.log(`👤 [ServerFn] Using authenticated user ID: ${user.id.substring(0, 10)}...`);

    // Check for required Schwab environment variables
    const clientId = process.env.SCHWAB_CLIENT_ID;
    const clientSecret = process.env.SCHWAB_CLIENT_SECRET;

    if (!clientId) {
      console.error('❌ [ServerFn] SCHWAB_CLIENT_ID is not set in environment variables');
      return { hasCredentials: false };
    }

    if (!clientSecret) {
      console.error('❌ [ServerFn] SCHWAB_CLIENT_SECRET is not set in environment variables');
      return { hasCredentials: false };
    }

    console.log('📦 [ServerFn] Importing Schwab API service...');
    const { getSchwabApiService } = await import('~/features/schwab/schwab-api.server');
    const schwabApi = getSchwabApiService();

    console.log('✅ [ServerFn] Checking credentials validity...');
    const hasCredentials = await schwabApi.hasValidCredentials(user.id);

    console.log('📊 [ServerFn] Credentials status:', hasCredentials);
    return { hasCredentials };
  } catch (error) {
    console.error(
      '❌ [ServerFn] Error stack:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return { hasCredentials: false };
  }
});

// Server function to sync Schwab accounts
export const syncSchwabAccountsServerFn = createServerFn({
  method: 'POST',
}).handler(async (): Promise<SyncResult> => {
  console.log('🏦 [ServerFn] Starting Schwab accounts sync');
  try {
    const { user } = await requireAuth();
  const _db = dbProxy;
    console.log('👤 [ServerFn] Using user ID:', user.id);

    const { getSchwabSyncService } = await import('~/features/schwab/schwab-sync.server');
    const syncService = getSchwabSyncService();
    console.log('🔧 [ServerFn] Schwab sync service initialized');

    const result = await syncService.syncAccounts(user.id);
    console.log('✅ [ServerFn] Accounts sync completed:', result);

    // Clear relevant caches after successful sync
    if (result.success && result.recordsProcessed > 0) {
      console.log('🧹 [ServerFn] Clearing caches after successful accounts sync');
      const { clearCache } = await import('~/lib/db-api');
      // Clear user-specific caches that might be affected
      clearCache(`positions-${user.id}`);
      clearCache(`transactions-${user.id}`);
      clearCache(`metrics-${user.id}`);
    }

    return result;
  } catch (error) {
    console.error('❌ [ServerFn] Error syncing Schwab accounts:', error);
    const errorResult = {
      success: false,
      recordsProcessed: 0,
      errorMessage: getErrorMessage(error),
    };
    console.log('🔄 [ServerFn] Returning error result:', errorResult);
    return errorResult;
  }
});

// Server function to sync Schwab holdings
export const syncSchwabHoldingsServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId?: string }) => data)

  .handler(async ({ data }): Promise<SyncResult> => {
    console.log('📊 [ServerFn] Starting Schwab holdings sync');
    console.log('📋 [ServerFn] Request data:', data);
    try {
      const { user } = await requireAuth();
  const _db = dbProxy;
      console.log('👤 [ServerFn] Using user ID:', user.id);

      const { getSchwabSyncService } = await import('~/features/schwab/schwab-sync.server');
      const syncService = getSchwabSyncService();
      console.log('🔧 [ServerFn] Schwab sync service initialized');

      const result = await syncService.syncHoldings(user.id, data.accountId);
      console.log('✅ [ServerFn] Holdings sync completed:', result);

      // Clear relevant caches after successful sync
      if (result.success && result.recordsProcessed > 0) {
        console.log('🧹 [ServerFn] Clearing caches after successful holdings sync');
        const { clearCache } = await import('~/lib/db-api');
        // Clear caches that depend on holdings data
        clearCache(`positions-${user.id}`);
        clearCache(`transactions-${user.id}`);
        clearCache(`metrics-${user.id}`);
        clearCache('sp500-data'); // Clear S&P 500 data cache since holdings may have new securities
      }

      return result;
    } catch (error) {
      console.error('❌ [ServerFn] Error syncing Schwab holdings:', error);
      const errorResult = {
        success: false,
        recordsProcessed: 0,
        errorMessage: getErrorMessage(error),
      };
      console.log('🔄 [ServerFn] Returning error result:', errorResult);
      return errorResult;
    }
  });

// Server function to sync Schwab transactions
export const syncSchwabTransactionsServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId?: string; startDate?: string; endDate?: string }) => data)

  .handler(async ({ data }): Promise<SyncResult> => {
    try {
      const { user } = await requireAuth();
  const _db = dbProxy;
      const { getSchwabSyncService } = await import('~/features/schwab/schwab-sync.server');
      const syncService = getSchwabSyncService();
      const startDate = data.startDate ? new Date(data.startDate) : undefined;
      const endDate = data.endDate ? new Date(data.endDate) : undefined;
      const result = await syncService.syncTransactions(user.id, {
        accountId: data.accountId,
        startDate,
        endDate,
      });

      // Clear relevant caches after successful sync
      if (result.success && result.recordsProcessed > 0) {
        console.log('🧹 [ServerFn] Clearing caches after successful transactions sync');
        const { clearCache } = await import('~/lib/db-api');
        // Clear caches that depend on transaction data
        clearCache(`transactions-${user.id}`);
        clearCache(`metrics-${user.id}`); // Transactions can affect metrics
      }

      return result;
    } catch (error) {
      return {
        success: false,
        recordsProcessed: 0,
        errorMessage: getErrorMessage(error),
      };
    }
  });

// Server function to get held position tickers
export const getHeldPositionTickersServerFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<string[]> => {
  console.log('🔍 [ServerFn] Timestamp:', new Date().toISOString());

  try {
    const { user } = await requireAuth();
  const _db = dbProxy;    console.log('🔍 [ServerFn] Authenticated user:', user.id);

    console.log('🔍 [ServerFn] Importing db-api to get positions...');
    const { getPositions } = await import('~/lib/db-api');

    console.log('🔍 [ServerFn] Calling getPositions for user:', user.id);
    const positions = await getPositions(user.id);
    console.log('🔍 [ServerFn] getPositions result:', {
      totalPositions: positions.length,
      positions: positions.map((p) => ({ ticker: p.ticker, qty: p.qty })),
      timestamp: new Date().toISOString(),
    });

    // Get unique tickers from positions
    const allTickers = positions
      .map((position) => position.ticker?.trim())
      .filter((ticker): ticker is string => Boolean(ticker) && !isAnyCashTicker(ticker));
    console.log('🔍 [ServerFn] All tickers from positions:', allTickers);

    const uniqueTickers = [...new Set(allTickers)];
    console.log('🔍 [ServerFn] Unique tickers after deduplication:', uniqueTickers);

    console.log('🔍 [ServerFn] Returning tickers:', {
      count: uniqueTickers.length,
      tickers: uniqueTickers,
      timestamp: new Date().toISOString(),
    });

    return uniqueTickers;
  } catch (error) {
    console.error('❌ [ServerFn] Error details:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
});

// Server function to get target securities (sleeve members) tickers
export const getSleeveTargetTickersServerFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<string[]> => {
  console.log('🎯 [ServerFn] Fetching sleeve target tickers');

  try {
    const { user } = await requireAuth();
  const _db = dbProxy;
    

    const sleeveRows = await dbProxy
      .select({ ticker: schema.sleeveMember.ticker })
      .from(schema.sleeveMember)
      .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
      .where(eq(schema.sleeve.userId, user.id));

    const tickers = sleeveRows
      .map((row) => row.ticker?.trim())
      .filter((ticker): ticker is string => Boolean(ticker) && !isAnyCashTicker(ticker));

    const uniqueTickers = [...new Set(tickers)];
    console.log('🎯 [ServerFn] Returning sleeve tickers:', {
      count: uniqueTickers.length,
      sample: uniqueTickers.slice(0, 10),
    });

    return uniqueTickers;
  } catch (error) {
    console.error('❌ [ServerFn] Failed to fetch sleeve target tickers:', error);
    throw error;
  }
});

// Server function to get combined held + sleeve security tickers
export const getHeldAndSleeveTickersServerFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<string[]> => {
  console.log('🤝 [ServerFn] Fetching held and sleeve tickers');

  try {
    const { user } = await requireAuth();
  const _db = dbProxy;
    const { getPositions } = await import('~/lib/db-api');
    const heldPositions = await getPositions(user.id);
    const heldTickers = heldPositions
      .map((position) => position.ticker?.trim())
      .filter((ticker): ticker is string => Boolean(ticker) && !isAnyCashTicker(ticker));

    
    const sleeveRows = await dbProxy
      .select({ ticker: schema.sleeveMember.ticker })
      .from(schema.sleeveMember)
      .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
      .where(eq(schema.sleeve.userId, user.id));

    const sleeveTickers = sleeveRows
      .map((row) => row.ticker?.trim())
      .filter((ticker): ticker is string => Boolean(ticker) && !isAnyCashTicker(ticker));

    const combined = new Set<string>([...heldTickers, ...sleeveTickers]);
    const combinedTickers = Array.from(combined);

    console.log('🤝 [ServerFn] Returning combined tickers:', {
      count: combinedTickers.length,
      sample: combinedTickers.slice(0, 10),
    });

    return combinedTickers;
  } catch (error) {
    console.error('❌ [ServerFn] Failed to fetch held and sleeve tickers:', error);
    throw error;
  }
});

// Server function to get securities that need price updates for a rebalancing group
export const getGroupSecuritiesNeedingPriceUpdatesServerFn = createServerFn({
  method: 'POST',
})
  .validator((data: { groupId: string }) => data)
  .handler(async ({ data }): Promise<string[]> => {
    console.log('🔄 [ServerFn] Getting securities needing price updates for group:', data.groupId);

    const { user } = await requireAuth();
  const _db = dbProxy;    const { groupId } = data;

    

    // First, verify the group belongs to the user
    const groupResult = await dbProxy
      .select()
      .from(schema.rebalancingGroup)
      .where(
        and(eq(schema.rebalancingGroup.id, groupId), eq(schema.rebalancingGroup.userId, user.id)),
      )
      .limit(1);

    if (groupResult.length === 0) {
      throw new Error('Rebalancing group not found or access denied');
    }

    // Get account IDs for this group
    const groupMembers = await dbProxy
      .select({ accountId: schema.rebalancingGroupMember.accountId })
      .from(schema.rebalancingGroupMember)
      .where(eq(schema.rebalancingGroupMember.groupId, groupId));

    const accountIds = groupMembers.map((member) => member.accountId);

    // Get securities held in group accounts
    const heldTickers = new Set<string>();
    if (accountIds.length > 0) {
      const holdings = await dbProxy
        .select({
          ticker: schema.holding.ticker,
        })
        .from(schema.holding)
        .where(inArray(schema.holding.accountId, accountIds));

      for (const holding of holdings) {
        if (holding.ticker && !isAnyCashTicker(holding.ticker)) {
          heldTickers.add(holding.ticker);
        }
      }
    }

    // Get securities in sleeves associated with the group's model
    const sleeveTickers = new Set<string>();
    const modelAssignments = await dbProxy
      .select({ modelId: schema.modelGroupAssignment.modelId })
      .from(schema.modelGroupAssignment)
      .where(eq(schema.modelGroupAssignment.rebalancingGroupId, groupId));

    if (modelAssignments.length > 0) {
      const modelId = modelAssignments[0].modelId;
      const sleeveMembers = await dbProxy
        .select({ ticker: schema.sleeveMember.ticker })
        .from(schema.sleeveMember)
        .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
        .innerJoin(schema.modelMember, eq(schema.sleeve.id, schema.modelMember.sleeveId))
        .where(eq(schema.modelMember.modelId, modelId));

      for (const member of sleeveMembers) {
        if (member.ticker && !isAnyCashTicker(member.ticker)) {
          sleeveTickers.add(member.ticker);
        }
      }
    }

    // Combine all unique tickers from holdings and sleeves
    const allTickers = new Set([...heldTickers, ...sleeveTickers]);

    if (allTickers.size === 0) {
      console.log('🔄 [ServerFn] No securities found for group');
      return [];
    }

    // Get securities that need price updates:
    // 1. Price is 1 (likely never properly priced)
    // 2. Last updated more than 1 hour ago
    const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour in milliseconds

    const securitiesNeedingUpdate = await dbProxy
      .select({
        ticker: schema.security.ticker,
        price: schema.security.price,
        updatedAt: schema.security.updatedAt,
      })
      .from(schema.security)
      .where(
        and(
          inArray(schema.security.ticker, Array.from(allTickers)),
          or(eq(schema.security.price, 1), lt(schema.security.updatedAt, oneHourAgo)),
        ),
      );

    const tickersNeedingUpdate = securitiesNeedingUpdate.map((s) => s.ticker);

    console.log('🔄 [ServerFn] Securities analysis for group:', {
      groupId,
      totalSecuritiesInGroup: allTickers.size,
      securitiesNeedingUpdate: tickersNeedingUpdate.length,
      tickersNeedingUpdate: tickersNeedingUpdate,
      allTickersInGroup: Array.from(allTickers),
    });

    // Log details about securities with price = 1
    if (securitiesNeedingUpdate.length > 0) {
      const priceOneSecurities = securitiesNeedingUpdate.filter((s) => s.price === 1);
      const oldSecurities = securitiesNeedingUpdate.filter((s) => s.price !== 1);
      console.log('🔄 [ServerFn] Breakdown of securities needing update:', {
        priceExactlyOne: priceOneSecurities.map((s) => ({ ticker: s.ticker, price: s.price })),
        olderThanOneHour: oldSecurities.map((s) => ({
          ticker: s.ticker,
          price: s.price,
          lastUpdated: s.updatedAt > 0 ? new Date(s.updatedAt).toISOString() : 'Never updated',
          ageMinutes:
            s.updatedAt > 0 ? Math.floor((Date.now() - s.updatedAt) / (1000 * 60)) : 'Unknown',
        })),
      });
    }

    return tickersNeedingUpdate;
  });

// Server function to sync prices for rebalancing group securities when user is connected to Schwab
export const syncGroupPricesIfNeededServerFn = createServerFn({
  method: 'POST',
})
  .validator((data: { groupId: string }) => data)
  .handler(
    async ({ data }): Promise<{ synced: boolean; message: string; updatedCount?: number }> => {
      console.log('🔄 [ServerFn] Checking if group prices need syncing:', data.groupId);

      const { user } = await requireAuth();
  const _db = dbProxy;      const { groupId } = data;

      // Check if user is connected to Schwab
      const { getSchwabApiService } = await import('~/features/schwab/schwab-api.server');
      const schwabApi = getSchwabApiService();

      let isConnectedToSchwab = false;
      try {
        isConnectedToSchwab = await schwabApi.hasValidCredentials(user.id);
      } catch (error) {
        console.log('🔄 [ServerFn] Schwab connection check failed:', error);
        isConnectedToSchwab = false;
      }

      if (!isConnectedToSchwab) {
        console.log('🔄 [ServerFn] User not connected to Schwab, skipping price sync');
        return { synced: false, message: 'User not connected to Schwab' };
      }

      // Get securities that need price updates
      const tickersNeedingUpdate = await getGroupSecuritiesNeedingPriceUpdatesServerFn({
        data: { groupId },
      });

      if (tickersNeedingUpdate.length === 0) {
        console.log('🔄 [ServerFn] No securities need price updates');
        return { synced: false, message: 'No securities need price updates' };
      }

      console.log('🔄 [ServerFn] Syncing prices for', tickersNeedingUpdate.length, 'securities');

      // Sync prices for these securities
      const results = await syncSchwabPricesServerFn({
        data: { symbols: tickersNeedingUpdate },
      });

      const updatedCount = results.recordsProcessed || 0;

      console.log('🔄 [ServerFn] Price sync completed:', {
        groupId,
        tickersNeedingUpdate: tickersNeedingUpdate.length,
        updatedCount,
        success: results.success,
      });

      return {
        synced: true,
        message: `Synced prices for ${updatedCount} securities`,
        updatedCount,
      };
    },
  );

// Server function to sync prices from Schwab
export const syncSchwabPricesServerFn = createServerFn({ method: 'POST' })
  .validator((data: { symbols?: string[] }) => data)

  .handler(
    async ({
      data,
      context: _context,
    }): Promise<
      SyncResult & {
        details?: Array<{
          ticker: string;
          oldPrice: number;
          newPrice: number;
          source: string;
          success: boolean;
          error?: string;
        }>;
        logId?: string;
      }
    > => {
      console.log('💰 [ServerFn] ===== STARTING SCHWAB PRICES SYNC =====');
      console.log('💰 [ServerFn] Timestamp:', new Date().toISOString());
      console.log('💰 [ServerFn] Request data:', {
        symbols: data.symbols,
        symbolsCount: data.symbols?.length || 'all',
        timestamp: new Date().toISOString(),
      });

      const { user } = await requireAuth();
  const _db = dbProxy;      console.log('👤 [ServerFn] Authenticated user:', user.id);

      try {
        

        const { getPriceSyncService } = await import('~/features/data-feeds/price-sync');
        const priceSyncService = getPriceSyncService();
        console.log('🔧 [ServerFn] Price sync service initialized');

        // Create sync log entry (RUNNING)
        const logId = crypto.randomUUID();
        const startLog = {
          id: logId,
          userId: user.id,
          syncType: 'SECURITIES',
          status: 'RUNNING' as const,
          recordsProcessed: 0,
          startedAt: new Date(),
          createdAt: new Date(),
        };
        await dbProxy.insert(schema.syncLog).values(startLog);
        console.log('📝 [ServerFn] Created sync log for prices:', logId);

        console.log('💰 [ServerFn] Calling priceSyncService.syncPrices with params:', {
          userId: user.id,
          symbols: data.symbols,
          symbolsCount: data.symbols?.length || 'all',
          forceRefresh: true,
          timestamp: new Date().toISOString(),
        });

        const results = await priceSyncService.syncPrices({
          userId: user.id,
          symbols: data.symbols,
          forceRefresh: true,
        });

        console.log('📊 [ServerFn] Price sync results received:', {
          totalResults: results.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          sampleResults: results.slice(0, 3).map((r) => ({
            ticker: r.ticker,
            success: r.success,
            oldPrice: r.oldPrice,
            newPrice: r.newPrice,
            source: r.source,
            error: r.error,
          })),
          timestamp: new Date().toISOString(),
        });

        // Clear caches that depend on security prices
        const successfulUpdates = results.filter((r) => r.success).length;
        if (successfulUpdates > 0) {
          console.log('🧹 [ServerFn] Clearing caches after successful price updates');
          const { clearCache } = await import('~/lib/db-api');
          // Clear caches that depend on price data
          clearCache('sp500-data'); // Clear S&P 500 data since prices have been updated
          clearCache(`positions-${user.id}`); // Clear positions cache since prices affect position values
          clearCache(`metrics-${user.id}`); // Clear metrics cache since prices affect portfolio metrics
        }

        // Persist per-ticker as generic change entries
        try {
          for (const r of results) {
            const changes = r.changes ?? {
              price: { old: r.oldPrice, new: r.newPrice },
              source: { old: undefined, new: r.source },
            };
            await dbProxy.insert(schema.syncLogDetail).values({
              id: crypto.randomUUID(),
              logId,
              entityType: 'SECURITY',
              entityId: r.ticker,
              operation: r.success ? 'UPDATE' : 'NOOP',
              changes: JSON.stringify(changes),
              success: r.success,
              message: r.error,
              createdAt: new Date(),
            });
          }
        } catch (persistErr) {
          console.warn('⚠️ [ServerFn] Failed to persist sync details:', persistErr);
        }

        // Log individual price updates for verification
        console.log('💲 [ServerFn] Individual price updates:');
        results.forEach((result, index) => {
          if (result.success) {
            console.log(
              `  ${index + 1}. ${result.ticker}: $${result.oldPrice} → $${result.newPrice} (${result.source})`,
            );
          } else {
            console.log(`  ${index + 1}. ${result.ticker}: FAILED - ${result.error}`);
          }
        });

        const successCount = results.filter((r) => r.success).length;
        const errorCount = results.length - successCount;
        console.log(
          '📈 [ServerFn] Price sync summary - Success:',
          successCount,
          'Errors:',
          errorCount,
        );

        // Complete sync log
        await dbProxy
          .update(schema.syncLog)
          .set({
            status: errorCount > 0 ? 'PARTIAL' : 'SUCCESS',
            recordsProcessed: successCount,
            errorMessage: errorCount > 0 ? `${errorCount} securities failed to update` : undefined,
            completedAt: new Date(),
          })
          .where(eq(schema.syncLog.id, logId));
        console.log('🏁 [ServerFn] Completed sync log for prices:', logId);

        const finalResult = {
          success: errorCount === 0,
          recordsProcessed: successCount,
          errorMessage: errorCount > 0 ? `${errorCount} securities failed to update` : undefined,
          details: results,
          logId,
        };
        console.log('✅ [ServerFn] Prices sync completed:', finalResult);
        return finalResult;
      } catch (error) {
        console.error('❌ [ServerFn] Error syncing prices:', error);
        // Attempt to log error in sync log if we started one
        try {
          
          await dbProxy.insert(schema.syncLog).values({
            id: crypto.randomUUID(),
            userId: user.id,
            syncType: 'SECURITIES',
            status: 'ERROR',
            recordsProcessed: 0,
            errorMessage: error instanceof Error ? error.message : String(error),
            startedAt: new Date(),
            completedAt: new Date(),
            createdAt: new Date(),
          });
        } catch (logErr) {
          console.warn('⚠️ [ServerFn] Failed to write error sync log:', logErr);
        }

        const errorResult = {
          success: false,
          recordsProcessed: 0,
          errorMessage: getErrorMessage(error),
        };
        console.log('🔄 [ServerFn] Returning error result:', errorResult);
        return errorResult;
      }
    },
  );

// Server function to revoke Schwab credentials
export const revokeSchwabCredentialsServerFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  console.log('🗑️ [ServerFn] Starting Schwab credentials revocation');
  try {
    const { user } = await requireAuth();
  const _db = dbProxy;
    console.log('👤 [ServerFn] Using user ID:', user.id);

    // Check for required Schwab environment variables
    const clientId = process.env.SCHWAB_CLIENT_ID;
    const clientSecret = process.env.SCHWAB_CLIENT_SECRET;

    if (!clientId) {
      console.error('❌ [ServerFn] SCHWAB_CLIENT_ID is not set in environment variables');
      throw new Error('SCHWAB_CLIENT_ID is not set in environment variables');
    }

    if (!clientSecret) {
      console.error('❌ [ServerFn] SCHWAB_CLIENT_SECRET is not set in environment variables');
      throw new Error('SCHWAB_CLIENT_SECRET is not set in environment variables');
    }

    const { getSchwabApiService } = await import('~/features/schwab/schwab-api.server');
    const schwabApi = getSchwabApiService();
    console.log('🔧 [ServerFn] Schwab API service initialized');

    await schwabApi.revokeCredentials(user.id);
    console.log('✅ [ServerFn] Credentials revoked successfully');

    return { success: true };
  } catch (error) {
    console.error('❌ [ServerFn] Error revoking Schwab credentials:', error);
    throw new Error(`Failed to revoke credentials: ${getErrorMessage(error)}`);
  }
});

// Server function to delete a sync log
export const deleteSyncLogServerFn = createServerFn({ method: 'POST' })
  .validator((data: { logId: string }) => data)
  .handler(async ({ data }) => {
    const { logId } = data;
    try {
      const { user } = await requireAuth();
  const _db = dbProxy;
      

      // First verify the log belongs to the user
      const log = await dbProxy
        .select()
        .from(schema.syncLog)
        .where(eq(schema.syncLog.id, logId))
        .limit(1);

      if (!log || log.length === 0) {
        throw new Error('Sync log not found');
      }

      if (log[0].userId !== user.id) {
        throw new Error('Unauthorized to delete this sync log');
      }

      // Delete the log (syncLogDetail will be deleted automatically due to CASCADE)
      await dbProxy.delete(schema.syncLog).where(eq(schema.syncLog.id, logId));

      console.log('🗑️ [ServerFn] Deleted sync log:', logId);
      return { success: true, logId };
    } catch (error) {
      console.error('Error deleting sync log:', error);
      throw new Error(`Failed to delete sync log: ${getErrorMessage(error)}`);
    }
  });

// Server function to get sync logs
export const getSyncLogsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { user } = await requireAuth();
  const _db = dbProxy;
    

    const logs = await dbProxy
      .select()
      .from(schema.syncLog)
      .where(eq(schema.syncLog.userId, user.id))
      .orderBy(desc(schema.syncLog.createdAt))
      .limit(50);

    // Attach details for all logs (accounts, holdings, prices, etc.)
    const logsWithDetails = await Promise.all(
      logs.map(async (log) => {
        try {
          const details = await dbProxy
            .select()
            .from(schema.syncLogDetail)
            .where(eq(schema.syncLogDetail.logId, log.id))
            .orderBy(desc(schema.syncLogDetail.createdAt));
          return { ...log, details };
        } catch {
          return log;
        }
      }),
    );

    return logsWithDetails;
  } catch (error) {
    console.error('Error getting sync logs:', error);
    throw new Error(`Failed to get sync logs: ${getErrorMessage(error)}`);
  }
});

// Orders / Blotter server functions
export const addGroupTradesToBlotterServerFn = createServerFn({
  method: 'POST',
})
  .validator(
    (data: {
      groupId: string;
      trades: Array<{
        ticker: string;
        type: 'BUY' | 'SELL';
        qty: number;
        currentPrice?: number;
        accountId?: string;
      }>;
      batchLabel?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { groupId, trades, batchLabel } = data;
    if (!groupId || !Array.isArray(trades)) {
      throw new Error('Invalid request: groupId and trades required');
    }

    const { user } = await requireAuth();
  const _db = dbProxy;
    // Normalize trades into existing Trade type used by db-api
    const normalizedTrades = trades.map((t) => ({
      id: crypto.randomUUID(),
      type: t.type,
      ticker: t.ticker,
      sleeveId: '',
      sleeveName: '',
      qty: Math.abs(t.qty),
      currentPrice: t.currentPrice ?? 0,
      estimatedValue: (t.currentPrice ?? 0) * Math.abs(t.qty),
      reason: 'Added to blotter',
      realizedGainLoss: 0,
      canExecute: true,
      accountId: t.accountId ?? '',
      accountName: '',
      accountType: '',
      accountNumber: '',
    }));

    const { addDraftOrdersFromProposedTrades } = await import('../../lib/db-api');
    const result = await addDraftOrdersFromProposedTrades({
      userId: user.id,
      groupId,
      trades: normalizedTrades as Trade[],
      batchLabel,
    });
    return result;
  });

export const getGroupOrdersServerFn = createServerFn({ method: 'POST' })
  .validator((data: { groupId: string }) => data)
  .handler(async ({ data }) => {
    const { groupId } = data;
    if (!groupId) throw new Error('groupId required');

    const { user } = await requireAuth();
  const _db = dbProxy;
    
    const schema = await import('~/db/schema');
    const { eq } = await import('drizzle-orm');

    // Verify that the rebalancing group belongs to the authenticated user
    const group = await dbProxy
      .select({ userId: schema.rebalancingGroup.userId })
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.id, groupId))
      .limit(1);

    if (group.length === 0 || group[0].userId !== user.id) {
      throw new Error('Access denied: Rebalancing group not found or does not belong to you');
    }
    // Find group members (accounts)
    const members = await dbProxy
      .select({ accountId: schema.rebalancingGroupMember.accountId })
      .from(schema.rebalancingGroupMember)
      .where(eq(schema.rebalancingGroupMember.groupId, groupId));
    const accountIds = members.map((m) => m.accountId);
    const { getOrdersForAccounts } = await import('../../lib/db-api');
    const orders = await getOrdersForAccounts(accountIds);
    return orders;
  });

export const updateOrderServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      id: string;
      updates: Partial<{
        symbol: string;
        side: 'BUY' | 'SELL';
        qty: number;
        type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
        limit: number | null;
        stop: number | null;
        tif: 'DAY' | 'GTC';
        session: 'NORMAL' | 'AM' | 'PM' | 'ALL';
      }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id, updates } = data;
    if (!id) throw new Error('id required');

    const { user } = await requireAuth();
  const _db = dbProxy;
    // Verify that the order belongs to the authenticated user
    
    const schema = await import('~/db/schema');
    const { eq } = await import('drizzle-orm');

    const order = await dbProxy
      .select({
        userId: schema.account.userId,
      })
      .from(schema.tradeOrder)
      .innerJoin(schema.account, eq(schema.tradeOrder.accountId, schema.account.id))
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);

    if (order.length === 0 || order[0].userId !== user.id) {
      throw new Error('Access denied: Order not found or does not belong to you');
    }

    const { updateTradeOrder } = await import('../../lib/db-api');
    await updateTradeOrder(id, updates);
    return { success: true };
  });

export const deleteOrderServerFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { id } = data;
    if (!id) throw new Error('id required');

    const { user } = await requireAuth();
  const _db = dbProxy;
    // Verify that the order belongs to the authenticated user
    
    const schema = await import('~/db/schema');
    const { eq } = await import('drizzle-orm');

    const order = await dbProxy
      .select({
        userId: schema.account.userId,
      })
      .from(schema.tradeOrder)
      .innerJoin(schema.account, eq(schema.tradeOrder.accountId, schema.account.id))
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);

    if (order.length === 0 || order[0].userId !== user.id) {
      throw new Error('Access denied: Order not found or does not belong to you');
    }

    const { deleteTradeOrder } = await import('../../lib/db-api');
    await deleteTradeOrder(id);
    return { success: true };
  });

// Preview an order with Schwab and persist preview results to the draft order
export const previewOrderServerFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { id } = data;
    if (!id) throw new Error('id required');

    const { user } = await requireAuth();
  const _db = dbProxy;
    
    const schema = await import('~/db/schema');
    const { eq } = await import('drizzle-orm');

    // Verify that the order belongs to the authenticated user
    const order = await dbProxy
      .select({
        userId: schema.account.userId,
      })
      .from(schema.tradeOrder)
      .innerJoin(schema.account, eq(schema.tradeOrder.accountId, schema.account.id))
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);

    if (order.length === 0 || order[0].userId !== user.id) {
      throw new Error('Access denied: Order not found or does not belong to you');
    }

    const { getSchwabApiService } = await import('~/features/schwab/schwab-api.server');
    const schwab = getSchwabApiService();

    // Load order and account
    const rows = await dbProxy
      .select()
      .from(schema.tradeOrder)
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);
    if (rows.length === 0) throw new Error('Order not found');
    const o = rows[0] as typeof schema.tradeOrder.$inferSelect;

    // Map to Schwab preview payload (align with Schwab schema)
    const payload = {
      session: o.session,
      duration: o.tif,
      orderType: o.type,
      price: o.type === 'LIMIT' ? Number(o.limit) : undefined,
      stopPrice: o.type === 'STOP' || o.type === 'STOP_LIMIT' ? Number(o.stop) : undefined,
      taxLotMethod: o.taxLotMethod ?? undefined,
      orderStrategyType: o.orderStrategyType ?? 'SINGLE',
      orderLegCollection: [
        {
          instruction: o.side,
          quantity: Number(o.qty),
          instrument: { symbol: o.symbol, assetType: 'EQUITY' },
        },
      ],
    } as Record<string, unknown>;

    // Resolve Schwab account identifier from our internal account
    const acctRow = await dbProxy
      .select({
        schwabAccountId: schema.account.schwabAccountId,
        accountNumber: schema.account.accountNumber,
      })
      .from(schema.account)
      .where(eq(schema.account.id, o.accountId))
      .limit(1);
    if (!acctRow.length) {
      throw new Error('Account not found for order');
    }
    // For Orders API, Schwab expects the hashed account id (accountId/displayAcctId).
    // Fall back to accountNumber if hash is unavailable (e.g., demo or during migration).
    // Prefer accountNumber for Orders API; fall back to Schwab hashed id
    const accountIdentifier = acctRow[0].accountNumber || acctRow[0].schwabAccountId || '';
    if (!accountIdentifier) {
      throw new Error('Schwab account identifier not available. Link account before preview.');
    }

    let resp: unknown;
    try {
      resp = await schwab.previewOrder(user.id, accountIdentifier, payload);
    } catch (e) {
      const errMsg = String(e instanceof Error ? e.message : e);
      // Retry with alternate identifier if available (switch between acct# and hash)
      const altIdentifier =
        accountIdentifier === acctRow[0].accountNumber
          ? acctRow[0].schwabAccountId
          : acctRow[0].accountNumber;
      if ((/404/.test(errMsg) || /Invalid account number/i.test(errMsg)) && altIdentifier) {
        console.warn(
          '⚠️ [PreviewOrder] Preview failed with',
          accountIdentifier,
          '— retrying with',
          altIdentifier,
        );
        try {
          resp = await schwab.previewOrder(user.id, altIdentifier, payload);
        } catch (e2) {
          // Persist preview error and rethrow
          await dbProxy
            .update(schema.tradeOrder)
            .set({
              status: 'PREVIEW_ERROR',
              previewWarnCount: 0,
              previewErrorCount: 1,
              previewFirstMessage: String(e2 instanceof Error ? e2.message : e2).slice(0, 500),
              previewJson: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.tradeOrder.id, id));
          throw e2;
        }
      } else {
        // Persist preview error and rethrow
        await dbProxy
          .update(schema.tradeOrder)
          .set({
            status: 'PREVIEW_ERROR',
            previewWarnCount: 0,
            previewErrorCount: 1,
            previewFirstMessage: errMsg.slice(0, 500),
            previewJson: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.tradeOrder.id, id));
        throw e;
      }
    }
    // Extract values
    const respObj = resp as Record<string, unknown>;
    const orderBalance =
      ((respObj?.orderStrategy as Record<string, unknown>)?.orderBalance as Record<
        string,
        unknown
      >) ?? {};
    const warns =
      ((respObj?.orderValidationResult as Record<string, unknown>)?.warns as unknown[]) ?? [];
    const rejects =
      ((respObj?.orderValidationResult as Record<string, unknown>)?.rejects as unknown[]) ?? [];

    // Persist preview details
    await dbProxy
      .update(schema.tradeOrder)
      .set({
        previewJson: JSON.stringify(resp),
        previewOrderValue: ((orderBalance as Record<string, unknown>).orderValue as number) ?? null,
        previewProjectedCommission:
          ((orderBalance as Record<string, unknown>).projectedCommission as number) ?? null,
        previewWarnCount: warns.length,
        previewErrorCount: rejects.length,
        previewFirstMessage: ((rejects[0] as Record<string, unknown>)?.message ??
          (warns[0] as Record<string, unknown>)?.message ??
          null) as string | null,
        status:
          rejects.length > 0 ? 'PREVIEW_ERROR' : warns.length > 0 ? 'PREVIEW_WARN' : 'PREVIEW_OK',
        updatedAt: new Date(),
      })
      .where(eq(schema.tradeOrder.id, id));

    // Best-effort: if preview payload contains a mark price, persist it to security table
    const tryFindMarkPrice = (obj: unknown, depth = 0): number | null => {
      if (!obj || typeof obj !== 'object' || depth > 6) return null;
      const o = obj as Record<string, unknown>;
      for (const [k, v] of Object.entries(o)) {
        const key = k.toLowerCase();
        if (
          (key === 'mark' || key === 'markprice' || key === 'mark_price') &&
          typeof v === 'number' &&
          Number.isFinite(v) &&
          v > 0
        ) {
          return v;
        }
        if (v && typeof v === 'object') {
          const nested = tryFindMarkPrice(v, depth + 1);
          if (nested && nested > 0) return nested;
        }
      }
      return null;
    };

    const tryFindLastPrice = (obj: unknown, depth = 0): number | null => {
      if (!obj || typeof obj !== 'object' || depth > 6) return null;
      const o = obj as Record<string, unknown>;
      for (const [k, v] of Object.entries(o)) {
        const key = k.toLowerCase();
        if (
          (key === 'lastprice' ||
            key === 'last' ||
            key === 'last_price' ||
            key === 'lasttradeprice') &&
          typeof v === 'number' &&
          Number.isFinite(v) &&
          v > 0
        ) {
          return v;
        }
        if (v && typeof v === 'object') {
          const nested = tryFindLastPrice(v, depth + 1);
          if (nested && nested > 0) return nested;
        }
      }
      return null;
    };

    const lastPrice = tryFindLastPrice(respObj);
    let markPrice = tryFindMarkPrice(respObj);
    // Fallback: derive price from orderValue/qty when available
    if (
      (!markPrice || !(markPrice > 0)) &&
      (!lastPrice || !(lastPrice > 0)) &&
      typeof o.qty === 'number' &&
      o.qty > 0
    ) {
      const ov = (orderBalance as Record<string, unknown>).orderValue as number | undefined;
      const derived = typeof ov === 'number' && Number.isFinite(ov) && ov > 0 ? ov / o.qty : null;
      if (derived && derived > 0) markPrice = derived;
    }
    // Choose price per rules:
    // - For MARKET orders: prefer markPrice, then lastPrice, then derived
    // - For non-MARKET: only use lastPrice (accurate last traded)
    let chosenPrice: number | null = null;
    if (o.type === 'MARKET') {
      chosenPrice =
        markPrice && markPrice > 0
          ? markPrice
          : lastPrice && lastPrice > 0
            ? lastPrice
            : markPrice && markPrice > 0 // keep as-is
              ? markPrice
              : (markPrice ?? null);
      // If neither explicit mark nor last, allow derived fallback
      if ((!chosenPrice || !(chosenPrice > 0)) && markPrice && markPrice > 0) {
        chosenPrice = markPrice;
      }
      if ((!chosenPrice || !(chosenPrice > 0)) && typeof o.qty === 'number' && o.qty > 0) {
        const ov = (orderBalance as Record<string, unknown>).orderValue as number | undefined;
        const derived = typeof ov === 'number' && Number.isFinite(ov) && ov > 0 ? ov / o.qty : null;
        if (derived && derived > 0) chosenPrice = derived;
      }
    } else {
      chosenPrice = lastPrice && lastPrice > 0 ? lastPrice : null;
    }

    if (chosenPrice && chosenPrice > 0) {
      try {
        await dbProxy
          .update(schema.security)
          .set({ price: chosenPrice, updatedAt: Date.now() })
          .where(eq(schema.security.ticker, o.symbol));
      } catch (e) {
        console.warn('⚠️ Failed to persist mark price for', o.symbol, e);
      }
    }

    return { success: true };
  });

// Submit an order to Schwab after a successful preview
export const submitOrderServerFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { id } = data;
    if (!id) throw new Error('id required');

    const { user } = await requireAuth();
  const _db = dbProxy;
    
    const schema = await import('~/db/schema');
    const { eq } = await import('drizzle-orm');

    // Verify order belongs to user and load
    const rows = await dbProxy
      .select({
        orderUserId: schema.account.userId,
        all: schema.tradeOrder,
      })
      .from(schema.tradeOrder)
      .innerJoin(schema.account, eq(schema.tradeOrder.accountId, schema.account.id))
      .where(eq(schema.tradeOrder.id, id))
      .limit(1);
    if (!rows.length || rows[0].orderUserId !== user.id) {
      throw new Error('Access denied: Order not found or does not belong to you');
    }
    const o = rows[0].all as typeof schema.tradeOrder.$inferSelect;

    // Require a preview step without errors before submit
    if (o.status !== 'PREVIEW_OK' && o.status !== 'PREVIEW_WARN') {
      throw new Error('Order must be previewed successfully (OK or WARN) before submission');
    }

    // Map to Schwab order payload
    const payload = {
      session: o.session,
      duration: o.tif,
      orderType: o.type,
      price: o.type === 'LIMIT' ? Number(o.limit) : undefined,
      stopPrice: o.type === 'STOP' || o.type === 'STOP_LIMIT' ? Number(o.stop) : undefined,
      taxLotMethod: o.taxLotMethod ?? undefined,
      orderStrategyType: o.orderStrategyType ?? 'SINGLE',
      orderLegCollection: [
        {
          instruction: o.side,
          quantity: Number(o.qty),
          instrument: { symbol: o.symbol, assetType: 'EQUITY' },
        },
      ],
    } as Record<string, unknown>;

    // Resolve Schwab account identifier
    const acctRow = await dbProxy
      .select({
        schwabAccountId: schema.account.schwabAccountId,
        accountNumber: schema.account.accountNumber,
      })
      .from(schema.account)
      .where(eq(schema.account.id, o.accountId))
      .limit(1);
    if (!acctRow.length) throw new Error('Account not found for order');
    const accountIdentifier = acctRow[0].accountNumber || acctRow[0].schwabAccountId || '';
    if (!accountIdentifier) {
      throw new Error('Schwab account identifier not available. Link account before submit.');
    }

    const { getSchwabApiService } = await import('~/features/schwab/schwab-api.server');
    const schwab = getSchwabApiService();

    let resp: unknown;
    try {
      resp = await schwab.placeOrder(user.id, accountIdentifier, payload);
    } catch (e) {
      // Persist failure snapshot and rethrow
      await dbProxy
        .update(schema.tradeOrder)
        .set({
          status: 'REJECTED',
          statusDescription: String(e instanceof Error ? e.message : e).slice(0, 500),
          lastSnapshot: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.tradeOrder.id, id));
      throw e;
    }

    const respObj = (resp || {}) as Record<string, unknown>;
    const getPath = (o: Record<string, unknown>, path: string[]): unknown => {
      let cur: unknown = o;
      for (const p of path) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[p];
      }
      return cur;
    };
    const schwabOrderId: string | null =
      (respObj.orderId as string | undefined) ||
      (Array.isArray(respObj.orders) && respObj.orders[0]
        ? ((respObj.orders[0] as Record<string, unknown>).orderId as string | undefined)
        : undefined) ||
      (getPath(respObj, ['orderStrategy', 'orderId']) as string | undefined) ||
      null;
    const rawStatus = String(
      (respObj.status as string | undefined) ||
        (respObj.orderStatus as string | undefined) ||
        (getPath(respObj, ['orderStrategy', 'status']) as string | undefined) ||
        'ACCEPTED',
    ).toUpperCase();
    const allowed = new Set([
      'ACCEPTED',
      'WORKING',
      'PARTIALLY_FILLED',
      'REPLACED',
      'FILLED',
      'CANCELED',
      'REJECTED',
      'EXPIRED',
    ]);
    const status = allowed.has(rawStatus) ? rawStatus : 'ACCEPTED';

    await dbProxy
      .update(schema.tradeOrder)
      .set({
        schwabOrderId: schwabOrderId ?? undefined,
        status,
        statusDescription:
          typeof (respObj as { statusDescription?: unknown }).statusDescription === 'string'
            ? (respObj as { statusDescription?: string }).statusDescription
            : null,
        cancelable: true,
        editable: false,
        placedAt: new Date(),
        updatedAt: new Date(),
        lastSnapshot: (() => {
          try {
            return JSON.stringify(respObj);
          } catch {
            return null;
          }
        })(),
      })
      .where(eq(schema.tradeOrder.id, id));

    return { success: true, schwabOrderId };
  });
