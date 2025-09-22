import { Flame, TrendingUp, Wallet } from 'lucide-react';
import { memo, useMemo } from 'react';
import { withDashboardErrorBoundary } from '~/components/ErrorBoundary';

interface PortfolioMetrics {
  totalMarketValue: number;
  totalGain: number;
  totalGainPercent: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  realizedGain: number;
  realizedGainPercent: number;
  harvestablelosses: number;
}

interface DashboardMetricsProps {
  metrics: PortfolioMetrics | null;
}

const DashboardMetricsComponent = memo(function DashboardMetricsComponent({
  metrics,
}: DashboardMetricsProps) {
  // Pre-calculate formatted values to avoid expensive formatting during render
  const formattedValues = useMemo(() => {
    if (!metrics) {
      return {
        totalValue: '$0.00',
        totalGain: '$0.00',
        totalGainPercent: '0.00%',
        unrealizedGain: '$0',
        unrealizedGainPercent: '0.00%',
        realizedGain: '$0',
        realizedGainPercent: '0.00%',
        harvestableLosses: '$0.00',
        isPositive: true,
      };
    }

    return {
      totalValue: `$${metrics.totalMarketValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
      })}`,
      totalGain: `$${(metrics.totalGain || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
      })}`,
      totalGainPercent: `${(metrics.totalGainPercent || 0).toFixed(2)}%`,
      unrealizedGain: `$${(metrics.unrealizedGain || 0).toLocaleString('en-US')}`,
      unrealizedGainPercent: `${(metrics.unrealizedGainPercent || 0).toFixed(2)}%`,
      realizedGain: `$${(metrics.realizedGain || 0).toLocaleString('en-US')}`,
      realizedGainPercent: `${(metrics.realizedGainPercent || 0).toFixed(2)}%`,
      harvestableLosses: `$${(metrics.harvestablelosses || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
      })}`,
      isPositive: (metrics.totalGain || 0) >= 0,
    };
  }, [metrics]);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-start">
            <div className="shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1 -mt-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Portfolio Value
                </dt>
                <dd className="text-lg font-medium text-gray-900">{formattedValues.totalValue}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-start">
            <div className="shrink-0">
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center ${
                  formattedValues.isPositive ? 'bg-green-500' : 'bg-red-500'
                }`}
              >
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1 -mt-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">YTD Total Gain/Loss</dt>
                <dd
                  className={`text-lg font-medium ${
                    formattedValues.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formattedValues.totalGain} ({formattedValues.totalGainPercent})
                </dd>
                <dd className="text-xs text-gray-500 mt-1">
                  Unrealized: {formattedValues.unrealizedGain} (
                  {formattedValues.unrealizedGainPercent})
                </dd>
                <dd className="text-xs text-gray-500">
                  Realized: {formattedValues.realizedGain} ({formattedValues.realizedGainPercent})
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-start">
            <div className="shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1 -mt-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Harvestable Losses</dt>
                <dd className="text-lg font-medium text-yellow-600">
                  {formattedValues.harvestableLosses}
                </dd>
                <dd className="text-xs text-gray-500 mt-1">
                  Positions meeting -5% or -$2,500 threshold
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const DashboardMetrics = withDashboardErrorBoundary(DashboardMetricsComponent);
