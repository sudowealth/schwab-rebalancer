import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { queryInvalidators } from '~/lib/query-keys';
import { seedGlobalEquityModelServerFn } from '~/lib/server-functions';

export function useModelCreation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Global Equity Model seeding mutation
  const seedGlobalEquityMutation = useMutation({
    mutationFn: seedGlobalEquityModelServerFn,
    onSuccess: () => {
      // Invalidate targeted queries after model seeding
      queryInvalidators.composites.afterModelCreation(queryClient);
      // Invalidate the home route loader to refresh onboarding status
      router.invalidate();
    },
    onError: (error) => {
      console.error('Error seeding Global Equity Model:', error);
    },
  });

  const handleSeedGlobalEquity = () => {
    seedGlobalEquityMutation.mutate(undefined);
  };

  return {
    isSeeding: seedGlobalEquityMutation.isPending,
    handleSeedGlobalEquity,
  };
}
