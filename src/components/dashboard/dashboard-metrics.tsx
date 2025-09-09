import { Flame, TrendingUp, Wallet } from 'lucide-react';

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

export function DashboardMetrics({ metrics }: DashboardMetricsProps) {
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
                <dd className="text-lg font-medium text-gray-900">
                  $
                  {metrics?.totalMarketValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  }) || '0.00'}
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
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center ${
                  (metrics?.totalGain || 0) >= 0 ? 'bg-green-500' : 'bg-red-500'
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
                    (metrics?.totalGain || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  $
                  {(metrics?.totalGain || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  ({(metrics?.totalGainPercent || 0).toFixed(2)}%)
                </dd>
                <dd className="text-xs text-gray-500 mt-1">
                  Unrealized: ${(metrics?.unrealizedGain || 0).toLocaleString('en-US')} (
                  {(metrics?.unrealizedGainPercent || 0).toFixed(2)}%)
                </dd>
                <dd className="text-xs text-gray-500">
                  Realized: ${(metrics?.realizedGain || 0).toLocaleString('en-US')} (
                  {(metrics?.realizedGainPercent || 0).toFixed(2)}%)
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
                  $
                  {(metrics?.harvestablelosses || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
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
}
