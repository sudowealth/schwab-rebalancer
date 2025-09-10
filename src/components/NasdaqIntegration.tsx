import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  getSchwabCredentialsStatusServerFn,
  importNasdaqSecuritiesServerFn,
  syncSchwabPricesServerFn,
} from '../lib/server-functions';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

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

export function NasdaqIntegration() {
  const [selectedLimit, setSelectedLimit] = useState<number | null>(null);
  const [selectedFeedType, setSelectedFeedType] = useState<'all' | 'nasdaqonly' | 'nonnasdaq'>(
    'all',
  );
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [schwabSyncResult, setSchwabSyncResult] = useState<SchwabSyncResult | null>(null);
  const [isSchwabSyncing, setIsSchwabSyncing] = useState(false);

  const importMutation = useMutation({
    mutationFn: async (options: {
      limit?: number;
      skipExisting?: boolean;
      feedType?: 'all' | 'nasdaqonly' | 'nonnasdaq';
    }) => {
      return await importNasdaqSecuritiesServerFn({ data: options });
    },
    onSuccess: async (result) => {
      setImportResult(result);

      // If import was successful and we imported some securities, check if Schwab is connected
      if (
        result.success &&
        result.imported > 0 &&
        result.importedTickers &&
        result.importedTickers.length > 0
      ) {
        try {
          const schwabStatus = await getSchwabCredentialsStatusServerFn();
          if (schwabStatus?.hasCredentials) {
            // Schwab is connected, trigger price sync for only the newly imported securities
            setIsSchwabSyncing(true);
            console.log(
              '🔄 Starting automatic Schwab price sync for newly imported securities:',
              result.importedTickers,
            );
            const syncResult = await syncSchwabPricesServerFn({
              data: { symbols: result.importedTickers },
            });
            setSchwabSyncResult(syncResult);
            console.log('✅ Schwab price sync completed:', syncResult);
          }
        } catch (error) {
          console.error('❌ Schwab price sync failed:', error);
          setSchwabSyncResult({
            success: false,
            recordsProcessed: 0,
            errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
          });
        } finally {
          setIsSchwabSyncing(false);
        }
      }
    },
    onError: (error) => {
      console.error('Import failed:', error);
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

  const handleImport = async (limit?: number, feedType?: 'all' | 'nasdaqonly' | 'nonnasdaq') => {
    setImportResult(null);
    setSchwabSyncResult(null);
    setSelectedLimit(limit || null);
    const feedTypeToUse = feedType || selectedFeedType;
    setSelectedFeedType(feedTypeToUse);
    await importMutation.mutateAsync({ limit, skipExisting: true, feedType: feedTypeToUse });
  };

  const isLoading = importMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Equity Securities
        </CardTitle>
        <CardDescription>
          Update the database with the names and tickers of ETFs and Stocks that appear on the{' '}
          <a
            href="https://nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            NASDAQ
          </a>{' '}
          (~3,000) and{' '}
          <a
            href="https://nasdaqtrader.com/dynamic/symdir/otherlisted.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            other exchanges
          </a>{' '}
          (~10,000) via Nasdaq Trader.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Import Options */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleImport(undefined, 'all')}
            disabled={isLoading}
          >
            {isLoading && selectedLimit === null && selectedFeedType === 'all' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2 shrink-0" />
            )}
            All
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleImport(undefined, 'nasdaqonly')}
            disabled={isLoading}
          >
            {isLoading && selectedLimit === null && selectedFeedType === 'nasdaqonly' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
            ) : (
              ''
            )}
            NASDAQ
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleImport(undefined, 'nonnasdaq')}
            disabled={isLoading}
          >
            {isLoading && selectedLimit === null && selectedFeedType === 'nonnasdaq' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
            ) : (
              ''
            )}
            Non-NASDAQ
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleImport(10, 'all')}
            disabled={isLoading}
          >
            {isLoading && selectedLimit === 10 && selectedFeedType === 'all' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
            ) : (
              ''
            )}
            First 10
          </Button>
        </div>

        {importResult && (
          <div
            className={`relative w-full rounded-lg border p-4 ${
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
                    {importResult.success ? 'Import completed successfully!' : 'Import failed'}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>Total securities parsed: {importResult.totalParsed.toLocaleString()}</div>
                    <div>Securities processed: {importResult.totalProcessed.toLocaleString()}</div>
                    <div className="text-green-700">
                      Imported: {importResult.imported.toLocaleString()}
                    </div>
                    <div className="text-blue-700">
                      Skipped: {importResult.skipped.toLocaleString()}
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
            className={`relative w-full rounded-lg border p-4 ${
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
                      ? 'Schwab price sync completed for newly imported securities!'
                      : 'Schwab price sync failed for newly imported securities'}
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

        {(isLoading || isSchwabSyncing) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isSchwabSyncing
              ? 'Updating prices for newly imported securities via Schwab...'
              : selectedLimit
                ? `Importing first ${selectedLimit} securities from ${
                    selectedFeedType === 'all'
                      ? 'All Markets'
                      : selectedFeedType === 'nasdaqonly'
                        ? 'NASDAQ'
                        : 'Non-NASDAQ Exchanges'
                  }...`
                : `Importing all securities from ${
                    selectedFeedType === 'all'
                      ? 'All Markets (~13,000)'
                      : selectedFeedType === 'nasdaqonly'
                        ? 'NASDAQ (~3,000)'
                        : 'Non-NASDAQ Exchanges (~10,000)'
                  }... This may take a few minutes.`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
