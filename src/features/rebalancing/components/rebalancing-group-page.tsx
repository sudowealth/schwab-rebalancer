import { useRebalancingData } from '../contexts/rebalancing-data-context';
import { RebalancingGroupAnalytics } from './rebalancing-group-analytics';
import { RebalancingGroupHeader } from './rebalancing-group-header';
import { RebalancingGroupModals } from './rebalancing-group-modals';

/**
 * Main rebalancing group page component
 * Now a simple composition of pure UI components with clear separation of concerns
 * Eliminates the God Component anti-pattern by delegating to specialized components
 */
export function RebalancingGroupPage() {
  const { data, isLoading } = useRebalancingData();

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <RebalancingGroupHeader />
      <RebalancingGroupAnalytics />
      <RebalancingGroupModals />
    </div>
  );
}
