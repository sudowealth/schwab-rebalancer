import { formatCurrency, formatPercent } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface TopHoldingsProps {
  holdingsData: Array<{
    ticker: string;
    value: number;
    percentage: number;
  }>;
  onTickerClick: (ticker: string) => void;
}

export function TopHoldings({ holdingsData, onTickerClick }: TopHoldingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
        <CardDescription>All positions across accounts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {holdingsData.map((holding) => (
            <div key={holding.ticker} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => onTickerClick(holding.ticker)}
                >
                  {holding.ticker === 'MCASH' ? 'Manual Cash' : holding.ticker}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatPercent(holding.percentage / 100)}
                </span>
              </div>
              <span className="font-medium">{formatCurrency(holding.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
