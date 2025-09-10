import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  getHeldPositionTickersServerFn,
  getSchwabCredentialsStatusServerFn,
  getSchwabOAuthUrlServerFn,
  syncSchwabAccountsServerFn,
  syncSchwabHoldingsServerFn,
  syncSchwabPricesServerFn,
  syncYahooFundamentalsServerFn,
} from '../../lib/server-functions';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

export function SchwabConnectionSection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState<string>('');
  const queryClient = useQueryClient();

  // Query to check credentials status
  const { data: credentialsStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['schwab-credentials-status'],
    queryFn: () => getSchwabCredentialsStatusServerFn(),
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
    console.log('🔄 [UI] Starting full Schwab sync after connection');
    setIsSyncing(true);

    try {
      // 1) Sync accounts
      setSyncStep('Syncing accounts...');
      console.log('🏦 [UI] Syncing accounts');
      const accountsResult = await syncAccountsMutation.mutateAsync();
      if (!accountsResult?.success) {
        throw new Error(accountsResult?.errorMessage || 'Accounts sync failed');
      }

      // 2) Sync holdings
      setSyncStep('Syncing holdings...');
      console.log('📊 [UI] Syncing holdings');
      const holdingsResult = await syncHoldingsMutation.mutateAsync(undefined);
      if (!holdingsResult?.success) {
        throw new Error(holdingsResult?.errorMessage || 'Holdings sync failed');
      }

      // 3) Get held tickers and sync prices
      setSyncStep('Syncing prices...');
      console.log('💰 [UI] Getting held position tickers');
      const heldTickers = await getHeldPositionTickersServerFn();
      console.log(`📊 [UI] Found ${heldTickers.length} held position tickers`, heldTickers);

      if (heldTickers.length > 0) {
        const pricesResult = await syncPricesMutation.mutateAsync(heldTickers);
        console.log('✅ [UI] Prices sync completed:', pricesResult);
      }

      // 4) Optional: Sync Yahoo fundamentals
      try {
        console.log('🟡 [UI] Syncing Yahoo fundamentals');
        await syncYahooFundamentalsServerFn({
          data: { scope: 'missing-fundamentals-holdings' },
        });
      } catch (yErr) {
        console.warn('⚠️ [UI] Yahoo fundamentals sync had an issue:', yErr);
      }

      // Success - refresh all data
      console.log('✅ [UI] Full Schwab sync completed successfully');
      setSyncStep('Sync complete!');

      // Refresh all dashboard data
      queryClient.invalidateQueries();

      // Clear sync state after a brief delay to show success
      setTimeout(() => {
        setIsSyncing(false);
        setSyncStep('');
      }, 2000);
    } catch (error) {
      console.error('❌ [UI] Full Schwab sync failed:', error);
      setSyncStep('Sync failed. Please try again from Data Feeds.');
      setTimeout(() => {
        setIsSyncing(false);
        setSyncStep('');
      }, 3000);
    }
  }, [queryClient, syncAccountsMutation, syncHoldingsMutation, syncPricesMutation]);

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

  const isConnected = credentialsStatus?.hasCredentials || false;

  // State for OAuth callback detection
  const [hasOAuthCallback, setHasOAuthCallback] = useState(false);
  const [hasRunInitialSync, setHasRunInitialSync] = useState(false);

  // Check if we just returned from OAuth callback (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setHasOAuthCallback(urlParams.has('code') || urlParams.has('state'));
    }
  }, []);

  // Trigger sync after successful OAuth connection
  React.useEffect(() => {
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

  // Don't render anything if connected and not syncing
  if (isConnected && !isSyncing) {
    return null;
  }

  // Show sync progress if syncing
  if (isSyncing) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-blue-600" />
            <h3 className="font-medium">Setting up your Schwab data</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {syncStep || 'Preparing your data...'}
            </p>
            <p className="text-xs text-muted-foreground">This may take a few moments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="pt-6">
        <div className="text-center space-y-2">
          <ExternalLink className="h-8 w-8 mx-auto text-muted-foreground" />
          <h3 className="font-medium">Connect Your Schwab Account</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Link your Charles Schwab account to automatically import your accounts and holdings.
            Your credentials are encrypted and stored securely.
          </p>
          <div className="pt-2">
            <Button
              onClick={handleConnect}
              disabled={isConnecting || oauthMutation.isPending || statusLoading}
            >
              {isConnecting || oauthMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                'Get Started'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
