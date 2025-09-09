import { DollarSign, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { CASH_TICKER } from '../../lib/constants';
import type { GenerateSleeveTableDataResult } from '../../lib/rebalancing-utils';
import { formatCurrency, formatPercent } from '../../lib/utils';
import type { Trade } from '../../types/rebalance';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Security } from './sleeve-allocation/sleeve-allocation-types';

// Extend Trade to include ticker property used in rebalance logic
export interface RebalanceTrade extends Trade {
  ticker?: string;
}
export type SleeveTableData = GenerateSleeveTableDataResult[number];
// Define a proper type for individual holdings used in this component
interface AccountHolding {
  ticker: string;
  marketValue: number;
  qty?: number;
  costBasis?: number;
  purchaseDate?: Date;
}

// Use the centralized Security type instead of local SecurityData

// Use return type from the server function instead of manual interface
import type { getRebalancingGroupByIdServerFn } from '../../lib/server-functions';

type GroupMember = {
  balance: number;
  id: string;
  accountId: string;
  isActive: boolean;
  accountName?: string;
  accountType?: string;
};

type Group = NonNullable<Awaited<ReturnType<typeof getRebalancingGroupByIdServerFn>>> & {
  members: GroupMember[];
};

interface RebalanceSummaryCardsProps {
  trades: RebalanceTrade[];
  sleeveTableData: SleeveTableData[];
  group?: Group;
  accountHoldings?: AccountHolding[];
}

export function RebalanceSummaryCards({
  trades = [],
  sleeveTableData = [],
  group,
  accountHoldings = [],
}: RebalanceSummaryCardsProps) {
  if (trades.length === 0) {
    return null;
  }

  // Calculate buy amounts (excluding cash)
  const buyTrades = trades.filter((trade) => {
    const id = trade.securityId || trade.ticker;
    return trade.action === 'BUY' && id !== CASH_TICKER;
  });
  const totalBuyAmount = buyTrades.reduce((sum, trade) => sum + (trade.estValue || 0), 0);

  // Calculate sell amounts (excluding cash)
  const sellTrades = trades.filter((trade) => {
    const id = trade.securityId || trade.ticker;
    return trade.action === 'SELL' && id !== CASH_TICKER;
  });
  const totalSellAmount = Math.abs(
    sellTrades.reduce((sum, trade) => sum + (trade.estValue || 0), 0),
  );

  // Calculate cash remaining
  // First, get the current cash position from the cash sleeve
  const cashSleeve = sleeveTableData.find((sleeve) => sleeve.sleeveId === 'cash');
  const currentCash = cashSleeve?.currentValue || 0;

  // Cash remaining = current cash + sells - buys
  const cashRemaining = currentCash + totalSellAmount - totalBuyAmount;

  let totalAbsoluteDeviation = 0;
  let totalAbsoluteDeviationPercent = 0;

  sleeveTableData.forEach((sleeve) => {
    if (sleeve.sleeveId === 'cash') return;

    // Calculate post-trade value for this sleeve
    const sleeveTradeValue = trades
      .filter((trade) =>
        sleeve.securities.some((s: Security) => s.ticker === (trade.ticker || trade.securityId)),
      )
      .reduce((sum, trade) => sum + (trade.estValue || 0), 0);

    const postTradeValue = sleeve.currentValue + sleeveTradeValue;
    const deviation = Math.abs(postTradeValue - sleeve.targetValue);
    const deviationPercent = sleeve.targetValue > 0 ? (deviation / sleeve.targetValue) * 100 : 0;

    totalAbsoluteDeviation += deviation;
    totalAbsoluteDeviationPercent += deviationPercent;
  });

  // Calculate average deviation percentage
  const nonCashSleeves = sleeveTableData.filter((sleeve) => sleeve.sleeveId !== 'cash');
  const avgDeviationPercent =
    nonCashSleeves.length > 0 ? totalAbsoluteDeviationPercent / nonCashSleeves.length : 0;

  // Calculate capital gains for taxable accounts by summing from table data
  const calculateCapitalGains = () => {
    if (!group) {
      return {
        totalGains: 0,
        longTermGains: 0,
        shortTermGains: 0,
        hasTaxableAccounts: false,
      };
    }

    // Get taxable account IDs
    const taxableAccountIds =
      group.members
        ?.filter((member: GroupMember) => member.accountType === 'TAXABLE')
        .map((member: GroupMember) => member.accountId) || [];

    const hasTaxableAccounts = taxableAccountIds.length > 0;

    if (!hasTaxableAccounts) {
      return {
        totalGains: 0,
        longTermGains: 0,
        shortTermGains: 0,
        hasTaxableAccounts: false,
      };
    }

    // Calculate realized gains by using the same logic as the table
    let totalGains = 0;
    let longTermGains = 0;
    let shortTermGains = 0;

    sleeveTableData.forEach((sleeve) => {
      if (sleeve.securities) {
        sleeve.securities.forEach((security: Security) => {
          // Only include securities from taxable accounts
          if (
            security.accountNames?.some((name: string) =>
              group?.members?.find(
                (m: GroupMember) => m.accountName === name && m.accountType === 'TAXABLE',
              ),
            )
          ) {
            // Calculate realized gains for this security
            const sellTrades = trades.filter(
              (trade) =>
                trade.action === 'SELL' &&
                (trade.ticker || trade.securityId) === security.ticker &&
                taxableAccountIds.includes(trade.accountId),
            );

            if (sellTrades.length > 0) {
              let costBasis = security.costBasis || 0;
              let openedAt = security.openedAt;

              // If we don't have cost basis, try to get it from account holdings
              if (!costBasis && accountHoldings) {
                const holding = accountHoldings.find(
                  (h: AccountHolding) => h.ticker === security.ticker,
                );
                if (holding) {
                  // Calculate cost basis per share from total cost basis and quantity
                  const quantity = holding.qty || 1;
                  costBasis = (holding.costBasis || 0) / quantity;
                  openedAt = holding.purchaseDate;
                }
              }

              let securityRealizedGain = 0;
              sellTrades.forEach((trade) => {
                const salePrice = trade.estPrice || 0;
                const gainPerShare = salePrice - costBasis;
                const tradeRealizedGain = gainPerShare * Math.abs(trade.qty || 0);
                securityRealizedGain += tradeRealizedGain;
              });

              // Determine if long-term (>1 year) or short-term
              const isLongTerm = openedAt
                ? Date.now() -
                    (typeof openedAt === 'number'
                      ? openedAt
                      : openedAt instanceof Date
                        ? openedAt.getTime()
                        : typeof openedAt === 'object' && 'getTime' in openedAt
                          ? openedAt.getTime()
                          : new Date(openedAt).getTime()) >
                  365 * 24 * 60 * 60 * 1000
                : false;

              totalGains += securityRealizedGain;
              if (isLongTerm) {
                longTermGains += securityRealizedGain;
              } else {
                shortTermGains += securityRealizedGain;
              }
            }
          }
        });
      }
    });

    return { totalGains, longTermGains, shortTermGains, hasTaxableAccounts };
  };

  const { totalGains, longTermGains, shortTermGains, hasTaxableAccounts } = calculateCapitalGains();

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      {/* Buys Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Buys</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalBuyAmount)}</div>
          <p className="text-xs text-muted-foreground">
            {buyTrades.length} trade{buyTrades.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Sells Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sells</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(totalSellAmount)}</div>
          <p className="text-xs text-muted-foreground">
            {sellTrades.length} trade{sellTrades.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Cash Remaining Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash Remaining</CardTitle>
          <Target className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(cashRemaining)}</div>
          <p className="text-xs text-muted-foreground">
            {cashRemaining > 0
              ? 'Available cash'
              : cashRemaining < 0
                ? 'Cash shortfall'
                : 'Fully invested'}
          </p>
        </CardContent>
      </Card>

      {/* Capital Gains Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Capital Gains</CardTitle>
          <DollarSign className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          {hasTaxableAccounts ? (
            <>
              <div
                className={`text-2xl font-bold ${totalGains >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatCurrency(totalGains)}
              </div>
              <p className="text-xs text-muted-foreground">
                LT: {formatCurrency(longTermGains)} • ST: {formatCurrency(shortTermGains)}
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-muted-foreground">-</div>
              <p className="text-xs text-muted-foreground">Non-taxable accounts</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Deviation Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Post-Trade Deviation</CardTitle>
          <Target className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(totalAbsoluteDeviation)}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatPercent(avgDeviationPercent / 100)} avg deviation
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
