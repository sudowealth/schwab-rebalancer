import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Landmark,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { YahooSyncResult } from '../lib/schemas';
import {
  getHeldAndSleeveTickersServerFn,
  getHeldPositionTickersServerFn,
  getSchwabCredentialsStatusServerFn,
  getSchwabOAuthUrlServerFn,
  getSleeveTargetTickersServerFn,
  importNasdaqSecuritiesServerFn,
  revokeSchwabCredentialsServerFn,
  syncSchwabAccountsServerFn,
  syncSchwabHoldingsServerFn,
  syncSchwabPricesServerFn,
  syncSchwabTransactionsServerFn,
  syncYahooFundamentalsServerFn,
} from '../lib/server-functions';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  totalParsed: number;
  totalProcessed: number;
  importedTickers?: string[];
}

interface SchwabSyncResult {
  success: boolean;
  recordsProcessed: number;
  errorMessage?: string;
}

export function SchwabIntegration() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [pricesMenuOpen, setPricesMenuOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [schwabSyncResult, setSchwabSyncResult] = useState<SchwabSyncResult | null>(null);
  const [yahooSyncResult, setYahooSyncResult] = useState<YahooSyncResult | null>(null);
  const [isImportingEquities, setIsImportingEquities] = useState(false);
  const [isSyncingYahoo, setIsSyncingYahoo] = useState(false);
  const [hasTriggeredAutoImport, setHasTriggeredAutoImport] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

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
    onSuccess: async (data: { authUrl?: string }) => {
      console.log('✅ [UI] OAuth URL received:', data.authUrl);
      if (data.authUrl) {
        console.log('🌐 [UI] Redirecting to Schwab OAuth page');
        // Note: The import will happen after the user returns from OAuth and the connection is established
        window.location.href = data.authUrl;
      } else {
        console.warn('⚠️ [UI] No auth URL returned from server');
        setIsConnecting(false);
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
      // Re-run route loaders so dashboard status updates without manual refresh
      router.invalidate();
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
    onSuccess: async (data) => {
      console.log('✅ [UI] Holdings sync completed successfully:', data);

      // After holdings sync, automatically sync prices for held securities
      try {
        console.log(
          '💰 [UI] Holdings sync completed, automatically syncing prices for held securities...',
        );
        const heldTickers = await getHeldPositionTickersServerFn();
        console.log('💰 [UI] Found', heldTickers.length, 'held securities to sync prices for');
        console.log(
          '💰 [UI] Held tickers:',
          heldTickers.slice(0, 5),
          heldTickers.length > 5 ? `...and ${heldTickers.length - 5} more` : '',
        );

        if (heldTickers.length > 0) {
          console.log('💰 [UI] Starting automatic price sync for held securities...');
          const priceSyncResult = await syncPricesMutation.mutateAsync(heldTickers);
          console.log('✅ [UI] Automatic price sync completed:', {
            success: priceSyncResult.success,
            recordsProcessed: priceSyncResult.recordsProcessed,
            errorMessage: priceSyncResult.errorMessage,
          });
        } else {
          console.log('⚠️ [UI] No held securities found, skipping automatic price sync');
        }
      } catch (priceError) {
        console.error('❌ [UI] Automatic price sync failed after holdings sync:', priceError);
        // Don't fail the holdings sync if price sync fails
      }

      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
      router.invalidate();
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
      // Invalidate all dashboard queries to refresh price data
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
      queryClient.invalidateQueries({
        queryKey: ['positions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['metrics'],
      });
      // Force refetch of positions since staleTime might prevent immediate refresh
      queryClient.refetchQueries({
        queryKey: ['positions'],
      });
      router.invalidate();
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
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
      router.invalidate();
    },
    onError: (error) => {
      console.error('❌ [UI] Transactions sync failed:', error);
    },
  });

  // Mutation to run full Schwab sync sequentially: accounts -> holdings -> prices for held securities
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      console.log('🔄 [UI] ===== MANUAL FULL SCHWAB SYNC START =====');
      console.log('🔄 [UI] Timestamp:', new Date().toISOString());
      console.log('🔄 [UI] Sequence: accounts → holdings → held securities prices');

      // 1) Accounts
      console.log('🏦 [UI] Step 1: Starting accounts sync...');
      const accountsResult = await syncAccountsMutation.mutateAsync();
      console.log('🏦 [UI] Accounts sync result:', {
        success: accountsResult?.success,
        recordsProcessed: accountsResult?.recordsProcessed,
        errorMessage: accountsResult?.errorMessage,
        timestamp: new Date().toISOString(),
      });

      if (!accountsResult?.success) {
        console.error('❌ [UI] Accounts sync failed:', accountsResult?.errorMessage);
        throw new Error(accountsResult?.errorMessage || 'Accounts sync failed');
      }
      console.log('✅ [UI] Accounts sync completed successfully');

      // 2) Holdings
      console.log('📊 [UI] Step 2: Starting holdings sync...');
      const holdingsResult = await syncHoldingsMutation.mutateAsync(undefined);
      console.log('📊 [UI] Holdings sync result:', {
        success: holdingsResult?.success,
        recordsProcessed: holdingsResult?.recordsProcessed,
        errorMessage: holdingsResult?.errorMessage,
        timestamp: new Date().toISOString(),
      });

      if (!holdingsResult?.success) {
        console.error('❌ [UI] Holdings sync failed:', holdingsResult?.errorMessage);
        throw new Error(holdingsResult?.errorMessage || 'Holdings sync failed');
      }
      console.log('✅ [UI] Holdings sync completed successfully');

      // Price sync is handled automatically by the holdings sync mutation
      console.log('✅ [UI] ===== MANUAL FULL SCHWAB SYNC COMPLETE =====');
      return holdingsResult;
    },
    onSuccess: (data) => {
      console.log('✅ [UI] Full Schwab sync completed successfully:', data);
      // Invalidate all dashboard queries to refresh data after full sync
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
      queryClient.invalidateQueries({
        queryKey: ['positions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['metrics'],
      });
      queryClient.invalidateQueries({
        queryKey: ['transactions'],
      });
      // Force refetch of positions since staleTime might prevent immediate refresh
      queryClient.refetchQueries({
        queryKey: ['positions'],
      });
      queryClient.refetchQueries({
        queryKey: ['metrics'],
      });
      router.invalidate();
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
      router.invalidate();
    },
    onError: (error) => {
      console.error('❌ [UI] Failed to revoke credentials:', error);
    },
  });

  // Mutation to import equities securities
  const importEquitiesMutation = useMutation({
    mutationFn: async () => {
      console.log('📊 [UI] Starting equities securities import');
      return await importNasdaqSecuritiesServerFn({
        data: { skipExisting: true, feedType: 'all' },
      });
    },
    onSuccess: async (result) => {
      console.log('✅ [UI] Equities import completed successfully:', result);
      setImportResult(result);

      // If import was successful and we imported some securities, check if Schwab is connected
      if (
        result.success &&
        result.imported > 0 &&
        result.importedTickers &&
        result.importedTickers.length > 0
      ) {
        try {
          // Schwab is connected (we just connected), trigger price sync for only the newly imported securities
          setIsImportingEquities(true);
          console.log(
            '🔄 [UI] Starting automatic Schwab price sync for newly imported securities:',
            result.importedTickers,
          );
          const syncResult = await syncSchwabPricesServerFn({
            data: { symbols: result.importedTickers },
          });
          setSchwabSyncResult(syncResult);
          console.log('✅ [UI] Schwab price sync completed:', syncResult);

          // After Schwab sync completes, trigger Yahoo Finance sync for missing data
          if (syncResult.success && syncResult.recordsProcessed > 0) {
            setIsSyncingYahoo(true);
            console.log('🔄 [UI] Starting Yahoo Finance sync for held securities missing data');

            try {
              // First sync held securities missing fundamentals
              const heldResult = await yahooSyncMutation.mutateAsync(
                'missing-fundamentals-holdings',
              );
              console.log('✅ [UI] Yahoo sync for held securities completed:', heldResult);

              // Then sync sleeve securities missing fundamentals
              const sleeveResult = await yahooSyncMutation.mutateAsync(
                'missing-fundamentals-sleeves',
              );
              console.log('✅ [UI] Yahoo sync for sleeve securities completed:', sleeveResult);

              // Combine results - show the most recent one
              setYahooSyncResult(sleeveResult);
            } catch (yahooError) {
              console.error('❌ [UI] Yahoo Finance sync failed:', yahooError);
              setYahooSyncResult({
                success: false,
                recordsProcessed: 0,
                errorMessage:
                  yahooError instanceof Error ? yahooError.message : 'Yahoo sync failed',
                details: [],
                logId: '',
              });
            } finally {
              setIsSyncingYahoo(false);
            }
          }
        } catch (error) {
          console.error('❌ [UI] Schwab price sync failed:', error);
          setSchwabSyncResult({
            success: false,
            recordsProcessed: 0,
            errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
          });
        } finally {
          setIsImportingEquities(false);
        }
      }
    },
    onError: (error) => {
      console.error('❌ [UI] Equities import failed:', error);
      setImportResult({
        success: false,
        imported: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        totalParsed: 0,
        totalProcessed: 0,
      });
    },
  });

  // Mutation to sync Yahoo Finance fundamentals
  const yahooSyncMutation = useMutation({
    mutationFn: async (scope: 'missing-fundamentals-holdings' | 'missing-fundamentals-sleeves') => {
      console.log('📊 [UI] Starting Yahoo Finance sync for scope:', scope);
      return await syncYahooFundamentalsServerFn({
        data: { scope },
      });
    },
    onSuccess: (result) => {
      console.log('✅ [UI] Yahoo Finance sync completed successfully:', result);
      setYahooSyncResult(result);
    },
    onError: (error) => {
      console.error('❌ [UI] Yahoo Finance sync failed:', error);
      setYahooSyncResult({
        success: false,
        recordsProcessed: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
        details: [],
        logId: '',
      });
    },
  });

  // Effect to handle automatic equities import after Schwab connection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthCallback = urlParams.has('code') && urlParams.has('state');

    // If Schwab is connected, we have OAuth callback params, and we haven't triggered auto-import yet
    if (
      credentialsStatus?.hasCredentials &&
      hasOAuthCallback &&
      !hasTriggeredAutoImport &&
      !importEquitiesMutation.isPending
    ) {
      console.log('🔄 [UI] Detected fresh Schwab connection, triggering automatic equities import');

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Trigger automatic import
      setHasTriggeredAutoImport(true);
      importEquitiesMutation.mutate();
    }
  }, [credentialsStatus?.hasCredentials, hasTriggeredAutoImport, importEquitiesMutation]);

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
    console.log('🔄 [UI] ===== MANUAL HELD SECURITIES PRICE SYNC START =====');
    console.log('🔄 [UI] Timestamp:', new Date().toISOString());

    try {
      console.log('🔍 [UI] Fetching held position tickers for manual sync...');
      const heldTickers = await getHeldPositionTickersServerFn();
      console.log('🔍 [UI] Manual sync - held position tickers result:', {
        count: heldTickers.length,
        tickers: heldTickers,
        timestamp: new Date().toISOString(),
      });

      if (heldTickers.length === 0) {
        console.warn('⚠️ [UI] No held positions found, skipping price sync');
        return;
      }

      console.log('💰 [UI] Starting manual price sync for held positions:', heldTickers);
      const mutationResult = syncPricesMutation.mutate(heldTickers);
      console.log('💰 [UI] Manual price sync mutation initiated');

      console.log('✅ [UI] ===== MANUAL HELD SECURITIES PRICE SYNC COMPLETE =====');
      return mutationResult;
    } catch (error) {
      console.error('❌ [UI] ===== MANUAL HELD SECURITIES PRICE SYNC FAILED =====');
      console.error('❌ [UI] Error details:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      throw error;
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

  const handlePricesSyncSleeveTargets = async () => {
    console.log('🎯 [UI] ===== MANUAL SLEEVE TARGET PRICE SYNC START =====');
    console.log('🎯 [UI] Timestamp:', new Date().toISOString());

    try {
      const sleeveTickers = await getSleeveTargetTickersServerFn();
      console.log('🎯 [UI] Sleeve target tickers:', {
        count: sleeveTickers.length,
        tickers: sleeveTickers,
      });

      if (sleeveTickers.length === 0) {
        console.warn('⚠️ [UI] No sleeve target securities found, skipping price sync');
        return;
      }

      syncPricesMutation.mutate(sleeveTickers);
      console.log('🎯 [UI] Manual sleeve target price sync mutation initiated');
    } catch (error) {
      console.error('❌ [UI] Manual sleeve target price sync failed:', error);
      throw error;
    }
  };

  const handlePricesSyncHeldAndSleeves = async () => {
    console.log('🤝 [UI] ===== MANUAL HELD & SLEEVE PRICE SYNC START =====');
    console.log('🤝 [UI] Timestamp:', new Date().toISOString());

    try {
      const combinedTickers = await getHeldAndSleeveTickersServerFn();
      console.log('🤝 [UI] Combined held & sleeve tickers:', {
        count: combinedTickers.length,
        tickers: combinedTickers,
      });

      if (combinedTickers.length === 0) {
        console.warn('⚠️ [UI] No held or sleeve securities found, skipping price sync');
        return;
      }

      syncPricesMutation.mutate(combinedTickers);
      console.log('🤝 [UI] Manual held & sleeve price sync mutation initiated');
    } catch (error) {
      console.error('❌ [UI] Manual held & sleeve price sync failed:', error);
      throw error;
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
    syncAllMutation.isPending ||
    importEquitiesMutation.isPending ||
    yahooSyncMutation.isPending ||
    isImportingEquities ||
    isSyncingYahoo;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Schwab
            </CardTitle>
            <CardDescription>
              Connect your Charles Schwab account to automatically import accounts, holdings, and
              prices.
            </CardDescription>
          </div>

          <div className="min-w-[120px] flex items-center justify-end">
            {statusLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <div className="relative inline-flex items-center">
                <span className="px-3 pr-7 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                  Connected
                </span>
                <button
                  type="button"
                  aria-label="Disconnect Schwab"
                  onClick={handleDisconnect}
                  disabled={revokeMutation.isPending}
                  className="absolute right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-green-700 hover:text-green-900 hover:bg-green-200/70 focus:outline-none disabled:opacity-50"
                >
                  {revokeMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ) : (
              <Button onClick={handleConnect} disabled={isConnecting || oauthMutation.isPending}>
                {isConnecting || oauthMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && (
          <div className="space-y-3">
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
                All
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
                  ''
                )}
                Accounts
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
                  ''
                )}
                Holdings
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
                  ''
                )}
                Transactions
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
                      ''
                    )}
                    <span>Securities</span>
                    <ChevronDown className="h-4 w-4 ml-2 opacity-70" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-2">
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
                      All
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
                      Held
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      disabled={isSyncing}
                      onClick={() => {
                        setPricesMenuOpen(false);
                        handlePricesSyncHeldAndSleeves();
                      }}
                    >
                      Held & Target
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      disabled={isSyncing}
                      onClick={() => {
                        setPricesMenuOpen(false);
                        handlePricesSyncSleeveTargets();
                      }}
                    >
                      Target
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Import Results */}
        {importResult && (
          <div
            className={`relative w-full rounded-lg border p-4 mt-4 ${
              importResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div>
                  <div className="font-medium mb-2">
                    {importResult.success ? 'Equities Import Completed!' : 'Equities Import Failed'}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>Total securities parsed: {importResult.totalParsed.toLocaleString()}</div>
                    <div>Securities processed: {importResult.totalProcessed.toLocaleString()}</div>
                    <div className="text-green-700">
                      Imported: {importResult.imported.toLocaleString()}
                    </div>
                    <div className="text-blue-700">
                      Already exist: {importResult.skipped.toLocaleString()}
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="text-red-700">
                        Errors: {importResult.errors.length}
                        {importResult.errors.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs">Show errors</summary>
                            <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                              {importResult.errors.map((error) => (
                                <li key={error} className="text-xs text-red-600">
                                  {error}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schwab Price Sync Result */}
        {schwabSyncResult && (
          <div
            className={`relative w-full rounded-lg border p-4 mt-4 ${
              schwabSyncResult.success ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {schwabSyncResult.success ? (
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div>
                  <div className="font-medium mb-2">
                    {schwabSyncResult.success
                      ? 'Schwab Price Sync Completed!'
                      : 'Schwab Price Sync Failed'}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      Securities updated: {schwabSyncResult.recordsProcessed.toLocaleString()}
                    </div>
                    {schwabSyncResult.errorMessage && (
                      <div className="text-red-700">Error: {schwabSyncResult.errorMessage}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Yahoo Finance Sync Result */}
        {yahooSyncResult && (
          <div
            className={`relative w-full rounded-lg border p-4 mt-4 ${
              yahooSyncResult.success
                ? 'border-orange-200 bg-orange-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {yahooSyncResult.success ? (
                <CheckCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div>
                  <div className="font-medium mb-2">
                    {yahooSyncResult.success
                      ? 'Yahoo Finance Sync Completed!'
                      : 'Yahoo Finance Sync Failed'}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      Securities updated: {yahooSyncResult.recordsProcessed.toLocaleString()}
                    </div>
                    {yahooSyncResult.errorMessage && (
                      <div className="text-red-700">Error: {yahooSyncResult.errorMessage}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator for automatic import */}
        {(importEquitiesMutation.isPending || isImportingEquities || isSyncingYahoo) && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isSyncingYahoo
              ? 'Updating fundamentals for held and sleeve securities via Yahoo Finance...'
              : isImportingEquities
                ? 'Updating prices for newly imported securities via Schwab...'
                : 'Importing equities securities from NASDAQ...'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
