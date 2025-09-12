import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Database, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { seedSecuritiesDataServerFn } from '../lib/server-functions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

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
  yahooSyncResult?: {
    success: boolean;
    recordsProcessed: number;
    errorMessage?: string;
    logId?: string;
  } | null;
}

interface SecuritySeedPromptProps {
  securitiesStatus?: {
    hasSecurities: boolean;
    securitiesCount: number;
  };
}

export function SecuritySeedPrompt({ securitiesStatus }: SecuritySeedPromptProps) {
  const queryClient = useQueryClient();
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasStartedSeeding, setHasStartedSeeding] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);

  // Seed securities mutation
  const seedSecuritiesMutation = useMutation({
    mutationFn: seedSecuritiesDataServerFn,
    onSuccess: (_data: SeedSecuritiesResult) => {
      setIsCompleted(true);
      // Invalidate all queries to refresh the dashboard
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error('Error seeding securities data:', error);
      setHasStartedSeeding(false); // Reset on error to allow retry
    },
  });

  // Handle success message timeout
  useEffect(() => {
    if (isCompleted) {
      const timeout = setTimeout(() => {
        setIsCompleted(false);
        setShouldHide(true);
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [isCompleted]);

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

  // Don't show if securities already exist and not completed, or if should hide after timeout
  if ((securitiesStatus?.hasSecurities && !isCompleted) || shouldHide) {
    return null;
  }

  // Don't show if no securitiesStatus is provided (shouldn't happen with SSR)
  if (!securitiesStatus) {
    return null;
  }

  return (
    <div className="mb-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Importing Securities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {seedSecuritiesMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Importing ETFs and stocks from NASDAQ feeds (~11,000)</span>
              </div>
            )}

            {/* Success Message */}
            {isCompleted && seedSecuritiesMutation.data && (
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-900 mb-2">
                    Securities imported successfully!
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-green-700">Imported: </span>
                      {seedSecuritiesMutation.data.equitySyncResult.imported.toLocaleString()}{' '}
                      securities
                    </div>
                    <div>
                      <span className="text-blue-700">Already existed: </span>
                      {seedSecuritiesMutation.data.equitySyncResult.skipped.toLocaleString()}{' '}
                      securities
                    </div>
                    {seedSecuritiesMutation.data.equitySyncResult.errors.length > 0 && (
                      <div>
                        <span className="text-red-700">Errors: </span>
                        {seedSecuritiesMutation.data.equitySyncResult.errors.length}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {seedSecuritiesMutation.isError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-red-900 mb-1">Failed to seed securities</h4>
                  <p className="text-sm text-red-700">
                    There was an error populating the securities data. Please try again or check the
                    console for details.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
