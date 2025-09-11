import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Database, Loader2, Package, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import {
  seedDemoDataServerFn,
  seedModelsDataServerFn,
  seedSecuritiesDataServerFn,
} from '../lib/server-functions';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { SimpleTooltip } from './ui/simple-tooltip';

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

interface SeedSecuritiesResult {
  success: boolean;
  message: string;
  equitySyncResult: ImportResult;
  schwabSyncResult?: SchwabSyncResult | null;
}

interface SeedModelsResult {
  success: boolean;
  models: number;
  sleeves: number;
  sleeveMembers: number;
}

export function SeedDataSection() {
  const queryClient = useQueryClient();
  const [securitiesResult, setSecuritiesResult] = useState<SeedSecuritiesResult | null>(null);
  const [modelsResult, setModelsResult] = useState<SeedModelsResult | null>(null);
  const [isSchwabSyncing, setIsSchwabSyncing] = useState(false);

  const seedAllMutation = useMutation({
    mutationFn: seedDemoDataServerFn,
    onSuccess: (_data) => {
      // Invalidate all queries including models
      queryClient.invalidateQueries();
      // Clear cached models data specifically
      queryClient.removeQueries({ queryKey: ['models'] });
    },
    onError: (error) => {
      console.error('Error seeding all data:', error);
    },
  });

  const seedSecuritiesMutation = useMutation({
    mutationFn: seedSecuritiesDataServerFn,
    onSuccess: async (data: SeedSecuritiesResult) => {
      setSecuritiesResult(data);
      queryClient.invalidateQueries();

      // Handle Schwab sync if it was triggered
      if (data.schwabSyncResult) {
        setIsSchwabSyncing(true);
        // Schwab sync is already completed on server, just update state
        setTimeout(() => setIsSchwabSyncing(false), 100);
      }
    },
    onError: (error) => {
      console.error('Error seeding securities data:', error);
      setSecuritiesResult(null);
    },
  });

  const seedModelsMutation = useMutation({
    mutationFn: seedModelsDataServerFn,
    onSuccess: (data: SeedModelsResult) => {
      setModelsResult(data);
      // Invalidate models query specifically - this will trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['models'] });
      // Also clear any cached models data
      queryClient.removeQueries({ queryKey: ['models'] });
    },
    onError: (error) => {
      console.error('Error seeding models data:', error);
      setModelsResult(null);
    },
  });

  const handleSeedAll = () => {
    seedAllMutation.mutate(undefined);
  };

  const handleSeedSecurities = () => {
    seedSecuritiesMutation.mutate(undefined);
  };

  const handleSeedModels = () => {
    seedModelsMutation.mutate(undefined);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Seed Data
        </CardTitle>
        <CardDescription>
          Populate the database with dummy account data, ETF and stock data from{' '}
          <a
            href="https://nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            NASDAQ
          </a>{' '}
          (~3,000 securities) and{' '}
          <a
            href="https://nasdaqtrader.com/dynamic/symdir/otherlisted.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            other exchanges
          </a>{' '}
          (~10,000 securities) via Nasdaq Trader, and a S&P 500 Index Replication model designed for
          tax loss harvesting. The S&P 500 constituents data comes from{' '}
          <a
            href="https://raw.githubusercontent.com/datasets/s-and-p-500-companies/refs/heads/main/data/constituents.csv"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Dataset's GitHub repo
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <SimpleTooltip
            content="Seeds all tables in order:
• Cash instruments + S&P 500 securities
• All ETFs and stocks via NASDAQ feeds (~13,000 securities)
• Market indices
• Accounts & holdings
• Transactions
• Industry sleeves + allocation models
• Rebalancing groups"
          >
            <Button
              onClick={handleSeedAll}
              disabled={seedAllMutation.isPending}
              variant="default"
              size="sm"
            >
              {seedAllMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Database className="mr-2 h-4 w-4" />
              All
            </Button>
          </SimpleTooltip>

          <SimpleTooltip
            content="Seeds securities data:
• Cash instruments ($$$, MCASH)
• All ETFs and stocks via NASDAQ feeds (~13,000 securities)
• Automatic price sync via Schwab (if connected)"
          >
            <Button
              onClick={handleSeedSecurities}
              disabled={seedSecuritiesMutation.isPending}
              variant="outline"
              size="sm"
            >
              {seedSecuritiesMutation.isPending || isSchwabSyncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="mr-2 h-4 w-4" />
              )}
              Securities
            </Button>
          </SimpleTooltip>

          <SimpleTooltip
            content="Seeds complete S&P 500 ecosystem:
• S&P 500 securities + index
• Industry-based sleeves
• Equal-weighted allocation model
• Shows detailed seeding results"
          >
            <Button
              onClick={handleSeedModels}
              disabled={seedModelsMutation.isPending}
              variant="outline"
              size="sm"
            >
              {seedModelsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Package className="mr-2 h-4 w-4" />
              S&P 500 Model
            </Button>
          </SimpleTooltip>
        </div>

        {/* Detailed Securities Import Result */}
        {securitiesResult?.equitySyncResult && (
          <div
            className={`relative w-full rounded-lg border p-4 ${
              securitiesResult.equitySyncResult.success
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setSecuritiesResult(null)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Close securities import result"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
            <div className="flex items-start gap-3">
              {securitiesResult.equitySyncResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div>
                  <div className="font-medium mb-2">
                    {securitiesResult.equitySyncResult.success
                      ? 'Securities import completed successfully!'
                      : 'Securities import failed'}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      Total securities parsed:{' '}
                      {securitiesResult.equitySyncResult.totalParsed.toLocaleString()}
                    </div>
                    <div>
                      Securities processed:{' '}
                      {securitiesResult.equitySyncResult.totalProcessed.toLocaleString()}
                    </div>
                    <div className="text-green-700">
                      Imported: {securitiesResult.equitySyncResult.imported.toLocaleString()}
                    </div>
                    <div className="text-blue-700">
                      Already exist: {securitiesResult.equitySyncResult.skipped.toLocaleString()}
                    </div>
                    {securitiesResult.equitySyncResult.errors.length > 0 && (
                      <div className="text-red-700">
                        Errors: {securitiesResult.equitySyncResult.errors.length}
                        {securitiesResult.equitySyncResult.errors.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs">Show errors</summary>
                            <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                              {securitiesResult.equitySyncResult.errors.map((error) => (
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
        {securitiesResult?.schwabSyncResult && (
          <div
            className={`relative w-full rounded-lg border p-4 ${
              securitiesResult.schwabSyncResult.success
                ? 'border-blue-200 bg-blue-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() =>
                setSecuritiesResult((prev) => (prev ? { ...prev, schwabSyncResult: null } : null))
              }
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Close Schwab price sync result"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
            <div className="flex items-start gap-3">
              {securitiesResult.schwabSyncResult.success ? (
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div>
                  <div className="font-medium mb-2">
                    {securitiesResult.schwabSyncResult.success
                      ? 'Schwab price sync completed for newly imported securities!'
                      : 'Schwab price sync failed for newly imported securities'}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      Securities updated:{' '}
                      {securitiesResult.schwabSyncResult.recordsProcessed.toLocaleString()}
                    </div>
                    {securitiesResult.schwabSyncResult.errorMessage && (
                      <div className="text-red-700">
                        Error: {securitiesResult.schwabSyncResult.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* S&P 500 Model Results */}
        {modelsResult && (
          <div
            className={`relative w-full rounded-lg border p-4 ${
              modelsResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setModelsResult(null)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Close S&P 500 model result"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
            <div className="flex items-start gap-3">
              {modelsResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div>
                  <div className="font-medium mb-2">
                    {modelsResult.success
                      ? 'S&P 500 Model seeded successfully!'
                      : 'S&P 500 Model seeding failed'}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-green-700">
                      Models created: {modelsResult.models.toLocaleString()}
                    </div>
                    <div className="text-blue-700">
                      Sleeves created: {modelsResult.sleeves.toLocaleString()}
                    </div>
                    <div className="text-purple-700">
                      Sleeve members: {modelsResult.sleeveMembers.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {(seedSecuritiesMutation.isPending || isSchwabSyncing || seedModelsMutation.isPending) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isSchwabSyncing
              ? 'Updating prices for newly imported securities via Schwab...'
              : seedSecuritiesMutation.isPending
                ? 'Importing all securities from NASDAQ feeds (~13,000). This may take a few minutes.'
                : 'Seeding S&P 500 Model ecosystem. This may take a moment...'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
