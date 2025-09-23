import React from 'react';
import { LazyAllocationChart } from './lazy-allocation-chart';
import { TopHoldings } from './top-holdings';

interface GroupChartsSectionProps {
  allocationData: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  allocationView: 'account' | 'sector' | 'industry' | 'sleeve';
  onAllocationViewChange: (view: 'account' | 'sector' | 'industry' | 'sleeve') => void;
  onSleeveClick: (sleeveName: string) => void;
  onTickerClick: (ticker: string) => void;
  holdingsData: Array<{
    ticker: string;
    value: number;
    percentage: number;
  }>;
}

export const GroupChartsSection = React.memo(function GroupChartsSection({
  allocationData,
  allocationView,
  onAllocationViewChange,
  onSleeveClick,
  onTickerClick,
  holdingsData,
}: GroupChartsSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Portfolio Allocation Chart */}
      <LazyAllocationChart
        allocationData={allocationData}
        allocationView={allocationView}
        onAllocationViewChange={onAllocationViewChange}
        onSleeveClick={onSleeveClick}
      />

      {/* Top Holdings */}
      <TopHoldings holdingsData={holdingsData} onTickerClick={onTickerClick} />
    </div>
  );
});

GroupChartsSection.displayName = 'GroupChartsSection';
