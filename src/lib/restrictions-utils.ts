import type { WashSaleRestriction } from '../types/rebalance';

export interface RestrictionCheckResult {
  isRestricted: boolean;
  reason?: string;
  washSaleInfo?: WashSaleRestriction;
}

export interface RestrictionChecker {
  isSecurityRestricted(ticker: string): RestrictionCheckResult;
  getRestrictedTickers(): Set<string>;
  getAllRestrictions(): WashSaleRestriction[];
}

// Check if a security has wash sale risk based on transaction history (unified function for UI and rebalancing)
export interface Transaction {
  ticker: string;
  type: string;
  executedAt: Date | string;
  accountType?: string;
  accountName?: string;
  realizedGainLoss: number;
  [key: string]: unknown;
}

export interface WashSaleInfo {
  reason: string;
  restrictedUntil: Date;
  [key: string]: unknown;
}

export const checkTransactionHistoryForWashSale = (
  ticker: string,
  transactions: Transaction[] = [],
): { hasRisk: boolean; info: WashSaleInfo | null } => {
  if (!transactions || transactions.length === 0) {
    return { hasRisk: false, info: null };
  }

  const now = new Date();
  const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

  // Find sell transactions for this ticker in the last 31 days with losses in TAXABLE accounts
  const recentLossSells = transactions.filter((tx) => {
    const executedDate = new Date(tx.executedAt);
    const isRecentSell =
      tx.ticker === ticker && tx.type === 'SELL' && executedDate >= thirtyOneDaysAgo;

    // Only check taxable accounts for wash sale rules
    const isTaxableAccount =
      tx.accountType === 'TAXABLE' || tx.accountName?.toLowerCase().includes('taxable');

    // Check if it's a loss (negative realized gain/loss)
    const isLoss = tx.realizedGainLoss < 0;

    const isWashSaleCandidate = isRecentSell && isTaxableAccount && isLoss;

    // Only log if it's a potential wash sale candidate for debugging
    if (tx.ticker === ticker && isRecentSell && isWashSaleCandidate) {
      console.log(
        `🔍 WASH SALE DETECTED: ${ticker} sold at loss $${Math.abs(tx.realizedGainLoss / 100).toFixed(2)} on ${executedDate.toLocaleDateString()} in ${tx.accountName}`,
      );
    }

    return isWashSaleCandidate;
  });

  if (recentLossSells.length > 0) {
    const mostRecent = recentLossSells.sort(
      (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime(),
    )[0];

    const sellDate = new Date(mostRecent.executedAt);
    const daysAgo = Math.floor((now.getTime() - sellDate.getTime()) / (24 * 60 * 60 * 1000));

    const blockedUntil = new Date(sellDate.getTime() + 31 * 24 * 60 * 60 * 1000);

    return {
      hasRisk: true,
      info: {
        ticker,
        restrictedUntil: blockedUntil,
        reason: `Tax loss harvested on ${sellDate.toLocaleDateString()}, ${31 - daysAgo} days remaining`,
        soldDate: sellDate,
        daysAgo,
        daysRemaining: 31 - daysAgo,
        lossAmount: Math.abs(mostRecent.realizedGainLoss),
        accountId: mostRecent.accountId,
        accountName: mostRecent.accountName,
      },
    };
  }

  return { hasRisk: false, info: null };
};

export class WashSaleRestrictionChecker implements RestrictionChecker {
  private restrictedTickers: Set<string>;
  private restrictionMap: Map<string, WashSaleRestriction>;

  constructor(washSaleRestrictions: WashSaleRestriction[] = [], transactions: Transaction[] = []) {
    const now = new Date();

    // Combine database restrictions with transaction-based restrictions
    const allRestrictions: WashSaleRestriction[] = [...washSaleRestrictions];

    // Check each transaction to see if it creates a wash sale restriction
    if (transactions && transactions.length > 0) {
      const processedTickers = new Set<string>();

      for (const tx of transactions) {
        if (!processedTickers.has(tx.ticker)) {
          processedTickers.add(tx.ticker);
          const transactionRisk = checkTransactionHistoryForWashSale(tx.ticker, transactions);

          if (transactionRisk.hasRisk && transactionRisk.info) {
            const info = transactionRisk.info as WashSaleInfo;
            console.log(`🚫 WASH SALE BLOCKED: ${tx.ticker} - ${info.reason}`);
            // Add transaction-based restriction if not already in database restrictions
            const existingDbRestriction = washSaleRestrictions.find((r) => r.ticker === tx.ticker);
            if (!existingDbRestriction) {
              allRestrictions.push({
                ticker: tx.ticker,
                restrictedUntil: info.restrictedUntil,
                reason: info.reason,
              });
            }
          }
        }
      }
    }

    // Only include restrictions that are still active
    const activeRestrictions = allRestrictions.filter((r) => {
      const restrictedUntil = new Date(r.restrictedUntil);
      return now <= restrictedUntil;
    });

    this.restrictedTickers = new Set(activeRestrictions.map((r) => r.ticker));
    this.restrictionMap = new Map(activeRestrictions.map((r) => [r.ticker, r]));

    if (this.restrictedTickers.size > 0) {
      console.log(
        `🚫 WASH SALE RESTRICTED SECURITIES: ${Array.from(this.restrictedTickers).join(', ')}`,
      );
    }
  }

  isSecurityRestricted(ticker: string): RestrictionCheckResult {
    if (this.restrictedTickers.has(ticker)) {
      const restriction = this.restrictionMap.get(ticker);
      if (restriction) {
        // Check if the restriction is still active
        const now = new Date();
        const restrictedUntil = new Date(restriction.restrictedUntil);

        if (now <= restrictedUntil) {
          return {
            isRestricted: true,
            reason: 'Wash sale restriction',
            washSaleInfo: restriction,
          };
        }
      }
    }
    return {
      isRestricted: false,
    };
  }

  getRestrictedTickers(): Set<string> {
    return new Set(this.restrictedTickers);
  }

  getAllRestrictions(): WashSaleRestriction[] {
    return Array.from(this.restrictionMap.values());
  }
}

export function createRestrictionChecker(
  washSaleRestrictions: WashSaleRestriction[] = [],
  transactions: Transaction[] = [],
): RestrictionChecker {
  return new WashSaleRestrictionChecker(washSaleRestrictions, transactions);
}

export function isSecurityPurchasable(
  ticker: string,
  restrictionChecker: RestrictionChecker,
): boolean {
  const restrictionResult = restrictionChecker.isSecurityRestricted(ticker);

  if (restrictionResult.isRestricted) {
    return false;
  }

  return true;
}

export function validateTradeAgainstRestrictions(
  ticker: string,
  action: 'BUY' | 'SELL',
  restrictionChecker: RestrictionChecker,
): { isAllowed: boolean; reason?: string } {
  const restrictionResult = restrictionChecker.isSecurityRestricted(ticker);

  if (restrictionResult.isRestricted && action === 'BUY') {
    console.log(`🚫 BLOCKED: Cannot BUY ${ticker} - ${restrictionResult.reason}`);
    return {
      isAllowed: false,
      reason: `Wash sale restriction prevents buying ${ticker}`,
    };
  }

  // Sells are generally allowed even for restricted securities
  return { isAllowed: true };
}

export function findLowestRankedPurchasableSecurity<
  T extends { securityId: string; rank?: number; targetPct?: number },
>(
  securities: Array<T>,
  restrictionChecker: RestrictionChecker,
  requirePositiveTarget: boolean = false,
): T | null {
  const sortedSecurities = [...securities].sort((a, b) => {
    const rankA = a.rank || 999;
    const rankB = b.rank || 999;
    return rankA - rankB;
  });

  for (const security of sortedSecurities) {
    const restrictionResult = restrictionChecker.isSecurityRestricted(security.securityId);

    if (restrictionResult.isRestricted) {
      continue;
    }

    if (
      requirePositiveTarget &&
      'targetPct' in security &&
      (!security.targetPct || security.targetPct <= 0)
    ) {
      continue;
    }

    return security;
  }

  return null;
}

export function filterPurchasableSecurities<T extends { securityId: string }>(
  securities: Array<T>,
  restrictionChecker: RestrictionChecker,
): Array<T> {
  return securities.filter((security) =>
    isSecurityPurchasable(security.securityId, restrictionChecker),
  );
}
