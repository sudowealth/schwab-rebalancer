import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { SyncYahooFundamentalsResult } from '~/features/data-feeds/yahoo.server';
import { queryInvalidators } from '~/lib/query-keys';
import { seedSecuritiesDataServerFn } from '~/lib/server-functions';

interface SeedSecuritiesResult {
  success: boolean;
  message: string;
  equitySyncResult: {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    totalParsed: number;
    totalProcessed: number;
  };
  schwabSyncResult?: {
    success: boolean;
    recordsProcessed: number;
    errorMessage?: string;
  } | null;
  yahooSyncResult?: SyncYahooFundamentalsResult | null;
}

export function useSecuritiesSeeding(
  securitiesStatus:
    | {
        hasSecurities: boolean;
        securitiesCount: number;
      }
    | undefined,
  queryStatus: 'pending' | 'error' | 'success',
  fetchStatus: 'fetching' | 'paused' | 'idle',
  isFetchedAfterMount?: boolean,
) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [hasStartedSeeding, setHasStartedSeeding] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [hasTriggeredSeedingCheck, setHasTriggeredSeedingCheck] = useState(false);

  // Debug: log when hook is called
  console.log('🔧 useSecuritiesSeeding hook called with:', {
    securitiesStatus,
    queryStatus,
    fetchStatus,
    isFetchedAfterMount,
  });

  // Seed securities mutation
  const seedSecuritiesMutation = useMutation({
    mutationFn: seedSecuritiesDataServerFn,
    onSuccess: (_data: SeedSecuritiesResult) => {
      setShowSuccessMessage(true);
      // Invalidate targeted queries after securities seeding
      queryInvalidators.composites.afterSecuritiesSeeding(queryClient);
      // Invalidate the home route loader to refresh onboarding status
      router.invalidate();
    },
    onError: (error) => {
      console.error('Error seeding securities data:', error);
      setHasStartedSeeding(false); // Reset on error to allow retry
    },
  });

  // Handle success message timeout
  useEffect(() => {
    if (showSuccessMessage) {
      const timeout = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [showSuccessMessage]);

  // Automatically start seeding when no securities exist.
  // This effect waits until the initial query is successful and no longer fetching before making a decision.
  useEffect(() => {
    console.log('🔍 useSecuritiesSeeding check:', {
      queryStatus,
      fetchStatus,
      isFetchedAfterMount,
      hasTriggeredSeedingCheck,
      securitiesStatus,
      hasSecurities: securitiesStatus?.hasSecurities,
      securitiesCount: securitiesStatus?.securitiesCount,
    });

    // Only run this check once the query has successfully completed, is idle, and has refetched after mount
    if (
      queryStatus === 'success' &&
      fetchStatus === 'idle' &&
      (isFetchedAfterMount ?? true) &&
      !hasTriggeredSeedingCheck
    ) {
      console.log('✅ Seeding check conditions met');
      setHasTriggeredSeedingCheck(true); // Mark that we've performed the check

      if (
        securitiesStatus &&
        !securitiesStatus.hasSecurities &&
        !seedSecuritiesMutation.isPending
      ) {
        console.log('🚀 Starting automatic securities seeding...');
        setHasStartedSeeding(true);
        seedSecuritiesMutation.mutate(undefined);
      } else {
        console.log(
          '❌ Not seeding - hasSecurities:',
          securitiesStatus?.hasSecurities,
          'count:',
          securitiesStatus?.securitiesCount,
        );
      }
    }
  }, [
    queryStatus,
    fetchStatus,
    isFetchedAfterMount,
    securitiesStatus,
    hasTriggeredSeedingCheck,
    seedSecuritiesMutation,
  ]);

  const isSeeding = seedSecuritiesMutation.isPending;
  const hasError = seedSecuritiesMutation.isError;
  const seedResult = seedSecuritiesMutation.data;

  return {
    isSeeding,
    hasError,
    seedResult,
    hasStartedSeeding,
    showSuccessMessage,
  };
}
