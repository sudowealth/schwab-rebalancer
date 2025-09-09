interface TradeData {
  securityId?: string;
  ticker?: string;
  action: 'BUY' | 'SELL';
  qty: number;
  estValue: number;
}

export const calculateTradeMetrics = {
  // Calculate net quantity for a security/sleeve
  getNetQty: (trades: TradeData[], tickers: string[]): number => {
    const relevantTrades = trades.filter((t) => tickers.includes(t.securityId || t.ticker || ''));
    return relevantTrades.reduce((sum, t) => sum + t.qty, 0);
  },

  // Calculate net value for a security/sleeve
  getNetValue: (trades: TradeData[], tickers: string[]): number => {
    const relevantTrades = trades.filter((t) => tickers.includes(t.securityId || t.ticker || ''));
    return relevantTrades.reduce((sum, t) => sum + t.estValue, 0);
  },

  // Calculate post-trade value and percentage
  getPostTradeMetrics: (
    currentValue: number,
    trades: TradeData[],
    tickers: string[],
    totalCurrentValue: number,
    totalTradeValue?: number,
    isCashSleeve?: boolean,
    totalCashValue?: number,
  ): { postTradeValue: number; postTradePercent: number } => {
    let postTradeValue: number;

    if (isCashSleeve) {
      // For cash sleeve or individual cash securities
      const nonCashTrades = trades.filter((t) => {
        const id = t.securityId || t.ticker || '';
        return id !== '$$$' && id !== 'MCASH';
      });
      const totalBuys = nonCashTrades
        .filter((t) => t.action === 'BUY')
        .reduce((sum, t) => sum + t.estValue, 0);
      const totalSells = Math.abs(
        nonCashTrades.filter((t) => t.action === 'SELL').reduce((sum, t) => sum + t.estValue, 0),
      );

      // If this is an individual cash security, calculate its proportional share
      if (
        tickers.length === 1 &&
        (tickers[0] === '$$$' || tickers[0] === 'MCASH') &&
        totalCashValue
      ) {
        const totalRemainingCash = totalCashValue + totalSells - totalBuys;
        const cashProportion = currentValue / totalCashValue;
        postTradeValue = totalRemainingCash * cashProportion;
      } else {
        // For cash sleeve, calculate total remaining cash
        postTradeValue = currentValue + totalSells - totalBuys;
      }
    } else {
      const netValue = calculateTradeMetrics.getNetValue(trades, tickers);
      postTradeValue = currentValue + netValue;
    }

    const totalValue = totalCurrentValue + (totalTradeValue || 0);
    const postTradePercent = totalValue > 0 ? (postTradeValue / totalValue) * 100 : 0;

    return { postTradeValue, postTradePercent };
  },

  // Calculate post-trade difference from target
  getPostTradeDiff: (
    currentValue: number,
    targetValue: number,
    trades: TradeData[],
    tickers: string[],
    isCashSleeve?: boolean,
    totalCashValue?: number,
  ): number => {
    let postTradeValue: number;

    if (isCashSleeve) {
      // For cash sleeve or individual cash securities
      const nonCashTrades = trades.filter((t) => {
        const id = t.securityId || t.ticker || '';
        return id !== '$$$' && id !== 'MCASH';
      });
      const totalBuys = nonCashTrades
        .filter((t) => t.action === 'BUY')
        .reduce((sum, t) => sum + t.estValue, 0);
      const totalSells = Math.abs(
        nonCashTrades.filter((t) => t.action === 'SELL').reduce((sum, t) => sum + t.estValue, 0),
      );

      // If this is an individual cash security, calculate its proportional share
      if (
        tickers.length === 1 &&
        (tickers[0] === '$$$' || tickers[0] === 'MCASH') &&
        totalCashValue
      ) {
        const totalRemainingCash = totalCashValue + totalSells - totalBuys;
        const cashProportion = currentValue / totalCashValue;
        postTradeValue = totalRemainingCash * cashProportion;
      } else {
        // For cash sleeve, calculate total remaining cash
        postTradeValue = currentValue + totalSells - totalBuys;
      }

      // For cash, we show the remaining amount as the "difference" (since target is 0)
      return postTradeValue;
    } else {
      const netValue = calculateTradeMetrics.getNetValue(trades, tickers);
      postTradeValue = currentValue + netValue;
      return postTradeValue - targetValue;
    }
  },

  // Calculate percentage distance from target
  getPercentDistanceFromTarget: (currentPercent: number, targetPercent: number): number => {
    return targetPercent > 0 ? Math.abs(currentPercent - targetPercent) : 0;
  },

  // Get security-specific trades
  getSecurityTrades: (trades: TradeData[], ticker: string): TradeData[] => {
    return trades.filter((t) => (t.securityId || t.ticker) === ticker);
  },

  // Get sleeve-specific trades
  getSleeveTradesFromTickers: (trades: TradeData[], tickers: string[]): TradeData[] => {
    return trades.filter((t) => tickers.includes(t.securityId || t.ticker || ''));
  },
};

export const formatDistanceColor = (
  percentDistance: number,
  thresholds = { warning: 2, danger: 5 },
): string => {
  if (percentDistance > thresholds.danger) return 'text-red-600';
  if (percentDistance > thresholds.warning) return 'text-yellow-600';
  return 'text-green-600';
};

export const getBadgeVariant = (
  percentDistance: number,
  thresholds = { warning: 2, danger: 5 },
): 'default' | 'secondary' | 'destructive' => {
  if (percentDistance > thresholds.danger) return 'destructive';
  if (percentDistance > thresholds.warning) return 'secondary';
  return 'default';
};
