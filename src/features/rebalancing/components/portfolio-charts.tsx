import { AllocationChart } from './allocation-chart';
import { TopHoldings } from './top-holdings';

interface PortfolioChartsProps {
  allocationData: Array<{
    name: string;
    value: number;
    percentage?: number;
    color?: string;
  }>;
  allocationView: 'account' | 'sector' | 'industry' | 'sleeve';
  holdingsData: Array<{
    ticker: string;
    value: number;
    percentage: number;
  }>;
  onAllocationViewChange: (view: 'account' | 'sector' | 'industry' | 'sleeve') => void;
  onSleeveClick: (sleeveName: string) => void;
  onTickerClick: (ticker: string) => void;
}

export function PortfolioCharts({
  allocationData,
  allocationView,
  holdingsData,
  onAllocationViewChange,
  onSleeveClick,
  onTickerClick,
}: PortfolioChartsProps) {
  // Ensure allocation data has required properties
  const processedAllocationData = allocationData.map((item) => ({
    ...item,
    percentage: item.percentage || 0,
    color: item.color || '#8884d8',
  }));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Portfolio Allocation Chart */}
      <AllocationChart
        allocationData={processedAllocationData}
        allocationView={allocationView}
        onAllocationViewChange={onAllocationViewChange}
        onSleeveClick={onSleeveClick}
      />

      {/* Top Holdings */}
      <TopHoldings holdingsData={holdingsData} onTickerClick={onTickerClick} />
    </div>
  );
}
