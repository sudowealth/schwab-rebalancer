import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import type { SyncYahooFundamentalsResult } from '~/features/data-feeds/yahoo.server';
import {
  getHeldPositionTickersServerFn,
  getSchwabCredentialsStatusServerFn,
  getSchwabOAuthUrlServerFn,
  syncSchwabAccountsServerFn,
  syncSchwabHoldingsServerFn,
  syncSchwabPricesServerFn,
  syncYahooFundamentalsServerFn,
} from '~/lib/server-functions';

export function useSchwabConnection(
  initialCredentialsStatus?: { hasCredentials: boolean },
  initialActiveCredentialsStatus?: { hasCredentials: boolean },
) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState<string>('');
  const queryClient = useQueryClient();
  const router = useRouter();

  // Query to check credentials status (environment variables)
  const { data: credentialsStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['schwab-credentials-status'],
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
      console.log('🏦 [UI] Starting Schwab accounts sync');
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
      console.log('💰 [UI] Starting Schwab prices sync for symbols:', symbols || 'all symbols');
      return await syncSchwabPricesServerFn({
        data: { symbols },
      });
    },
  });

  // Function to run full Schwab sync sequentially
  const runFullSync = useCallback(async () => {
    console.log('🔄 [UI] ===== STARTING FULL SCHWAB SYNC AFTER CONNECTION =====');
    console.log('🔄 [UI] Timestamp:', new Date().toISOString());
    setIsSyncing(true);

    try {
      // 1) Sync accounts
      setSyncStep('Syncing accounts...');
      console.log('🏦 [UI] Step 1: Starting accounts sync...');
      console.log('🏦 [UI] Current time:', new Date().toISOString());
      const accountsResult = await syncAccountsMutation.mutateAsync();
      console.log('🏦 [UI] Accounts sync result:', {
        success: accountsResult?.success,
        recordsProcessed: accountsResult?.recordsProcessed,
        errorMessage: accountsResult?.errorMessage,
        timestamp: new Date().toISOString(),
      });

      if (!accountsResult?.success) {
        console.error('❌ [UI] Accounts sync failed with error:', accountsResult?.errorMessage);
        throw new Error(accountsResult?.errorMessage || 'Accounts sync failed');
      }
      console.log('✅ [UI] Accounts sync completed successfully');

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

      // Refresh all dashboard data
      console.log('🔄 [UI] Invalidating queries to refresh data...');
      queryClient.invalidateQueries();
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
  const { data: activeCredentialsStatus } = useQuery({
    queryKey: ['schwab-active-credentials'],
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
  });

  const isConnected = activeCredentialsStatus?.hasCredentials || false;

  // State for OAuth callback detection - reset on HMR
  const [hasOAuthCallback, setHasOAuthCallback] = useState(false);
  const [hasRunInitialSync, setHasRunInitialSync] = useState(false);

  // Check if we just returned from OAuth callback (client-side only)
  // Reset state on component mount/remount (HMR safe)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hasCallback = urlParams.has('code') || urlParams.has('state');
      setHasOAuthCallback(hasCallback);

      // Reset sync state on fresh mount (HMR safety)
      if (!hasCallback) {
        setHasRunInitialSync(false);
      }
    }
  }, []);

  // Trigger sync after successful OAuth connection
  useEffect(() => {
    if (isConnected && hasOAuthCallback && !hasRunInitialSync && !isSyncing) {
      console.log('🔄 [UI] Detected successful OAuth return, starting initial sync');
      setHasRunInitialSync(true);
      runFullSync();

      // Clean up URL parameters (client-side only)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        window.history.replaceState({}, document.title, url.pathname + url.hash);
      }
    }
  }, [isConnected, hasOAuthCallback, hasRunInitialSync, isSyncing, runFullSync]);

  // Cleanup sessionStorage on unmount (HMR safety)
  useEffect(() => {
    return () => {
      // Only cleanup if we're navigating away completely, not on HMR
      if (typeof window !== 'undefined' && !import.meta.hot) {
        sessionStorage.removeItem('schwabReturnUrl');
      }
    };
  }, []);

  return {
    credentialsStatus,
    activeCredentialsStatus,
    isConnecting,
    isSyncing,
    syncStep,
    statusLoading,
    oauthMutation,
    isConnected,
    hasOAuthCallback,
    handleConnect,
    runFullSync,
  };
}
