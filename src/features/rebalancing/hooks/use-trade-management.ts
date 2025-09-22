import { useState } from 'react';
import type { Trade } from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-types';

interface SleeveTableData {
  sleeveId: string;
  securities?: Array<{
    ticker: string;
    currentPrice?: number;
  }>;
}

interface GroupMember {
  accountId: string;
}

export function useTradeManagement(groupMembers: GroupMember[]) {
  const [rebalanceTrades, setRebalanceTrades] = useState<Trade[]>([]);

  const handleTradeQtyChange = (
    ticker: string,
    newQty: number,
    sleeveTableData: SleeveTableData[],
  ) => {
    setRebalanceTrades((prevTrades) => {
      // Find existing trade for this ticker
      const existingTradeIndex = prevTrades.findIndex(
        (trade: Trade) => trade.ticker === ticker || trade.securityId === ticker,
      );

      if (existingTradeIndex >= 0) {
        // Update existing trade
        const updatedTrades = [...prevTrades];
        const existingTrade = updatedTrades[existingTradeIndex];

        // Get the security's current price from sleeveTableData
        let currentPrice = existingTrade.estPrice;
        for (const sleeve of sleeveTableData) {
          const security = sleeve.securities?.find(
            (s: { ticker: string; currentPrice?: number }) => s.ticker === ticker,
          );
          if (security?.currentPrice) {
            currentPrice = security.currentPrice;
            break;
          }
        }

        updatedTrades[existingTradeIndex] = {
          ...existingTrade,
          qty: newQty,
          action: newQty > 0 ? 'BUY' : 'SELL',
          estValue: newQty * currentPrice,
        };

        // Remove trade if quantity is 0
        if (newQty === 0) {
          updatedTrades.splice(existingTradeIndex, 1);
        }

        return updatedTrades;
      }

      if (newQty !== 0) {
        // Create new trade if it doesn't exist and quantity is not 0
        let currentPrice = 0;
        let accountId = '';

        // Find the security's price and account from sleeveTableData
        for (const sleeve of sleeveTableData) {
          const security = sleeve.securities?.find(
            (s: { ticker: string; currentPrice?: number }) => s.ticker === ticker,
          );
          if (security) {
            currentPrice = security.currentPrice || 0;
            // Use the first account
            accountId = groupMembers[0]?.accountId || '';
            break;
          }
        }

        if (currentPrice > 0 && accountId) {
          return [
            ...prevTrades,
            {
              accountId,
              securityId: ticker,
              ticker,
              action: newQty > 0 ? 'BUY' : 'SELL',
              qty: newQty,
              estPrice: currentPrice,
              estValue: newQty * currentPrice,
            },
          ];
        }
      }

      return prevTrades;
    });
  };

  const clearTrades = () => {
    setRebalanceTrades([]);
  };

  const setTrades = (trades: Trade[]) => {
    setRebalanceTrades(trades);
  };

  return {
    rebalanceTrades,
    handleTradeQtyChange,
    clearTrades,
    setTrades,
  };
}
