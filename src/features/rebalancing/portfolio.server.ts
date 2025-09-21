import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import * as schema from '~/db/schema';
import {
  CASH_TICKER,
  isAnyCashTicker,
  isBaseCashTicker,
  MANUAL_CASH_TICKER,
} from '~/lib/constants';
import { dbProxy } from '~/lib/db-config';
import { getErrorMessage } from '~/lib/error-handler';
import { requireAuth } from '../auth/auth-utils';
import type { RebalanceSecurityData, RebalanceSleeveDataNew } from './rebalance-logic.server';

// Server function to rebalance a portfolio - runs ONLY on server
export const rebalancePortfolioServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      portfolioId: string;
      method: 'allocation' | 'tlhSwap' | 'tlhRebalance' | 'investCash';
      allowOverinvestment?: boolean;
      maxOverinvestmentPercent?: number;
      cashAmount?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const {
      portfolioId,
      method,
      allowOverinvestment = false,
      maxOverinvestmentPercent = 5.0,
      cashAmount,
    } = data;

    const cashLogValue =
      typeof cashAmount === 'number' ? cashAmount : method === 'investCash' ? 0 : 'n/a';

    console.log(`🎯 SERVER DEBUG: Received method: ${method}, cashAmount: ${cashLogValue}`);

    if (!portfolioId || !method) {
      throw new Error('Invalid request: portfolioId and method required');
    }

    const { user } = await requireAuth();
    // Verify that the portfolio (rebalancing group) belongs to the authenticated user

    const portfolio = await dbProxy
      .select({ userId: schema.rebalancingGroup.userId })
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.id, portfolioId))
      .limit(1);

    if (portfolio.length === 0 || portfolio[0].userId !== user.id) {
      throw new Error('Access denied: Portfolio not found or does not belong to you');
    }

    const { executeRebalance } = await import('./rebalance-logic.server');

    try {
      // Get rebalancing group and its accounts
      const group = await dbProxy
        .select()
        .from(schema.rebalancingGroup)
        .where(eq(schema.rebalancingGroup.id, portfolioId))
        .limit(1);

      if (!group.length) {
        throw new Error('Rebalancing group not found');
      }

      // Get group members (accounts)
      const groupMembers = await dbProxy
        .select()
        .from(schema.rebalancingGroupMember)
        .where(eq(schema.rebalancingGroupMember.groupId, portfolioId));

      const accountIds = groupMembers.map((m) => m.accountId);

      // Get model assignment
      const modelAssignment = await dbProxy
        .select()
        .from(schema.modelGroupAssignment)
        .where(eq(schema.modelGroupAssignment.rebalancingGroupId, portfolioId))
        .limit(1);

      if (!modelAssignment.length) {
        throw new Error('No model assigned to this rebalancing group');
      }

      // Get model sleeves
      const modelSleeves = await dbProxy
        .select()
        .from(schema.modelMember)
        .where(eq(schema.modelMember.modelId, modelAssignment[0].modelId));

      // Get current holdings
      const holdings = await dbProxy
        .select({
          accountId: schema.holding.accountId,
          ticker: schema.holding.ticker,
          qty: schema.holding.qty,
          costBasis: schema.holding.averageCost,
          openedAt: schema.holding.openedAt,
          price: schema.security.price,
          accountType: schema.account.type,
        })
        .from(schema.holding)
        .innerJoin(schema.security, eq(schema.holding.ticker, schema.security.ticker))
        .innerJoin(schema.account, eq(schema.holding.accountId, schema.account.id))
        .where(inArray(schema.holding.accountId, accountIds));

      // Get wash sale restrictions from database
      const restrictions = await dbProxy
        .select()
        .from(schema.restrictedSecurity)
        .where(
          and(
            inArray(
              schema.restrictedSecurity.sleeveId,
              modelSleeves.map((s) => s.sleeveId),
            ),
            gt(schema.restrictedSecurity.blockedUntil, Date.now()),
          ),
        );

      const washSaleRestrictions = restrictions.map((r) => ({
        ticker: r.ticker,
        restrictedUntil: new Date(r.blockedUntil),
        reason: `Tax loss harvested on ${new Date(r.soldAt).toLocaleDateString()}`,
      }));

      // Get transaction history to check for wash sale restrictions
      const transactionData = await dbProxy
        .select({
          ticker: schema.transaction.ticker,
          type: schema.transaction.type,
          realizedGainLoss: schema.transaction.realizedGainLoss,
          executedAt: schema.transaction.executedAt,
          accountId: schema.transaction.accountId,
          accountName: schema.account.name,
          accountType: schema.account.type,
        })
        .from(schema.transaction)
        .innerJoin(schema.account, eq(schema.transaction.accountId, schema.account.id))
        .where(inArray(schema.transaction.accountId, accountIds))
        .orderBy(desc(schema.transaction.executedAt));

      // Convert executedAt to Date for Transaction interface
      const transactions = transactionData.map((tx) => ({
        ...tx,
        executedAt: new Date(tx.executedAt),
        realizedGainLoss: tx.realizedGainLoss ?? 0,
      }));

      console.log(
        `🔍 WASH SALE CHECK: Loaded ${transactions.length} transactions from ${accountIds.length} accounts`,
      );

      // Debug: Show what transactions we have
      transactions.forEach((tx) => {
        console.log(
          `🔍 Transaction: ${tx.ticker} ${tx.type} $${tx.realizedGainLoss?.toFixed(2) ?? 0} on ${new Date(tx.executedAt).toLocaleDateString()} in ${tx.accountName} (${tx.accountType})`,
        );
      });

      // Now using unified wash sale logic for both UI and rebalancing

      // Transform data to new format

      const sleeves: RebalanceSleeveDataNew[] = [];
      const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.qty * h.price, 0);

      console.log(
        `🎯 PORTFOLIO VALUE DEBUG: totalPortfolioValue: $${totalPortfolioValue.toFixed(2)} (raw: ${totalPortfolioValue})`,
      );

      // Add Cash sleeve first to track cash flow during rebalancing
      // Calculate total account value from account holdings (which includes calculated balances)

      // Build cash sleeve securities from actual cash holdings
      const cashSecurities: RebalanceSecurityData[] = [];
      let totalCashValue = 0;

      // Group cash holdings by ticker
      const cashHoldingsMap = new Map<
        string,
        Array<{
          ticker: string;
          qty: number;
          price: number;
          costBasis: number;
          accountType: string;
          accountId: string;
        }>
      >();
      holdings.forEach((holding) => {
        if (isAnyCashTicker(holding.ticker)) {
          const key = isBaseCashTicker(holding.ticker) ? CASH_TICKER : MANUAL_CASH_TICKER;
          if (!cashHoldingsMap.has(key)) {
            cashHoldingsMap.set(key, []);
          }
          cashHoldingsMap.get(key)?.push({ ...holding, ticker: key });
        }
      });

      // Create securities for each cash type
      cashHoldingsMap.forEach((holdingList, ticker) => {
        const totalQty = holdingList.reduce((sum, h) => sum + h.qty, 0);
        const currentValue = totalQty * holdingList[0].price;
        totalCashValue += currentValue;

        cashSecurities.push({
          securityId: ticker,
          rank: isBaseCashTicker(ticker) ? 1 : 2, // Base cash first, then MCASH
          currentQty: totalQty,
          targetPct: 0, // Cash target is 0%
          price: holdingList[0].price,
          accountId: holdingList[0].accountId,
          isTaxable: holdingList.some((h) => h.accountType === 'TAXABLE'),
          unrealizedGain: holdingList.reduce(
            (sum, h) => sum + (h.qty * h.price - h.qty * h.costBasis),
            0,
          ),
        });
      });

      sleeves.unshift({
        // Add at beginning
        sleeveId: 'cash',
        targetValue: 0, // Target is to invest all cash
        targetPct: 0, // We target 0% cash allocation
        currentValue: totalCashValue,
        securities: cashSecurities,
      });

      // Build sleeve-based data structure with rank information
      for (const modelSleeve of modelSleeves) {
        const sleeveMembers = await dbProxy
          .select({
            ticker: schema.sleeveMember.ticker,
            rank: schema.sleeveMember.rank,
          })
          .from(schema.sleeveMember)
          .where(eq(schema.sleeveMember.sleeveId, modelSleeve.sleeveId))
          .orderBy(schema.sleeveMember.rank); // Order by rank for processing

        const sleeveTargetValue = (totalPortfolioValue * modelSleeve.targetWeight) / 10000;
        const sleeveTargetPct = modelSleeve.targetWeight / 10000; // Convert basis points to percentage

        const sleeveSecurities: RebalanceSecurityData[] = [];
        let sleeveCurrentValue = 0;

        for (const member of sleeveMembers) {
          // Get current holdings for this security
          const securityHoldings = holdings.filter((h) => h.ticker === member.ticker);
          const currentQty = securityHoldings.reduce((sum, h) => sum + h.qty, 0);

          // Get security price from holdings or database
          let price = 1.0; // Default price $1.00
          const securityHolding = holdings.find((h) => h.ticker === member.ticker);

          if (securityHolding) {
            price = securityHolding.price;
          } else {
            // Get price from security table if not held
            const securityPrice = await dbProxy
              .select({ price: schema.security.price })
              .from(schema.security)
              .where(eq(schema.security.ticker, member.ticker))
              .limit(1);
            if (securityPrice.length > 0) {
              price = securityPrice[0].price;
            }
          }

          const currentValue = currentQty * price;
          sleeveCurrentValue += currentValue;

          const unrealizedGain = securityHoldings.reduce(
            (sum, h) => sum + (h.qty * h.price - h.qty * h.costBasis),
            0,
          );
          sleeveSecurities.push({
            securityId: member.ticker,
            rank: member.rank,
            currentQty,
            targetPct: sleeveTargetPct / sleeveMembers.length, // Distribute target evenly among sleeve members
            price: price,
            accountId: securityHoldings[0]?.accountId || accountIds[0],
            isTaxable: securityHoldings.some(
              (h) =>
                holdings.find((hold) => hold.accountId === h.accountId)?.accountType === 'TAXABLE',
            ),
            unrealizedGain,
          });
        }

        sleeves.push({
          sleeveId: modelSleeve.sleeveId,
          targetValue: sleeveTargetValue,
          targetPct: sleeveTargetPct,
          currentValue: sleeveCurrentValue,
          securities: sleeveSecurities,
        });
      }

      // Add securities that are held but not in any sleeve (should be sold to 0)
      const sleeveTickers = new Set<string>();
      for (const sleeve of sleeves) {
        for (const sec of sleeve.securities) {
          sleeveTickers.add(sec.securityId);
        }
      }

      const orphanSecurities: RebalanceSecurityData[] = [];
      holdings.forEach((holding) => {
        if (!sleeveTickers.has(holding.ticker)) {
          const currentValue = holding.qty * holding.price;
          if (currentValue > 0) {
            orphanSecurities.push({
              securityId: holding.ticker,
              rank: 999, // High rank so they get sold first
              currentQty: holding.qty,
              targetPct: 0,
              price: holding.price,
              accountId: holding.accountId,
              isTaxable: holding.accountType === 'TAXABLE',
              unrealizedGain: (holding.qty * holding.price - holding.qty * holding.costBasis) / 100,
            });
          }
        }
      });

      // Add orphan securities as a special sleeve with 0% target
      if (orphanSecurities.length > 0) {
        sleeves.push({
          sleeveId: 'orphan-securities',
          targetValue: 0,
          targetPct: 0,
          currentValue: orphanSecurities.reduce((sum, sec) => sum + sec.currentQty * sec.price, 0),
          securities: orphanSecurities,
        });
      }

      // Create replacement candidates for TLH
      const allSecurities = sleeves.flatMap((sleeve) => sleeve.securities);
      const replacementCandidates = allSecurities.map((sec, index) => ({
        originalTicker: sec.securityId,
        replacementTicker: allSecurities[(index + 1) % allSecurities.length].securityId,
        rank: index + 1,
      }));

      // Execute rebalance using new function with transaction history
      const result = executeRebalance(
        portfolioId,
        method,
        sleeves,
        washSaleRestrictions,
        replacementCandidates,
        allowOverinvestment,
        maxOverinvestmentPercent,
        transactions,
        cashAmount,
      );

      return result;
    } catch (error) {
      console.error('Error calculating rebalance:', error);
      throw new Error(`Failed to calculate rebalance: ${getErrorMessage(error)}`);
    }
  });

export type RebalancePortfolioServerFnResult = Awaited<
  ReturnType<typeof rebalancePortfolioServerFn>
>;

// Server function to update manual cash for an account - runs ONLY on server
export const updateManualCashServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId: string; amount: number }) => data)
  .handler(async ({ data }) => {
    const { accountId, amount } = data;

    if (!accountId || amount < 0) {
      throw new Error('Invalid request: accountId required and amount must be >= 0');
    }

    const { user } = await requireAuth();
    // Verify that the account belongs to the authenticated user

    const account = await dbProxy
      .select({ userId: schema.account.userId })
      .from(schema.account)
      .where(eq(schema.account.id, accountId))
      .limit(1);

    if (account.length === 0 || account[0].userId !== user.id) {
      throw new Error('Access denied: Account not found or does not belong to you');
    }

    const now = Date.now();

    try {
      // Check if MCASH holding already exists for this account
      const existingHolding = await dbProxy
        .select()
        .from(schema.holding)
        .where(and(eq(schema.holding.accountId, accountId), eq(schema.holding.ticker, 'MCASH')))
        .limit(1);

      if (amount === 0) {
        // Delete the holding if amount is 0
        if (existingHolding.length > 0) {
          await dbProxy.delete(schema.holding).where(eq(schema.holding.id, existingHolding[0].id));
        }
      } else {
        // Store amount as quantity (MCASH price is $1.00 per share)
        const qtyInDollars = Math.round(amount);

        if (existingHolding.length > 0) {
          // Update existing holding
          await dbProxy
            .update(schema.holding)
            .set({
              qty: qtyInDollars,
              updatedAt: now,
            })
            .where(eq(schema.holding.id, existingHolding[0].id));
        } else {
          // Create new holding
          const holdingId = `manual-cash-${accountId}-${Date.now()}`;
          await dbProxy.insert(schema.holding).values({
            id: holdingId,
            accountId,
            ticker: 'MCASH',
            qty: qtyInDollars,
            averageCost: 1.0, // $1.00 per "share"
            openedAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // Clear cache to ensure fresh data
      const { clearCache } = await import('~/lib/db-api');
      clearCache();

      return { success: true };
    } catch (error) {
      console.error('Error updating manual cash:', error);
      throw new Error(`Failed to update manual cash: ${getErrorMessage(error)}`);
    }
  });

// Server function to get manual cash amount for an account - runs ONLY on server
export const getManualCashServerFn = createServerFn({ method: 'POST' })
  .validator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
    const { accountId } = data;

    if (!accountId) {
      throw new Error('Invalid request: accountId required');
    }

    const { user } = await requireAuth();
    // Verify that the account belongs to the authenticated user

    const account = await dbProxy
      .select({ userId: schema.account.userId })
      .from(schema.account)
      .where(eq(schema.account.id, accountId))
      .limit(1);

    if (account.length === 0 || account[0].userId !== user.id) {
      throw new Error('Access denied: Account not found or does not belong to you');
    }

    try {
      // Get MCASH holding for this account
      const manualCashHolding = await dbProxy
        .select({
          qty: schema.holding.qty,
        })
        .from(schema.holding)
        .where(and(eq(schema.holding.accountId, accountId), eq(schema.holding.ticker, 'MCASH')))
        .limit(1);

      const amount = manualCashHolding.length > 0 ? manualCashHolding[0].qty : 0;

      return { amount };
    } catch (error) {
      console.error('Error getting manual cash:', error);
      throw new Error(`Failed to get manual cash: ${getErrorMessage(error)}`);
    }
  });

// Trade metrics calculation functions - moved from client-side to server for performance
interface TradeData {
  securityId?: string;
  ticker?: string;
  action: 'BUY' | 'SELL';
  qty: number;
  estValue: number;
}

const calculateTradeMetrics = {
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
    }
    const netValue = calculateTradeMetrics.getNetValue(trades, tickers);
    postTradeValue = currentValue + netValue;
    return postTradeValue - targetValue;
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

// Server function to calculate trade metrics - runs ONLY on server
export const calculateTradeMetricsServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      currentValue: number;
      targetValue?: number;
      targetPercent?: number;
      trades: TradeData[];
      tickers: string[];
      totalCurrentValue: number;
      totalTradeValue?: number;
      isCashSleeve?: boolean;
      totalCashValue?: number;
      calculationType:
        | 'postTradePercent'
        | 'postTradeDiff'
        | 'postTradeDiffPercent'
        | 'netQty'
        | 'netValue';
    }) => data,
  )
  .handler(async ({ data }) => {
    const {
      currentValue,
      targetValue = 0,
      targetPercent = 0,
      trades,
      tickers,
      totalCurrentValue,
      totalTradeValue,
      isCashSleeve = false,
      totalCashValue,
      calculationType,
    } = data;

    try {
      switch (calculationType) {
        case 'postTradePercent': {
          const { postTradePercent } = calculateTradeMetrics.getPostTradeMetrics(
            currentValue,
            trades,
            tickers,
            totalCurrentValue,
            totalTradeValue,
            isCashSleeve,
            totalCashValue,
          );
          return { result: postTradePercent };
        }
        case 'postTradeDiff': {
          const result = calculateTradeMetrics.getPostTradeDiff(
            currentValue,
            targetValue,
            trades,
            tickers,
            isCashSleeve,
            totalCashValue,
          );
          return { result };
        }
        case 'postTradeDiffPercent': {
          const { postTradePercent } = calculateTradeMetrics.getPostTradeMetrics(
            currentValue,
            trades,
            tickers,
            totalCurrentValue,
            totalTradeValue,
            isCashSleeve,
            totalCashValue,
          );
          const result =
            targetPercent > 0
              ? ((postTradePercent - targetPercent) / targetPercent) * 100
              : postTradePercent;
          return { result };
        }
        case 'netQty': {
          const result = calculateTradeMetrics.getNetQty(trades, tickers);
          return { result };
        }
        case 'netValue': {
          const result = calculateTradeMetrics.getNetValue(trades, tickers);
          return { result };
        }
        default:
          throw new Error(`Unknown calculation type: ${calculationType}`);
      }
    } catch (error) {
      console.error('Error calculating trade metrics:', error);
      throw new Error(`Failed to calculate trade metrics: ${getErrorMessage(error)}`);
    }
  });
