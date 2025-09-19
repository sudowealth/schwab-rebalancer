import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { seedGlobalEquityModelServerFn } from '../lib/server-functions';

export function useModelCreation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Global Equity Model seeding mutation
  const seedGlobalEquityMutation = useMutation({
    mutationFn: seedGlobalEquityModelServerFn,
    onSuccess: () => {
      // Invalidate all queries to refresh the models status
      queryClient.invalidateQueries();
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
