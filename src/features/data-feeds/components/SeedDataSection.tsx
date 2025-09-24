import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Database, Loader2, Package, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { SimpleTooltip } from '~/components/ui/simple-tooltip';
import type { YahooSyncResult } from '~/features/auth/schemas';
import {
  seedDemoDataServerFn,
  seedGlobalEquityModelServerFn,
  seedModelsDataServerFn,
  seedSecuritiesDataServerFn,
} from '~/features/data-feeds/import.server';
import { queryInvalidators } from '~/lib/query-keys';

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
  yahooSyncResult?: YahooSyncResult | null;
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
  const [globalEquityResult, setGlobalEquityResult] = useState<SeedModelsResult | null>(null);
  const [isSchwabSyncing, setIsSchwabSyncing] = useState(false);

  const seedAllMutation = useMutation({
    mutationFn: seedDemoDataServerFn,
    onSuccess: (_data) => {
      // Invalidate relevant queries after seeding demo data
      queryInvalidators.composites.afterDemoDataSeeding(queryClient);
    },
    onError: (error) => {
      console.error('Error seeding all data:', error);
    },
  });

  const seedSecuritiesMutation = useMutation({
    mutationFn: seedSecuritiesDataServerFn,
    onSuccess: async (data: SeedSecuritiesResult) => {
      setSecuritiesResult(data);
      // Invalidate targeted queries after securities seeding
      queryInvalidators.composites.afterSecuritiesSeeding(queryClient);

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
      // Invalidate models and dashboard queries since model seeding may include price syncs
      queryInvalidators.composites.afterModelCreation(queryClient);
    },
    onError: (error) => {
      console.error('Error seeding models data:', error);
      setModelsResult(null);
    },
  });

  const seedGlobalEquityMutation = useMutation({
    mutationFn: seedGlobalEquityModelServerFn,
    onSuccess: (data: SeedModelsResult) => {
      setGlobalEquityResult(data);
      // Invalidate models and dashboard queries since Global Equity seeding includes price syncs
      queryInvalidators.composites.afterModelCreation(queryClient);
    },
    onError: (error) => {
      console.error('Error seeding Global Equity Model data:', error);
      setGlobalEquityResult(null);
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

  const handleSeedGlobalEquityModel = () => {
    seedGlobalEquityMutation.mutate(undefined);
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
• All ETFs and stocks via NASDAQ feeds (~11,000 securities)
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
• All ETFs and stocks via NASDAQ feeds (~11,000 securities)
• S&P 500 index and securities seeding
• Schwab price sync for held/index/sleeve securities (if connected)
• Yahoo sync for held/sleeve securities missing data"
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
• Equal-weighted allocation model"
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

          <SimpleTooltip
            content="Seeds Global Equity Model ecosystem:
• Global equity ETFs and alternatives
• Geographic-based sleeves (US/Intl/Emerging)
• Weighted allocation model (VTI 40%, VXUS 20%, etc.)"
          >
            <Button
              onClick={handleSeedGlobalEquityModel}
              disabled={seedGlobalEquityMutation.isPending}
              variant="outline"
              size="sm"
            >
              {seedGlobalEquityMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Package className="mr-2 h-4 w-4" />
              Global Equity Model
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

        {/* Global Equity Model Results */}
        {globalEquityResult && (
          <div
            className={`relative w-full rounded-lg border p-4 ${
              globalEquityResult.success
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setGlobalEquityResult(null)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Close Global Equity model result"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
            <div className="flex items-start gap-3">
              {globalEquityResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div>
                  <div className="font-medium mb-2">
                    {globalEquityResult.success
                      ? 'Global Equity Model seeded successfully!'
                      : 'Global Equity Model seeding failed'}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-green-700">
                      Models created: {globalEquityResult.models.toLocaleString()}
                    </div>
                    <div className="text-blue-700">
                      Sleeves created: {globalEquityResult.sleeves.toLocaleString()}
                    </div>
                    <div className="text-purple-700">
                      Sleeve members: {globalEquityResult.sleeveMembers.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {(seedSecuritiesMutation.isPending ||
          isSchwabSyncing ||
          seedModelsMutation.isPending ||
          seedGlobalEquityMutation.isPending) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isSchwabSyncing
              ? 'Updating prices for newly imported securities via Schwab...'
              : seedSecuritiesMutation.isPending
                ? 'Importing ETFs and stocks from NASDAQ feeds (~11,000)'
                : seedModelsMutation.isPending
                  ? 'Seeding S&P 500 Model ecosystem. This may take a moment...'
                  : 'Seeding Global Equity Model ecosystem. This may take a moment...'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
