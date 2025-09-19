import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { getYahooSyncCountsServerFn, syncYahooFundamentalsServerFn } from '../lib/server-functions';
import type { SyncYahooFundamentalsResult } from '../lib/yahoo.server';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function YahooIntegration() {
  const queryClient = useQueryClient();
  const [lastSummary, setLastSummary] = useState<SyncYahooFundamentalsResult | null>(null);
  const [selectedScope, setSelectedScope] = useState<string>('all-securities');

  // Fetch counts for each sync scope
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['yahoo-sync-counts'],
    queryFn: async () => {
      const result = await getYahooSyncCountsServerFn();
      return result as Record<YahooScope, number>;
    },
  });

  const yahooMutation = useMutation({
    mutationFn: async (scope: YahooScope): Promise<SyncYahooFundamentalsResult> => {
      return (await syncYahooFundamentalsServerFn({
        data: { scope },
      })) as SyncYahooFundamentalsResult;
    },
    onSuccess: (data: SyncYahooFundamentalsResult) => {
      setLastSummary(data);
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['yahoo-sync-counts'] });
    },
  });

  const isRunning = yahooMutation.isPending;

  // Helper function to format numbers with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  type YahooScope =
    | 'all-securities'
    | 'held-sleeve-securities'
    | 'held-sleeve-securities-missing-data'
    | 'all-holdings'
    | 'all-sleeves'
    | 'missing-fundamentals'
    | 'missing-fundamentals-holdings'
    | 'missing-fundamentals-sleeves';

  // Helper function to get display text with count
  const getDisplayText = (scope: YahooScope, baseText: string) => {
    if (countsLoading) {
      return baseText;
    }
    const count = counts?.[scope] ?? 0;
    return `${baseText} (${formatNumber(count)})`;
  };

  // Sync options with their display names
  const syncOptions = [
    { value: 'all-securities', label: 'All', description: 'Update all securities in the database' },
    {
      value: 'missing-fundamentals',
      label: 'Missing Data',
      description: 'Only securities missing sector, industry, market cap, or PE ratio',
    },
    {
      value: 'held-sleeve-securities',
      label: 'Held and Sleeve',
      description: 'All securities that are either held or appear in sleeves',
    },
    {
      value: 'held-sleeve-securities-missing-data',
      label: 'Held and Sleeve: Missing Data',
      description: 'Held and sleeve securities that are missing fundamentals data',
    },
    {
      value: 'all-holdings',
      label: 'Held',
      description: 'All securities currently held in accounts',
    },
    {
      value: 'missing-fundamentals-holdings',
      label: 'Held & Missing Data',
      description: 'Held securities that are missing fundamentals data',
    },
    { value: 'all-sleeves', label: 'Sleeve', description: 'All securities that appear in sleeves' },
    {
      value: 'missing-fundamentals-sleeves',
      label: 'Sleeve & Missing Data',
      description: 'Sleeve securities that are missing fundamentals data',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Yahoo Finance
        </CardTitle>
        <CardDescription>
          Update market cap, PE ratio, sector, and industry data via Yahoo Finance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Select value={selectedScope} onValueChange={setSelectedScope}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select sync scope">
                  {countsLoading
                    ? 'Loading...'
                    : syncOptions.find((option) => option.value === selectedScope)?.label ||
                      'Select option'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {syncOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {getDisplayText(option.value as YahooScope, option.label)}
                      </span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => yahooMutation.mutate(selectedScope as YahooScope)}
            disabled={isRunning || countsLoading}
            className="shrink-0"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync
          </Button>
        </div>

        {/* Show selected option description */}
        {selectedScope && !countsLoading && (
          <div className="text-sm text-muted-foreground">
            {syncOptions.find((option) => option.value === selectedScope)?.description}
            {!countsLoading && (
              <span className="ml-2 font-medium">
                ({formatNumber(counts?.[selectedScope as keyof typeof counts] ?? 0)} securities)
              </span>
            )}
          </div>
        )}

        {lastSummary && (
          <div className="text-sm text-muted-foreground">
            {lastSummary.success ? (
              <span>
                Updated {formatNumber(lastSummary.recordsProcessed)} securities successfully.
              </span>
            ) : (
              <span className="text-red-600">
                Update completed with errors
                {lastSummary.errorMessage ? `: ${lastSummary.errorMessage}` : '.'}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
