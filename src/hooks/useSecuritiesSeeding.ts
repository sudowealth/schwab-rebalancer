import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { seedSecuritiesDataServerFn } from '~/lib/server-functions';
import type { SyncYahooFundamentalsResult } from '~/lib/yahoo.server';

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

export function useSecuritiesSeeding(securitiesStatus?: {
  hasSecurities: boolean;
  securitiesCount: number;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [hasStartedSeeding, setHasStartedSeeding] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Seed securities mutation
  const seedSecuritiesMutation = useMutation({
    mutationFn: seedSecuritiesDataServerFn,
    onSuccess: (_data: SeedSecuritiesResult) => {
      setShowSuccessMessage(true);
      // Invalidate all queries to refresh the dashboard
      queryClient.invalidateQueries();
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

  // Automatically start seeding when no securities exist
  useEffect(() => {
    if (
      securitiesStatus &&
      !securitiesStatus.hasSecurities &&
      !hasStartedSeeding &&
      !seedSecuritiesMutation.isPending
    ) {
      console.log('Automatically starting securities seeding...');
      setHasStartedSeeding(true);
      // Use mutateAsync to avoid dependency issues
      seedSecuritiesMutation.mutateAsync(undefined).catch((error) => {
        console.error('Auto seeding failed:', error);
        setHasStartedSeeding(false);
      });
    }
  }, [
    securitiesStatus,
    hasStartedSeeding,
    seedSecuritiesMutation.isPending,
    seedSecuritiesMutation.mutateAsync,
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
