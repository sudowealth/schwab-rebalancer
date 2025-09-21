import { PieChartIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { formatCurrency } from '~/lib/utils';

export interface AllocationChartProps {
  allocationData: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  allocationView: 'account' | 'sector' | 'industry' | 'sleeve';
  onAllocationViewChange: (view: 'account' | 'sector' | 'industry' | 'sleeve') => void;
  onSleeveClick?: (sleeveName: string) => void;
}

export function AllocationChart({
  allocationData,
  allocationView,
  onAllocationViewChange,
  onSleeveClick,
}: AllocationChartProps) {
  return (
    <Card style={{ outline: 'none' }} className="focus:outline-none">
      <style>{`
        .recharts-wrapper svg,
        .recharts-wrapper svg *,
        .recharts-pie-sector,
        .recharts-surface {
          outline: none !important;
        }
        .recharts-wrapper svg:focus,
        .recharts-wrapper svg *:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Portfolio Allocation
            </CardTitle>
            <CardDescription className="mt-1">
              Distribution of value across {allocationView}s
            </CardDescription>
          </div>
          <div className="ml-4">
            <Select value={allocationView} onValueChange={onAllocationViewChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="account">By Account</SelectItem>
                <SelectItem value="industry">By Industry</SelectItem>
                <SelectItem value="sector">By Sector</SelectItem>
                <SelectItem value="sleeve">By Sleeve</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent style={{ outline: 'none' }} className="focus:outline-none p-0">
        <div className="space-y-0 focus:outline-none" style={{ outline: 'none' }}>
          <ResponsiveContainer
            width="100%"
            height={400}
            style={{ outline: 'none' }}
            className="focus:outline-none"
          >
            <PieChart style={{ outline: 'none' }} className="focus:outline-none">
              <Pie
                data={allocationData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                stroke="none"
                onClick={
                  allocationView === 'sleeve' && onSleeveClick
                    ? (data) => onSleeveClick(data.name)
                    : undefined
                }
                style={
                  allocationView === 'sleeve' && onSleeveClick ? { cursor: 'pointer' } : undefined
                }
              >
                {allocationData.map((entry) => (
                  <Cell
                    key={`cell-${entry.name}`}
                    fill={entry.color}
                    stroke="none"
                    style={{ outline: 'none' }}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props) => [
                  formatCurrency(value),
                  `${props.payload?.name || name}`,
                ]}
                labelFormatter={() => ''}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Custom Legend with better spacing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm px-6 pb-4">
            {allocationData.map((entry) => (
              <button
                type="button"
                key={`legend-${entry.name}`}
                className={`flex items-center gap-2 bg-transparent ${
                  allocationView === 'sleeve' && onSleeveClick
                    ? 'cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1'
                    : ''
                }`}
                onClick={
                  allocationView === 'sleeve' && onSleeveClick
                    ? () => onSleeveClick(entry.name)
                    : undefined
                }
                onKeyDown={(e) => {
                  if (
                    allocationView === 'sleeve' &&
                    onSleeveClick &&
                    (e.key === 'Enter' || e.key === ' ')
                  ) {
                    e.preventDefault();
                    onSleeveClick(entry.name);
                  }
                }}
              >
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="truncate" title={entry.name}>
                  {entry.name}
                </span>
                <span className="text-gray-500 ml-auto">{entry.percentage.toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
