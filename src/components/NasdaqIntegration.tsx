import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Download, Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import { importNasdaqSecuritiesServerFn } from '../lib/server-functions';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  totalParsed: number;
  totalProcessed: number;
}

export function NasdaqIntegration() {
  const [selectedLimit, setSelectedLimit] = useState<number | null>(null);
  const [selectedFeedType, setSelectedFeedType] = useState<'all' | 'nasdaqonly' | 'nonnasdaq'>(
    'all',
  );
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const allId = useId();
  const nasdaqonlyId = useId();
  const nonnasdaqId = useId();

  const importMutation = useMutation({
    mutationFn: async (options: {
      limit?: number;
      skipExisting?: boolean;
      feedType?: 'all' | 'nasdaqonly' | 'nonnasdaq';
    }) => {
      return await importNasdaqSecuritiesServerFn({ data: options });
    },
    onSuccess: (result) => {
      setImportResult(result);
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

  const handleImport = async (limit?: number) => {
    setImportResult(null);
    setSelectedLimit(limit || null);
    await importMutation.mutateAsync({ limit, skipExisting: true, feedType: selectedFeedType });
  };

  const isLoading = importMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Nasdaq Securities Import
        </CardTitle>
        <CardDescription>
          Import securities data from Nasdaq Trader's comprehensive listings. Choose between
          NASDAQ-listed securities or other exchange listings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p className="mb-2">
            <strong>Data Sources:</strong>
          </p>
          <ul className="text-xs space-y-1 mb-2">
            <li>
              •{' '}
              <a
                href="https://nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                NASDAQ Listed Securities
              </a>{' '}
              (~3,000 securities directly listed on NASDAQ)
            </li>
            <li>
              •{' '}
              <a
                href="https://nasdaqtrader.com/dynamic/symdir/otherlisted.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Other Listed Securities
              </a>{' '}
              (~10,000 securities from NYSE, AMEX, and other exchanges)
            </li>
          </ul>
          <p className="mb-2">
            <strong>Format:</strong> Pipe-delimited text file with ACT Symbol, Security Name,
            Exchange, etc.
          </p>
          <p>
            <strong>Note:</strong> Only imports securities that don't already exist in your
            database. Test issues are automatically skipped.
          </p>
        </div>

        {/* Feed Type Selector */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Feed Type:</div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id={allId}
                name="feedType"
                value="all"
                checked={selectedFeedType === 'all'}
                onChange={(e) => setSelectedFeedType(e.target.value as 'all')}
                className="text-blue-600"
              />
              <label htmlFor={allId} className="text-sm cursor-pointer">
                All
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id={nasdaqonlyId}
                name="feedType"
                value="nasdaqonly"
                checked={selectedFeedType === 'nasdaqonly'}
                onChange={(e) => setSelectedFeedType(e.target.value as 'nasdaqonly')}
                className="text-blue-600"
              />
              <label htmlFor={nasdaqonlyId} className="text-sm cursor-pointer">
                NASDAQ Only
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id={nonnasdaqId}
                name="feedType"
                value="nonnasdaq"
                checked={selectedFeedType === 'nonnasdaq'}
                onChange={(e) => setSelectedFeedType(e.target.value as 'nonnasdaq')}
                className="text-blue-600"
              />
              <label htmlFor={nonnasdaqId} className="text-sm cursor-pointer">
                Non-NASDAQ
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {selectedFeedType === 'all'
              ? 'Combines both NASDAQ-listed and other exchange securities'
              : selectedFeedType === 'nasdaqonly'
                ? 'Includes only securities directly listed on the NASDAQ exchange'
                : 'Includes securities from all other exchanges (NYSE, AMEX, etc.) excluding direct NASDAQ listings'}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => handleImport(10)}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading && selectedLimit === 10 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Import First 10
          </Button>

          <Button
            onClick={() => handleImport()}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading && selectedLimit === null ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Import All
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

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {selectedLimit
              ? `Importing first ${selectedLimit} securities from ${
                  selectedFeedType === 'all'
                    ? 'All Markets'
                    : selectedFeedType === 'nasdaqonly'
                      ? 'NASDAQ'
                      : 'Non-NASDAQ Exchanges'
                }...`
              : `Importing all securities from ${
                  selectedFeedType === 'all'
                    ? 'All Markets'
                    : selectedFeedType === 'nasdaqonly'
                      ? 'NASDAQ'
                      : 'Non-NASDAQ Exchanges'
                }... This may take a few minutes.`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
