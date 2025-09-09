import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Download, ExternalLink, Loader2, RefreshCw, Upload } from 'lucide-react';
import { useState } from 'react';
import {
  getHeldPositionTickersServerFn,
  getSchwabCredentialsStatusServerFn,
  getSchwabOAuthUrlServerFn,
  revokeSchwabCredentialsServerFn,
  syncSchwabAccountsServerFn,
  syncSchwabHoldingsServerFn,
  syncSchwabPricesServerFn,
  syncSchwabTransactionsServerFn,
} from '../lib/server-functions';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export function SchwabIntegration() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [pricesMenuOpen, setPricesMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  // Query to check credentials status
  const { data: credentialsStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['schwab-credentials-status'],
    queryFn: () => {
      console.log('🔍 [UI] Fetching Schwab credentials status');
      return getSchwabCredentialsStatusServerFn();
    },
  });

  // Mutation to start OAuth flow
  const oauthMutation = useMutation({
    mutationFn: async (redirectUri: string) => {
      console.log('🔗 [UI] Starting OAuth flow with redirect URI:', redirectUri);
      return await getSchwabOAuthUrlServerFn({
        data: { redirectUri },
      });
    },
    onSuccess: (data: { authUrl?: string }) => {
      console.log('✅ [UI] OAuth URL received:', data.authUrl);
      if (data.authUrl) {
        console.log('🌐 [UI] Redirecting to Schwab OAuth page');
        window.location.href = data.authUrl;
      } else {
        console.warn('⚠️ [UI] No auth URL returned from server');
      }
    },
    onError: (error) => {
      console.error('❌ [UI] Failed to get OAuth URL:', error);
      setIsConnecting(false);
    },
  });

  // Mutation to sync accounts
  const syncAccountsMutation = useMutation({
    mutationFn: async () => {
      console.log('🏦 [UI] Starting Schwab accounts sync');
      return await syncSchwabAccountsServerFn();
    },
    onSuccess: (data) => {
      console.log('✅ [UI] Accounts sync completed successfully:', data);
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
    },
    onError: (error) => {
      console.error('❌ [UI] Accounts sync failed:', error);
    },
  });

  // Mutation to sync holdings
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
    onSuccess: (data) => {
      console.log('✅ [UI] Holdings sync completed successfully:', data);
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
    },
    onError: (error) => {
      console.error('❌ [UI] Holdings sync failed:', error);
    },
  });

  // Mutation to sync prices
  const syncPricesMutation = useMutation({
    mutationFn: async (symbols?: string[]) => {
      console.log('💰 [UI] Starting Schwab prices sync for symbols:', symbols || 'all symbols');
      return await syncSchwabPricesServerFn({
        data: { symbols },
      });
    },
    onSuccess: (data) => {
      console.log('✅ [UI] Prices sync completed successfully:', data);
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
    },
    onError: (error) => {
      console.error('❌ [UI] Prices sync failed:', error);
    },
  });

  // Mutation to sync transactions
  const syncTransactionsMutation = useMutation({
    mutationFn: async () => {
      console.log('🧾 [UI] Starting Schwab transactions sync');
      return await syncSchwabTransactionsServerFn({ data: {} });
    },
    onSuccess: () => {
      console.log('✅ [UI] Transactions sync completed successfully');
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
    },
    onError: (error) => {
      console.error('❌ [UI] Transactions sync failed:', error);
    },
  });

  // Mutation to run full Schwab sync sequentially: accounts -> holdings -> prices for held securities
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      console.log(
        '🔄 [UI] Starting full Schwab sync: accounts → holdings → held securities prices',
      );

      // 1) Accounts
      const accountsResult = await syncAccountsMutation.mutateAsync();
      if (!accountsResult?.success) {
        throw new Error(accountsResult?.errorMessage || 'Accounts sync failed');
      }

      // 2) Holdings
      const holdingsResult = await syncHoldingsMutation.mutateAsync(undefined);
      if (!holdingsResult?.success) {
        throw new Error(holdingsResult?.errorMessage || 'Holdings sync failed');
      }

      // 3) Prices for held tickers
      const heldTickers = await getHeldPositionTickersServerFn();
      console.log(
        `📊 [UI] Found ${heldTickers.length} held position tickers for price sync during Sync All`,
        heldTickers,
      );
      if (heldTickers.length === 0) {
        console.warn('⚠️ [UI] No held positions found after holdings sync; skipping price sync');
        return { success: true, recordsProcessed: 0 } as {
          success: boolean;
          recordsProcessed: number;
        };
      }

      const pricesResult = await syncPricesMutation.mutateAsync(heldTickers);
      return pricesResult;
    },
    onSuccess: (data) => {
      console.log('✅ [UI] Full Schwab sync completed successfully:', data);
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
    },
    onError: (error) => {
      console.error('❌ [UI] Full Schwab sync failed:', error);
    },
  });

  // Mutation to revoke credentials
  const revokeMutation = useMutation({
    mutationFn: () => {
      console.log('🗑️ [UI] Revoking Schwab credentials');
      return revokeSchwabCredentialsServerFn();
    },
    onSuccess: () => {
      console.log('✅ [UI] Credentials revoked successfully');
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
    },
    onError: (error) => {
      console.error('❌ [UI] Failed to revoke credentials:', error);
    },
  });

  const handleConnect = async () => {
    console.log('🔗 [UI] User clicked Connect Schwab Account button');
    setIsConnecting(true);

    // Store return URL for conditional redirect after OAuth
    sessionStorage.setItem('schwabReturnUrl', window.location.pathname);

    // Ensure HTTPS for Schwab OAuth (required by Schwab)
    let redirectUri = `${window.location.origin}/schwab/callback`;
    if (window.location.hostname === 'localhost' && !redirectUri.startsWith('https:')) {
      redirectUri = redirectUri.replace('http:', 'https:');
      console.log('🔒 [UI] Converted localhost to HTTPS for Schwab requirement');
    }

    console.log('🌐 [UI] Generated redirect URI:', redirectUri);
    oauthMutation.mutate(redirectUri);
  };

  const handleDisconnect = () => {
    console.log('🗑️ [UI] User clicked Disconnect button');
    if (
      window.confirm(
        'Are you sure you want to disconnect your Schwab account? This will remove all stored credentials.',
      )
    ) {
      console.log('✅ [UI] User confirmed disconnect action');
      revokeMutation.mutate();
    } else {
      console.log('❌ [UI] User cancelled disconnect action');
    }
  };

  const handlePricesSyncHeld = async () => {
    try {
      console.log('🔍 [UI] Fetching held position tickers');
      const heldTickers = await getHeldPositionTickersServerFn();
      console.log(`📊 [UI] Found ${heldTickers.length} held position tickers:`, heldTickers);

      if (heldTickers.length === 0) {
        console.warn('⚠️ [UI] No held positions found, skipping price sync');
        return;
      }

      console.log('💰 [UI] Starting price sync for held positions');
      syncPricesMutation.mutate(heldTickers);
    } catch (error) {
      console.error('❌ [UI] Failed to fetch held position tickers:', error);
    }
  };

  const handlePricesSyncAll = () => {
    try {
      console.log('💰 [UI] Starting price sync for ALL securities in database');
      // Passing undefined symbols triggers a full sync of all securities
      syncPricesMutation.mutate(undefined);
    } catch (error) {
      console.error('❌ [UI] Failed to start full price sync:', error);
    }
  };

  const handlePricesSyncFive = async () => {
    try {
      console.log('🔍 [UI] Fetching held position tickers for partial update');
      const heldTickers = await getHeldPositionTickersServerFn();
      const topFive = heldTickers.slice(0, 5);
      console.log(`🎯 [UI] Updating prices for ${topFive.length} holdings:`, topFive);

      if (topFive.length === 0) {
        console.warn('⚠️ [UI] No held positions found, skipping partial price sync');
        return;
      }

      syncPricesMutation.mutate(topFive);
    } catch (error) {
      console.error('❌ [UI] Failed to start partial price sync:', error);
    }
  };

  const handleSync = (type: string) => {
    console.log('🔄 [UI] User requested sync for type:', type);
    switch (type) {
      case 'accounts':
        console.log('🏦 [UI] Triggering accounts sync mutation');
        syncAccountsMutation.mutate();
        break;
      case 'holdings':
        console.log('📊 [UI] Triggering holdings sync mutation');
        syncHoldingsMutation.mutate(undefined);
        break;
      case 'prices': {
        console.log('💰 [UI] Opening prices menu');
        setPricesMenuOpen(true);
        break;
      }
      default:
        console.warn('⚠️ [UI] Unknown sync type requested:', type);
    }
  };

  const isConnected = credentialsStatus?.hasCredentials || false;
  const isSyncing =
    syncAccountsMutation.isPending ||
    syncHoldingsMutation.isPending ||
    syncPricesMutation.isPending ||
    syncAllMutation.isPending;

  console.log('📊 [UI] Component state:', {
    isConnected,
    isSyncing,
    statusLoading,
    isConnecting,
    credentialsStatus,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Schwab
        </CardTitle>
        <CardDescription>
          Connect your Charles Schwab account to automatically import accounts, holdings, and
          prices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">Connection Status:</span>
            {statusLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  isConnected
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-100 text-gray-800 border border-gray-200'
                }`}
              >
                {isConnected ? 'Connected' : 'Not Connected'}
              </span>
            )}
          </div>

          {isConnected ? (
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={isConnecting || oauthMutation.isPending}>
              {isConnecting || oauthMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Connect Schwab Account
            </Button>
          )}
        </div>

        {isConnected && (
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-medium">Data Synchronization</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Button
                variant="outline"
                onClick={() => syncAllMutation.mutate()}
                disabled={isSyncing}
                className="w-full"
              >
                {syncAllMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync All
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSync('accounts')}
                disabled={isSyncing}
                className="w-full"
              >
                {syncAccountsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Sync Accounts
              </Button>

              <Button
                variant="outline"
                onClick={() => handleSync('holdings')}
                disabled={isSyncing}
                className="w-full"
              >
                {syncHoldingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Sync Holdings
              </Button>

              <Button
                variant="outline"
                onClick={() => syncTransactionsMutation.mutate()}
                disabled={isSyncing}
                className="w-full"
              >
                {syncTransactionsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Sync Transactions
              </Button>

              <Popover open={pricesMenuOpen} onOpenChange={setPricesMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => handleSync('prices')}
                    disabled={isSyncing}
                    aria-haspopup="menu"
                    aria-expanded={pricesMenuOpen}
                    className="w-full justify-between"
                  >
                    {syncPricesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    <span>Update Securities</span>
                    <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      className="justify-start"
                      disabled={isSyncing}
                      onClick={() => {
                        setPricesMenuOpen(false);
                        handlePricesSyncAll();
                      }}
                    >
                      All Securities
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      disabled={isSyncing}
                      onClick={() => {
                        setPricesMenuOpen(false);
                        handlePricesSyncHeld();
                      }}
                    >
                      Held Securities
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      disabled={isSyncing}
                      onClick={() => {
                        setPricesMenuOpen(false);
                        handlePricesSyncFive();
                      }}
                    >
                      Five Held Securities
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
