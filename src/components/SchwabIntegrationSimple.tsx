import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Download, ExternalLink, Loader2, RefreshCw, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getHeldPositionTickersServerFn,
  getSchwabCredentialsStatusServerFn,
  getSchwabOAuthUrlServerFn,
  revokeSchwabCredentialsServerFn,
  syncSchwabAccountsServerFn,
  syncSchwabHoldingsServerFn,
  syncSchwabPricesServerFn,
  syncSchwabTransactionsServerFn,
  syncYahooFundamentalsServerFn,
} from '../lib/server-functions';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { YahooIntegration } from './YahooIntegration';

export function SchwabIntegrationSimple() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [pricesMenuOpen, setPricesMenuOpen] = useState(false);
  const [lastPriceDetails, setLastPriceDetails] = useState<Array<{
    entityId?: string;
    ticker?: string;
    operation?: string;
    changes?: string | Record<string, unknown>;
  }> | null>(null);
  const [, setLastPriceLogId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | undefined>(undefined);
  const [hasExpandedSelection, setHasExpandedSelection] = useState(false);
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [changesModalTitle, setChangesModalTitle] = useState<string>('');
  const [changesModalText, setChangesModalText] = useState<string>('');
  const queryClient = useQueryClient();

  // Query to check credentials status
  const { data: credentialsStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['schwab-credentials-status'],
    queryFn: () => {
      console.log('🔍 [UI] Fetching Schwab credentials status');
      return getSchwabCredentialsStatusServerFn();
    },
  });

  // (moved) sync logs query is declared after mutations to avoid SSR TDZ issues

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
      const maybeDetails = (data as { details?: unknown })?.details;
      if (Array.isArray(maybeDetails)) {
        setLastPriceDetails(
          maybeDetails as Array<{
            entityId?: string;
            ticker?: string;
            operation?: string;
            changes?: string | Record<string, unknown>;
          }>,
        );
      }
      const maybeLogId = (data as { logId?: string })?.logId;
      if (maybeLogId) {
        setLastPriceLogId(maybeLogId);
        setExpandedLogId(maybeLogId);
      }
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
    },
    onError: (error) => {
      console.error('❌ [UI] Prices sync failed:', error);
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
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
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
    },
    onError: (error) => {
      console.error('❌ [UI] Transactions sync failed:', error);
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
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
      // 4) Yahoo fundamentals for held tickers that are missing sector/industry
      try {
        console.log('🟡 [UI] Starting Yahoo fundamentals sync for held tickers missing data');
        await syncYahooFundamentalsServerFn({
          data: { scope: 'missing-fundamentals-holdings' },
        });
      } catch (yErr) {
        console.warn('⚠️ [UI] Yahoo fundamentals sync encountered an issue:', yErr);
      }
      return pricesResult;
    },
    onSuccess: (data) => {
      console.log('✅ [UI] Full Schwab sync completed successfully:', data);
      queryClient.invalidateQueries({
        queryKey: ['schwab-credentials-status'],
      });
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
    },
    onError: (error) => {
      console.error('❌ [UI] Full Schwab sync failed:', error);
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
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

  // Query recent sync logs, refresh more frequently when syncing
  const { data: syncLogs } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: async () => {
      const { getSyncLogsServerFn } = await import('../lib/server-functions');
      return getSyncLogsServerFn();
    },
    // Poll every 2s when any sync mutation is pending, else every 15s
    refetchInterval: () =>
      syncAccountsMutation.isPending ||
      syncHoldingsMutation.isPending ||
      syncPricesMutation.isPending
        ? 2000
        : 15000,
    refetchOnWindowFocus: false,
  });

  // Auto-expand the currently running sync when a sync starts
  useEffect(() => {
    const anyPending =
      syncAccountsMutation.isPending ||
      syncHoldingsMutation.isPending ||
      syncPricesMutation.isPending;
    if (!hasExpandedSelection && anyPending && Array.isArray(syncLogs)) {
      const running = syncLogs.find(
        (l: { status?: string; id?: string }) => l?.status === 'RUNNING',
      );
      if (running && expandedLogId !== running.id) {
        setExpandedLogId(running.id);
      }
    }
  }, [
    syncAccountsMutation.isPending,
    syncHoldingsMutation.isPending,
    syncPricesMutation.isPending,
    syncLogs,
    hasExpandedSelection,
    expandedLogId,
  ]);

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
    <div className="space-y-6">
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
                {revokeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
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

      {/* Yahoo above Sync History */}
      <YahooIntegration />

      {/* Sync History section */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sync History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-white">
              <div className="max-h-60 overflow-auto divide-y">
                {/* Optimistic in-progress row */}
                {(syncAccountsMutation.isPending ||
                  syncHoldingsMutation.isPending ||
                  syncPricesMutation.isPending) && (
                  <div className="p-3 grid grid-cols-[auto_1fr_auto_auto_1fr] items-center gap-3 text-sm">
                    <span className="px-2 py-0.5 rounded border text-xs">
                      {syncPricesMutation.isPending
                        ? 'SECURITIES'
                        : syncHoldingsMutation.isPending
                          ? 'HOLDINGS'
                          : 'ACCOUNTS'}
                    </span>
                    <span className="text-muted-foreground">{new Date().toLocaleString()}</span>
                    <span className="text-amber-600">RUNNING</span>
                    <span className="text-muted-foreground">&nbsp;</span>
                    <span className="justify-self-start">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </span>
                  </div>
                )}
                {(syncLogs ?? []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No recent syncs.</div>
                ) : (
                  (syncLogs ?? []).map((log, _idx: number) => {
                    // Default: closed on initial load; open only if user clicks or when a sync is running
                    const isExpanded = expandedLogId === log.id;
                    return (
                      <div key={log.id} className="text-sm">
                        <button
                          type="button"
                          className="p-3 grid grid-cols-[auto_1fr_auto_auto_1fr] gap-3 items-center cursor-pointer select-none w-full text-left bg-transparent"
                          onClick={() => {
                            setExpandedLogId((prev) => {
                              const next = prev === log.id ? undefined : log.id;
                              return next;
                            });
                            setHasExpandedSelection(true);
                          }}
                        >
                          <span className="px-2 py-0.5 rounded border text-xs">{log.syncType}</span>
                          <span className="text-muted-foreground">
                            {new Date(log.startedAt).toLocaleString()}
                          </span>
                          <span
                            className={
                              log.status === 'RUNNING'
                                ? 'text-amber-600'
                                : log.status === 'SUCCESS'
                                  ? 'text-green-600'
                                  : log.status === 'PARTIAL'
                                    ? 'text-amber-700'
                                    : 'text-red-600'
                            }
                          >
                            {log.status}
                          </span>
                          <span className="text-muted-foreground">
                            {typeof log.recordsProcessed === 'number'
                              ? `${log.recordsProcessed} items`
                              : '\u00A0'}
                          </span>
                          <span className="text-red-600 truncate max-w-[320px]">
                            {log.errorMessage ?? ''}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="px-2 pb-2">
                            <div className="rounded border bg-white">
                              <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[11px] font-medium text-muted-foreground border-b bg-muted/30 justify-items-start">
                                <div className="text-left">Entity</div>
                                <div className="text-left">Operation</div>
                                <div className="text-left">Changes</div>
                              </div>
                              <div className="max-h-[220px] overflow-auto">
                                {(() => {
                                  const details = (log as { details?: unknown[] }).details;
                                  const list = (
                                    log.syncType === 'SECURITIES'
                                      ? (details ?? lastPriceDetails ?? [])
                                      : (details ?? [])
                                  ) as Array<{
                                    changes?: string | Record<string, unknown>;
                                    entityId?: string;
                                    ticker?: string;
                                    operation?: string;
                                  }>;
                                  return list.map((d, i: number) => {
                                    let changes: Record<string, unknown> = {};
                                    try {
                                      changes = d.changes
                                        ? typeof d.changes === 'string'
                                          ? JSON.parse(d.changes)
                                          : d.changes
                                        : {};
                                    } catch {
                                      // Ignore
                                    }
                                    const summarize = (obj: Record<string, unknown>) => {
                                      const entries = Object.entries(
                                        obj || ({} as Record<string, unknown>),
                                      );
                                      if (entries.length === 0) return '';

                                      const fmt = (val: unknown) =>
                                        typeof val === 'number'
                                          ? Number.isInteger(val)
                                            ? String(val)
                                            : (val as number).toFixed(2)
                                          : (val ?? '');
                                      const equal = (a: unknown, b: unknown) => {
                                        if (a === undefined || a === null) return false;
                                        if (b === undefined || b === null) return false;
                                        if (typeof a === 'number' && typeof b === 'number') {
                                          return Math.abs(a - b) < 1e-9;
                                        }
                                        return String(a) === String(b);
                                      };

                                      const parts = entries.slice(0, 3).map(([k, v]) => {
                                        const hasOldNew =
                                          v && typeof v === 'object' && ('old' in v || 'new' in v);
                                        if (hasOldNew) {
                                          const { old: oldV, new: newVRaw } = v as {
                                            old?: unknown;
                                            new?: unknown;
                                          };
                                          const newV = newVRaw ?? oldV;
                                          if (equal(oldV, newV)) {
                                            return `${k}: ${fmt(newV)}`;
                                          }
                                          const left =
                                            oldV !== undefined && oldV !== null
                                              ? `${fmt(oldV)} → `
                                              : '';
                                          return `${k}: ${left}${fmt(newV)}`;
                                        }
                                        return `${k}: ${fmt(v)}`;
                                      });

                                      return parts.join('; ') + (entries.length > 3 ? ' …' : '');
                                    };
                                    return (
                                      <div
                                        key={
                                          d.entityId ?? d.ticker ?? `${d.operation ?? 'op'}-${i}`
                                        }
                                        className="grid grid-cols-3 gap-2 px-3 py-2 text-xs border-t first:border-t-0 justify-items-start"
                                      >
                                        <div className="font-medium text-left">
                                          {d.entityId ?? d.ticker ?? ''}
                                        </div>
                                        <div className="uppercase text-muted-foreground text-left">
                                          {d.operation ?? 'UPDATE'}
                                        </div>
                                        <div className="text-left">
                                          {(() => {
                                            const summary = summarize(changes);
                                            const isTruncated = summary.endsWith(' …');
                                            if (isTruncated) {
                                              return (
                                                <button
                                                  type="button"
                                                  className="underline text-blue-600 hover:text-blue-700 text-left"
                                                  onClick={() => {
                                                    setChangesModalTitle(
                                                      `${d.entityId ?? d.ticker ?? 'Entity'} changes`,
                                                    );
                                                    setChangesModalText(
                                                      JSON.stringify(changes, null, 2),
                                                    );
                                                    setChangesModalOpen(true);
                                                  }}
                                                >
                                                  {summary}
                                                </button>
                                              );
                                            }
                                            return (
                                              <span className="block text-left">{summary}</span>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={changesModalOpen} onOpenChange={setChangesModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{changesModalTitle || 'Changes'}</DialogTitle>
          </DialogHeader>
          <pre className="mt-2 max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs">
            {changesModalText}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
