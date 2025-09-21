import { lazy, Suspense } from 'react';
import type { AllocationChartProps } from './allocation-chart';

// Lazy load the AllocationChart component to avoid loading Recharts upfront
const LazyAllocationChartInner = lazy(() =>
  import('./allocation-chart').then((module) => ({
    default: module.AllocationChart,
  })),
);

// Loading fallback for the chart
function AllocationChartSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-32"></div>
      </div>
      <div className="h-96 bg-gray-200 rounded mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {['a', 'b', 'c', 'd', 'e', 'f'].map((key) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded flex-1"></div>
            <div className="h-4 bg-gray-200 rounded w-8"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Lazy-loaded AllocationChart wrapper with Suspense
export function LazyAllocationChart(props: AllocationChartProps) {
  return (
    <Suspense fallback={<AllocationChartSkeleton />}>
      <LazyAllocationChartInner {...props} />
    </Suspense>
  );
}
