import { useIsMutating, useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import { rebalancePortfolioServerFn, syncSchwabPricesServerFn } from '~/lib/server-functions';
import type { RebalanceMethod } from '~/types/rebalance';

interface UseGroupMutationsProps {
  groupId: string;
  accountHoldings: Array<{
    accountId: string;
    holdings: Array<{ ticker: string }>;
  }>;
  sleeveMembers: Array<{
    members: Array<{ ticker: string }>;
  }>;
  onTradesUpdate?: (
    trades: Array<{
      accountId: string;
      securityId: string;
      action: 'BUY' | 'SELL';
      qty: number;
      estPrice: number;
      estValue: number;
    }>,
  ) => void;
}

export function useGroupMutations({
  groupId,
  accountHoldings,
  sleeveMembers,
  onTradesUpdate,
}: UseGroupMutationsProps) {
  const isAnyMutationRunning = useIsMutating() > 0;

  // Self-contained mutations that focus only on data operations
  const rebalanceMutation = useMutation({
    mutationFn: async (params: { method: RebalanceMethod; cashAmount?: number }) =>
      rebalancePortfolioServerFn({
        data: {
          portfolioId: groupId,
          method: params.method,
          cashAmount: params.cashAmount,
        },
      }),
    onSuccess: (result, _variables) => {
      console.log('📊 [GroupComponent] Rebalance completed successfully');
      // Update trade data in UI state
      if (result?.trades && onTradesUpdate) {
        onTradesUpdate(result.trades);
      }
      // Note: No query invalidation needed since data comes from route loader
      // and we only need to update trades in UI state
    },
    onError: (error) => {
      console.error('❌ [GroupComponent] Rebalance failed:', error);
      // Clear any partial trade state on error will be handled by the component
    },
    onMutate: () => {
      console.log('🔄 [GroupComponent] Starting rebalance operation...');
    },
    retry: (failureCount, error: unknown) => {
      // Only retry on network errors, not on validation or business logic errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string })?.code;
      const isRetryableError =
        errorMessage?.includes('network') ||
        errorMessage?.includes('timeout') ||
        errorCode === 'ECONNRESET';
      return failureCount < 1 && isRetryableError;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff, max 5s
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const syncPricesMutation = useMutation({
    mutationFn: async (symbols: string[]) => syncSchwabPricesServerFn({ data: { symbols } }),
    onSuccess: () => {
      console.log('🔄 [GroupComponent] Price sync completed successfully, updating UI...');
      // Note: No query invalidation needed since data comes from route loader
      // Price updates will be reflected on next page load/navigation
    },
    onError: (error) => {
      console.error('❌ [GroupComponent] Price sync failed:', error);
      // Could show user notification here
    },
    onMutate: () => {
      console.log('🔄 [GroupComponent] Starting price sync operation...');
    },
    retry: (failureCount, error: unknown) => {
      // Retry up to 2 times for network-related errors, but not for auth errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string })?.code;
      const isRetryableError =
        !errorMessage?.includes('unauthorized') &&
        !errorMessage?.includes('forbidden') &&
        (errorMessage?.includes('network') ||
          errorMessage?.includes('timeout') ||
          errorCode === 'ECONNRESET' ||
          errorCode === 'ETIMEDOUT');
      return failureCount < 2 && isRetryableError;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff, max 10s
    gcTime: 10 * 60 * 1000, // Keep price sync results in cache for 10 minutes
  });

  const handleGenerateTrades = useCallback(
    async (method: RebalanceMethod, cashAmount?: number, fetchPricesSelected?: boolean) => {
      try {
        // Prevent concurrent operations by checking if any mutation is currently running
        if (isAnyMutationRunning) {
          console.warn(
            '⚠️ [GroupComponent] Skipping rebalance generation - another operation is in progress',
          );
          return;
        }

        // If price sync is requested, ensure it completes before rebalancing
        if (fetchPricesSelected) {
          // Check current sync status at execution time to avoid race conditions
          if (syncPricesMutation.isPending) {
            console.log('🔄 [GroupComponent] Waiting for existing price sync to complete...');
            await syncPricesMutation.mutateAsync([]);
          } else {
            // Trigger new price sync
            console.log('🔄 [GroupComponent] Starting price sync before rebalance...');
            await syncPricesMutation.mutateAsync([]);
          }
        }

        // Execute rebalance after price sync (if requested) completes
        console.log('📊 [GroupComponent] Starting rebalance calculation...');
        rebalanceMutation.mutate({ method, cashAmount });
      } catch (error) {
        console.error('❌ [GroupComponent] Error in handleGenerateTrades:', error);
        // Don't proceed with rebalance if price sync failed
      }
    },
    [syncPricesMutation, rebalanceMutation, isAnyMutationRunning],
  );

  const handleFetchPrices = useCallback(() => {
    // Prevent price sync if rebalancing is in progress to avoid data conflicts
    if (rebalanceMutation.isPending) {
      console.warn('⚠️ [GroupComponent] Skipping price sync - rebalance operation in progress');
      return;
    }

    // Collect held tickers and model tickers for this group
    const heldTickers = new Set<string>();
    if (Array.isArray(accountHoldings)) {
      for (const account of accountHoldings) {
        if (Array.isArray(account.holdings)) {
          for (const holding of account.holdings) {
            if (holding?.ticker) heldTickers.add(holding.ticker);
          }
        }
      }
    }

    const modelTickers = new Set<string>();
    if (Array.isArray(sleeveMembers)) {
      for (const sleeve of sleeveMembers) {
        for (const member of sleeve.members || []) {
          if (member?.ticker) modelTickers.add(member.ticker);
        }
      }
    }

    const symbols = Array.from(new Set([...heldTickers, ...modelTickers])).filter(Boolean);
    if (symbols.length > 0) {
      console.log(`🔄 [GroupComponent] Syncing prices for ${symbols.length} symbols...`);
      syncPricesMutation.mutate(symbols);
    } else {
      console.log('ℹ️ [GroupComponent] No symbols to sync');
    }
  }, [accountHoldings, sleeveMembers, syncPricesMutation, rebalanceMutation.isPending]);

  return {
    rebalanceMutation,
    syncPricesMutation,
    handleGenerateTrades,
    handleFetchPrices,
    isAnyMutationRunning,
  };
}
