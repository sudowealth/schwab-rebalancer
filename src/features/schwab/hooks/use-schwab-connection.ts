import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SyncYahooFundamentalsResult } from '~/features/data-feeds/yahoo.server';
import { queryInvalidators, queryKeys } from '~/lib/query-keys';
import {
  getHeldPositionTickersServerFn,
  getSchwabCredentialsStatusServerFn,
  getSchwabOAuthUrlServerFn,
  syncSchwabAccountsServerFn,
  syncSchwabHoldingsServerFn,
  syncSchwabPricesServerFn,
  syncYahooFundamentalsServerFn,
} from '~/lib/server-functions';

// Global coordinator to ensure only one hook instance handles sync triggering
const globalSyncCoordinator = {
  hasActiveSyncTrigger: false,
  instanceCount: 0,
};

export function useSchwabConnection(
  initialCredentialsStatus?: { hasCredentials: boolean },
  initialActiveCredentialsStatus?: { hasCredentials: boolean },
  enableSyncTriggering: boolean = true,
) {
  const instanceId = useRef(++globalSyncCoordinator.instanceCount);
  const isPrimarySyncTrigger = useRef(false);

  // Determine if this instance should handle sync triggering
  useEffect(() => {
    if (enableSyncTriggering && !globalSyncCoordinator.hasActiveSyncTrigger) {
      globalSyncCoordinator.hasActiveSyncTrigger = true;
      isPrimarySyncTrigger.current = true;
      console.log(
        `🔧 [useSchwabConnection] Instance ${instanceId.current} is now the primary sync trigger`,
      );
    } else if (enableSyncTriggering) {
      console.log(
        `🔧 [useSchwabConnection] Instance ${instanceId.current} has sync triggering enabled but another instance is primary`,
      );
    } else {
      console.log(
        `🔧 [useSchwabConnection] Instance ${instanceId.current} sync triggering disabled`,
      );
    }

    // Cleanup on unmount
    return () => {
      if (isPrimarySyncTrigger.current) {
        globalSyncCoordinator.hasActiveSyncTrigger = false;
        console.log(
          `🔧 [useSchwabConnection] Instance ${instanceId.current} released primary sync trigger`,
        );
      }
    };
  }, [enableSyncTriggering]);

  // Only the primary instance should actually trigger sync
  const shouldTriggerSync = enableSyncTriggering && isPrimarySyncTrigger.current;
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState<string>('');
  const queryClient = useQueryClient();
  const router = useRouter();

  // Query to check credentials status (environment variables)
  const { data: credentialsStatus, isLoading: statusLoading } = useQuery({
    queryKey: queryKeys.integrations.schwab.credentials(),
    queryFn: () => getSchwabCredentialsStatusServerFn(),
    initialData: initialCredentialsStatus,
    staleTime: 1000 * 60 * 5, // 5 minutes - environment vars don't change often
    refetchOnMount: false, // Don't refetch immediately if we have initial data
  });

  // Mutation to start OAuth flow
  const oauthMutation = useMutation({
    mutationFn: async (redirectUri: string) => {
      return await getSchwabOAuthUrlServerFn({
        data: { redirectUri },
      });
    },
    onSuccess: (data: { authUrl?: string }) => {
      if (data.authUrl && typeof window !== 'undefined') {
        window.location.href = data.authUrl;
      }
    },
    onError: (error) => {
      console.error('Failed to get OAuth URL:', error);
      setIsConnecting(false);
    },
  });

  // Mutations for sync operations
  const syncAccountsMutation = useMutation({
    mutationFn: async () => {
      return await syncSchwabAccountsServerFn();
    },
  });

  const syncHoldingsMutation = useMutation({
    mutationFn: async (accountId?: string) => {
      console.log(
        '📊 [UI] Starting Schwab holdings sync for account:',
        accountId || 'all accounts',
      );
      return await syncSchwabHoldingsServerFn({
        data: { accountId },
      });
    },
  });

  const syncPricesMutation = useMutation({
    mutationFn: async (symbols?: string[]) => {
      return await syncSchwabPricesServerFn({
        data: { symbols },
      });
    },
  });

  // Function to run full Schwab sync sequentially
  const runFullSync = useCallback(async () => {
    setIsSyncing(true);

    try {
      // 1) Sync accounts
      setSyncStep('Syncing accounts...');
      const accountsResult = await syncAccountsMutation.mutateAsync();

      if (!accountsResult?.success) {
        throw new Error(accountsResult?.errorMessage || 'Accounts sync failed');
      }

      // 2) Sync holdings
      setSyncStep('Syncing holdings...');
      console.log('📊 [UI] Step 2: Starting holdings sync...');
      console.log('📊 [UI] Current time:', new Date().toISOString());
      const holdingsResult = await syncHoldingsMutation.mutateAsync(undefined);
      console.log('📊 [UI] Holdings sync result:', {
        success: holdingsResult?.success,
        recordsProcessed: holdingsResult?.recordsProcessed,
        errorMessage: holdingsResult?.errorMessage,
        timestamp: new Date().toISOString(),
      });

      if (!holdingsResult?.success) {
        console.error('❌ [UI] Holdings sync failed with error:', holdingsResult?.errorMessage);
        throw new Error(holdingsResult?.errorMessage || 'Holdings sync failed');
      }
      console.log('✅ [UI] Holdings sync completed successfully');

      // 3) Get held tickers and sync prices
      setSyncStep('Syncing prices...');
      console.log('💰 [UI] Step 3: Getting held position tickers...');
      console.log('💰 [UI] Current time:', new Date().toISOString());
      const heldTickers = await getHeldPositionTickersServerFn();
      console.log('💰 [UI] Held position tickers result:', {
        count: heldTickers.length,
        tickers: heldTickers,
        timestamp: new Date().toISOString(),
      });

      if (heldTickers.length > 0) {
        console.log('💰 [UI] Starting price sync for held securities...');
        const pricesResult = await syncPricesMutation.mutateAsync(heldTickers);
        console.log('💰 [UI] Prices sync result:', {
          success: pricesResult?.success,
          recordsProcessed: pricesResult?.recordsProcessed,
          errorMessage: pricesResult?.errorMessage,
          details: pricesResult?.details?.slice(0, 5), // First 5 results
          timestamp: new Date().toISOString(),
        });
        console.log('✅ [UI] Prices sync completed');
      } else {
        console.warn('⚠️ [UI] No held securities found - skipping price sync');
      }

      // 4) Optional: Sync Yahoo fundamentals
      try {
        console.log('🟡 [UI] Step 4: Starting Yahoo fundamentals sync...');
        console.log('🟡 [UI] Current time:', new Date().toISOString());
        const yahooResult = (await syncYahooFundamentalsServerFn({
          data: { scope: 'missing-fundamentals-holdings' },
        })) as SyncYahooFundamentalsResult;
        console.log('🟡 [UI] Yahoo fundamentals sync result:', {
          success: yahooResult.success,
          recordsProcessed: yahooResult.recordsProcessed,
          errorMessage: yahooResult.errorMessage,
          detailsPreview: yahooResult.details.slice(0, 5),
          timestamp: new Date().toISOString(),
        });
      } catch (yErr) {
        console.warn('⚠️ [UI] Yahoo fundamentals sync had an issue:', {
          error: yErr,
          timestamp: new Date().toISOString(),
        });
      }

      // Success - refresh all data
      console.log('✅ [UI] ===== FULL SCHWAB SYNC COMPLETED SUCCESSFULLY =====');
      console.log('✅ [UI] Final timestamp:', new Date().toISOString());
      setSyncStep('Sync complete!');

      // Refresh targeted data after Schwab sync using centralized invalidators
      console.log('🔄 [UI] Invalidating targeted queries to refresh data...');
      queryInvalidators.composites.afterSchwabSync(queryClient);

      // Invalidate the home route loader to refresh onboarding status
      router.invalidate();

      // Clear sync state after a brief delay to show success
      setTimeout(() => {
        console.log('🧹 [UI] Clearing sync state');
        setIsSyncing(false);
        setSyncStep('');
      }, 2000);
    } catch (error) {
      console.error('❌ [UI] ===== FULL SCHWAB SYNC FAILED =====');
      console.error('❌ [UI] Error details:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      setSyncStep('Sync failed. Please try again from Data Feeds.');
      setTimeout(() => {
        console.log('🧹 [UI] Clearing sync state after error');
        setIsSyncing(false);
        setSyncStep('');
      }, 3000);
    }
  }, [queryClient, router, syncAccountsMutation, syncHoldingsMutation, syncPricesMutation]);

  const handleConnect = async () => {
    if (typeof window === 'undefined') return;

    setIsConnecting(true);

    // Store return URL for conditional redirect after OAuth
    sessionStorage.setItem('schwabReturnUrl', window.location.pathname);

    // Ensure HTTPS for Schwab OAuth (required by Schwab)
    let redirectUri = `${window.location.origin}/schwab/callback`;
    if (window.location.hostname === 'localhost' && !redirectUri.startsWith('https:')) {
      redirectUri = redirectUri.replace('http:', 'https:');
    }

    oauthMutation.mutate(redirectUri);
  };

  // Query to check if user has active Schwab credentials (actual OAuth connection)
  const { data: activeCredentialsStatus, isLoading: activeCredentialsLoading } = useQuery({
    queryKey: queryKeys.integrations.schwab.activeCredentials(),
    queryFn: async () => {
      try {
        const result = await getSchwabCredentialsStatusServerFn();
        console.log('🔍 Schwab active credentials check:', result);
        return result;
      } catch (error) {
        console.log('🔍 Schwab active credentials check failed:', error);
        return { hasCredentials: false };
      }
    },
    initialData: initialActiveCredentialsStatus,
    enabled: !!credentialsStatus?.hasCredentials, // Only run if env vars are set
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnMount: false, // Don't refetch immediately on mount to avoid triggering sync
  });

  const isConnected = activeCredentialsStatus?.hasCredentials || false;

  // State for tracking initial sync after connection
  // Trigger sync after successful OAuth connection
  // Only trigger if we have credentials, haven't run sync in last 12 hours, not currently syncing,
  // and we're not coming from a fresh OAuth callback (which already triggered sync)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const justConnected = urlParams.has('schwabConnected');

      // Don't trigger sync if we just completed OAuth - the callback route already did it
      // Also check sessionStorage to see if we just completed OAuth
      const returnUrl = sessionStorage.getItem('schwabReturnUrl');

      // Check if we need to sync (either never synced or 12 hours have passed)
      const shouldSync = (() => {
        const syncData = localStorage.getItem('schwab-initial-sync-completed');
        if (!syncData) {
          console.log('🔄 [UI] No sync data found in localStorage, sync needed');
          return true; // Never synced
        }

        try {
          const { timestamp } = JSON.parse(syncData);
          const twelveHoursMs = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
          const now = Date.now();
          const timeSinceLastSync = now - timestamp;
          const needsSync = timeSinceLastSync > twelveHoursMs;

          console.log('🔄 [UI] Sync check:', {
            lastSyncTimestamp: new Date(timestamp).toISOString(),
            timeSinceLastSync: `${Math.round(timeSinceLastSync / (60 * 60 * 1000))} hours`,
            twelveHoursMs,
            needsSync,
          });

          return needsSync;
        } catch (error) {
          console.log('🔄 [UI] Invalid sync data in localStorage, sync needed:', error);
          return true; // Invalid data, sync anyway
        }
      })();

      const localStorageData = localStorage.getItem('schwab-initial-sync-completed');
      let localStorageInfo = 'none';
      if (localStorageData) {
        try {
          const parsed = JSON.parse(localStorageData);
          const timeSinceSync = Date.now() - parsed.timestamp;
          const hoursSinceSync = Math.round(timeSinceSync / (60 * 60 * 1000));
          localStorageInfo = `${hoursSinceSync} hours ago`;
        } catch {
          localStorageInfo = 'invalid';
        }
      }

      console.log('🔄 [UI] Sync trigger conditions:', {
        enableSyncTriggering,
        isConnected,
        shouldSync,
        isSyncing,
        activeCredentialsLoading,
        justConnected,
        returnUrl: !!returnUrl,
        localStorage: localStorageInfo,
      });

      if (
        shouldTriggerSync &&
        isConnected &&
        shouldSync &&
        !isSyncing &&
        !activeCredentialsLoading && // Don't trigger while still loading
        (!justConnected || !localStorage.getItem('schwab-initial-sync-completed')) && // Allow sync if just connected AND no previous sync data
        !returnUrl
      ) {
        const reason =
          justConnected && !localStorage.getItem('schwab-initial-sync-completed')
            ? 'just connected with no previous sync data'
            : 'existing connection needs refresh';
        console.log(
          `🔄 [UI] Instance ${instanceId.current} detected Schwab connection (${reason}), starting sync`,
        );
        // Store timestamp for 12-hour expiration check
        const syncTimestamp = Date.now();
        localStorage.setItem(
          'schwab-initial-sync-completed',
          JSON.stringify({
            completed: true,
            timestamp: syncTimestamp,
          }),
        );
        console.log(
          `🔄 [UI] Instance ${instanceId.current} set sync timestamp: ${new Date(syncTimestamp).toISOString()}`,
        );
        runFullSync();
      }
    }
  }, [
    isConnected,
    isSyncing,
    activeCredentialsLoading,
    runFullSync,
    shouldTriggerSync,
    enableSyncTriggering,
  ]);

  // Cleanup sessionStorage on unmount (HMR safety)
  useEffect(() => {
    return () => {
      // Only cleanup if we're navigating away completely, not on HMR
      if (typeof window !== 'undefined' && !import.meta.hot) {
        sessionStorage.removeItem('schwabReturnUrl');
        // Don't cleanup the initial sync flag in localStorage - we want it to persist
        // with 12-hour expiration. It will be reset when the user disconnects Schwab.
      }
    };
  }, []);

  // Clear initial sync flag when Schwab is disconnected
  // Be very conservative - only clear when we're sure the user actually disconnected
  // Don't clear during loading states, temporary connection blips, or page reloads
  const [previousIsConnected, setPreviousIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // Track the previous connection state
    if (previousIsConnected === null) {
      setPreviousIsConnected(isConnected);
      return;
    }

    // Only clear localStorage if we were previously connected and now we're not
    // AND we have credentials status available (not in a loading state)
    if (previousIsConnected && !isConnected && credentialsStatus && typeof window !== 'undefined') {
      console.log('🔄 [UI] Schwab connection lost, clearing sync timestamp');
      localStorage.removeItem('schwab-initial-sync-completed');
    }

    setPreviousIsConnected(isConnected);
  }, [isConnected, credentialsStatus, previousIsConnected]);

  return {
    credentialsStatus,
    activeCredentialsStatus,
    isConnecting,
    isSyncing,
    syncStep,
    statusLoading,
    oauthMutation,
    isConnected,
    handleConnect,
    runFullSync,
  };
}
