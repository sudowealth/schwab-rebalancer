import { useMemo } from 'react';

interface SecuritiesStatus {
  hasSecurities?: boolean;
}

interface SchwabCredentialsStatus {
  hasCredentials?: boolean;
}

interface ModelsStatus {
  hasModels?: boolean;
}

interface RebalancingGroupsStatus {
  hasGroups?: boolean;
}

interface UseOnboardingStatusProps {
  securitiesStatus?: SecuritiesStatus;
  schwabCredentialsStatus?: SchwabCredentialsStatus;
  modelsStatus?: ModelsStatus;
  rebalancingGroupsStatus?: RebalancingGroupsStatus;
  schwabOAuthComplete?: boolean;
}

export function useOnboardingStatus({
  securitiesStatus,
  schwabCredentialsStatus,
  modelsStatus,
  rebalancingGroupsStatus,
  schwabOAuthComplete = false,
}: UseOnboardingStatusProps) {
  return useMemo(() => {
    // Calculate if onboarding is complete using reactive data (same as OnboardingTracker)
    const securitiesComplete = securitiesStatus?.hasSecurities || false;
    const schwabCredentialsComplete = schwabCredentialsStatus?.hasCredentials || false;
    const modelsComplete = modelsStatus?.hasModels || false;
    const rebalancingGroupsComplete = rebalancingGroupsStatus?.hasGroups || false;

    const isFullyOnboarded =
      securitiesComplete &&
      schwabCredentialsComplete &&
      schwabOAuthComplete &&
      modelsComplete &&
      rebalancingGroupsComplete;

    return {
      isFullyOnboarded,
      title: isFullyOnboarded ? 'Dashboard' : 'Getting Started',
      subtitle: isFullyOnboarded
        ? null
        : 'Complete these steps to start rebalancing your portfolio at Schwab',
    };
  }, [
    securitiesStatus?.hasSecurities,
    schwabCredentialsStatus?.hasCredentials,
    modelsStatus?.hasModels,
    rebalancingGroupsStatus?.hasGroups,
    schwabOAuthComplete,
  ]);
}
