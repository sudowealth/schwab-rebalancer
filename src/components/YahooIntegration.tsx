import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { syncYahooFundamentalsServerFn } from '../lib/server-functions';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function YahooIntegration() {
  const queryClient = useQueryClient();
  const [lastSummary, setLastSummary] = useState<{
    success: boolean;
    recordsProcessed: number;
    errorMessage?: string;
  } | null>(null);

  const yahooMutation = useMutation({
    mutationFn: async (
      scope:
        | 'all-securities'
        | 'all-holdings'
        | 'five-holdings'
        | 'missing-fundamentals'
        | 'missing-fundamentals-holdings'
        | 'missing-fundamentals-sleeves',
    ): Promise<{ success: boolean; recordsProcessed: number; errorMessage?: string }> => {
      const result = (await syncYahooFundamentalsServerFn({ data: { scope } })) as {
        success?: boolean;
        recordsProcessed?: number;
        errorMessage?: string;
      };
      return {
        success: Boolean(result?.success),
        recordsProcessed: Number(result?.recordsProcessed ?? 0),
        errorMessage: (result as { errorMessage?: string })?.errorMessage,
      };
    },
    onSuccess: (data: { success: boolean; recordsProcessed: number; errorMessage?: string }) => {
      setLastSummary({
        success: Boolean(data?.success),
        recordsProcessed: Number(data?.recordsProcessed ?? 0),
        errorMessage: data?.errorMessage,
      });
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
    },
  });

  const isRunning = yahooMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Yahoo Finance
        </CardTitle>
        <CardDescription>
          Update security fundamentals and prices using Yahoo Finance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => yahooMutation.mutate('all-securities')}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2 shrink-0" />
            )}
            All
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => yahooMutation.mutate('missing-fundamentals')}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" /> : ''}
            Missing Data
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => yahooMutation.mutate('missing-fundamentals-holdings')}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" /> : ''}
            Held & Missing Data
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => yahooMutation.mutate('all-holdings')}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" /> : ''}
            All Held
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => yahooMutation.mutate('five-holdings')}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" /> : ''}
            Five Held
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => yahooMutation.mutate('missing-fundamentals-sleeves')}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" /> : ''}
            Sleeve Missing Data
          </Button>
        </div>

        {lastSummary && (
          <div className="text-sm text-muted-foreground">
            {lastSummary.success ? (
              <span>Updated {lastSummary.recordsProcessed} securities successfully.</span>
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
