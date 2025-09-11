import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Loader2, Package, Settings, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import {
  seedAccountsDataServerFn,
  seedDemoDataServerFn,
  seedModelsDataServerFn,
  seedRebalancingGroupsDataServerFn,
  seedSecuritiesDataServerFn,
} from '../lib/server-functions';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { SimpleTooltip } from './ui/simple-tooltip';

export function SeedDataSection() {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const seedAllMutation = useMutation({
    mutationFn: seedDemoDataServerFn,
    onSuccess: (data) => {
      setLastResult(data.summary.message);
      // Invalidate all queries including models
      queryClient.invalidateQueries();
      // Clear cached models data specifically
      queryClient.removeQueries({ queryKey: ['models'] });
    },
    onError: (error) => {
      setLastResult(`Error seeding all data: ${error.message}`);
    },
  });

  const seedAccountsMutation = useMutation({
    mutationFn: seedAccountsDataServerFn,
    onSuccess: (data) => {
      setLastResult(data.message);
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      setLastResult(`Error seeding accounts data: ${error.message}`);
    },
  });

  const seedSecuritiesMutation = useMutation({
    mutationFn: seedSecuritiesDataServerFn,
    onSuccess: (data) => {
      setLastResult(data.message);
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      setLastResult(`Error seeding securities data: ${error.message}`);
    },
  });

  const seedModelsMutation = useMutation({
    mutationFn: seedModelsDataServerFn,
    onSuccess: (data) => {
      setLastResult(data.message);
      // Invalidate models query specifically - this will trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['models'] });
      // Also clear any cached models data
      queryClient.removeQueries({ queryKey: ['models'] });
    },
    onError: (error) => {
      setLastResult(`Error seeding models data: ${error.message}`);
    },
  });

  const seedRebalancingGroupsMutation = useMutation({
    mutationFn: seedRebalancingGroupsDataServerFn,
    onSuccess: (data) => {
      setLastResult(data.message);
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      setLastResult(`Error seeding rebalancing groups data: ${error.message}`);
    },
  });

  const handleSeedAll = () => {
    seedAllMutation.mutate(undefined);
  };

  const handleSeedAccounts = () => {
    seedAccountsMutation.mutate(undefined);
  };

  const handleSeedSecurities = () => {
    seedSecuritiesMutation.mutate(undefined);
  };

  const handleSeedModels = () => {
    seedModelsMutation.mutate(undefined);
  };

  const handleSeedRebalancingGroups = () => {
    seedRebalancingGroupsMutation.mutate(undefined);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Demo Data
        </CardTitle>
        <CardDescription>
          Populate the database with demo data for development and testing purposes. ETF and stock
          data comes from{' '}
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
          (~10,000 securities) via Nasdaq Trader while the S&P 500 constituents data comes from{' '}
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
            content="Seeds account-related tables:
• Accounts
• Holdings
• Transactions
• Rebalancing Groups"
          >
            <Button
              onClick={handleSeedAccounts}
              disabled={seedAccountsMutation.isPending}
              variant="outline"
              size="sm"
            >
              {seedAccountsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Users className="mr-2 h-4 w-4" />
              Accounts
            </Button>
          </SimpleTooltip>

          <SimpleTooltip
            content="Seeds securities data:
• Cash instruments ($$$, MCASH)
• All ETFs and stocks via NASDAQ feeds (~13,000 securities)"
          >
            <Button
              onClick={handleSeedSecurities}
              disabled={seedSecuritiesMutation.isPending}
              variant="outline"
              size="sm"
            >
              {seedSecuritiesMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <TrendingUp className="mr-2 h-4 w-4" />
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
            content="Seeds rebalancing configuration tables:
• Rebalancing Groups"
          >
            <Button
              onClick={handleSeedRebalancingGroups}
              disabled={seedRebalancingGroupsMutation.isPending}
              variant="outline"
              size="sm"
            >
              {seedRebalancingGroupsMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Settings className="mr-2 h-4 w-4" />
              Rebalancing Groups
            </Button>
          </SimpleTooltip>
        </div>

        {/* Result Alert */}
        {lastResult && (
          <Alert>
            <AlertDescription>{lastResult}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
