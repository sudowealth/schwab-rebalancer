import type {
  HoldingPost,
  RebalanceMethod,
  SecurityReplacement,
  SleeveSummary,
  Trade,
  WashSaleRestriction,
} from '~/types/rebalance';
import { CASH_TICKER } from '~/lib/constants';
import { logError, RebalanceError, ValidationError } from '~/lib/error-handler';
import type { Transaction } from './restrictions-utils';
import { createRestrictionChecker, validateTradeAgainstRestrictions } from './restrictions-utils';

export interface RebalanceSecurityData {
  securityId: string;
  currentQty: number;
  targetPct: number;
  price: number;
  accountId: string;
  isTaxable: boolean;
  unrealizedGain?: number;
  rank?: number;
  isLegacy?: boolean;
}

export interface InternalRebalanceSleeveData {
  sleeveId: string;
  securities: RebalanceSecurityData[];
}

export interface RebalanceSleeveDataNew {
  sleeveId: string;
  targetValue: number;
  targetPct: number;
  currentValue: number;
  securities: RebalanceSecurityData[];
}

export function executeRebalance(
  portfolioId: string,
  method: RebalanceMethod,
  sleeves: RebalanceSleeveDataNew[],
  washSaleRestrictions: WashSaleRestriction[] = [],
  replacementCandidates: SecurityReplacement[] = [],
  allowOverinvestment = false,
  maxOverinvestmentPercent = 5.0,
  transactions: Transaction[] = [],
  cashAmount?: number,
) {
  try {
    // Validate inputs
    if (!portfolioId?.trim()) {
      throw new ValidationError('Portfolio ID is required', 'portfolioId');
    }

    if (!sleeves || sleeves.length === 0) {
      throw new ValidationError('At least one sleeve is required', 'sleeves');
    }

    if (maxOverinvestmentPercent < 0 || maxOverinvestmentPercent > 100) {
      throw new ValidationError(
        'Overinvestment percentage must be between 0 and 100',
        'maxOverinvestmentPercent',
      );
    }

    if (method === 'investCash' && (!cashAmount || cashAmount <= 0)) {
      throw new ValidationError('Cash amount must be positive for investCash method', 'cashAmount');
    }

    logError(null, `Starting rebalance for portfolio ${portfolioId}`, {
      method,
      sleevesCount: sleeves.length,
      allowOverinvestment,
      maxOverinvestmentPercent,
      cashAmount,
    });

    let trades: Trade[] = [];

    switch (method) {
      case 'allocation':
        trades = calculateSleeveBasedAllocationRebalance(
          sleeves,
          washSaleRestrictions,
          allowOverinvestment,
          maxOverinvestmentPercent,
          transactions,
        );
        break;
      case 'tlhSwap': {
        const allSecurities = sleeves.flatMap((sleeve) => sleeve.securities);
        trades = calculateTLHSwap(
          allSecurities,
          washSaleRestrictions,
          replacementCandidates,
          transactions,
        );
        break;
      }
      case 'tlhRebalance': {
        const allSecuritiesForTLH = sleeves.flatMap((sleeve) => sleeve.securities);
        trades = calculateTLHAndRebalance(
          allSecuritiesForTLH,
          washSaleRestrictions,
          replacementCandidates,
          transactions,
        );
        break;
      }
      case 'investCash': {
        trades = calculateInvestCash(sleeves, cashAmount || 0, washSaleRestrictions, transactions);
        break;
      }
      default:
        throw new ValidationError(`Unknown rebalance method: ${method}`, 'method');
    }

    const allSecuritiesForPost = sleeves.flatMap((sleeve) => sleeve.securities);
    const postHoldings = calculatePostHoldings(allSecuritiesForPost, trades);

    const oldFormatSleeves = sleeves.map((sleeve) => ({
      sleeveId: sleeve.sleeveId,
      securities: sleeve.securities,
    }));
    const sleeveSummaries = calculateSleeveSummaries(oldFormatSleeves, trades, postHoldings);

    logError(null, `Rebalance completed for portfolio ${portfolioId}`, {
      tradesGenerated: trades.length,
      totalValue: trades.reduce((sum, t) => sum + Math.abs(t.estValue), 0),
    });

    return {
      trades,
      postHoldings,
      sleeves: sleeveSummaries,
    };
  } catch (error) {
    logError(error, 'Rebalance execution failed', { portfolioId, method });
    if (error instanceof ValidationError) throw error;
    throw new RebalanceError('Failed to execute rebalance', portfolioId, error);
  }
}

function calculateAllocationRebalance(
  securities: RebalanceSecurityData[],
  washSaleRestrictions: WashSaleRestriction[] = [],
  transactions: Transaction[] = [],
): Trade[] {
  const trades: Trade[] = [];
  const restrictionChecker = createRestrictionChecker(washSaleRestrictions, transactions);

  // Calculate portfolio MV
  const portfolioMV = securities.reduce((sum, sec) => sum + sec.currentQty * sec.price, 0);

  if (portfolioMV === 0) return trades;

  // Create working copy of securities with current quantities
  const workingSecurities = securities.map((sec) => ({
    ...sec,
    workingQty: sec.currentQty,
  }));

  let availableCash = 0;

  // PASS 1: SELL overweight positions
  workingSecurities.forEach((sec) => {
    const currentVal = sec.workingQty * sec.price;
    const targetVal = (sec.targetPct / 100) * portfolioMV; // Convert percentage to decimal

    if (currentVal > targetVal + 0.01) {
      // Handle legacy securities specially - don't sell if they have restrictions or unrealized gains
      if (sec.isLegacy) {
        const isRestricted = restrictionChecker.isSecurityRestricted(sec.securityId).isRestricted;
        const hasUnrealizedGain = sec.unrealizedGain && sec.unrealizedGain > 0;
        const wouldIncurTaxableGain = sec.isTaxable && hasUnrealizedGain;

        // Skip selling legacy security if it's restricted OR would incur taxable gain
        if (isRestricted || wouldIncurTaxableGain) {
          console.log(
            `🛡️ Skipping legacy security ${sec.securityId} - restricted: ${isRestricted}, taxable gain: ${wouldIncurTaxableGain}`,
          );
          return;
        }
      }

      const extraVal = currentVal - targetVal;
      const rawQty = extraVal / sec.price;

      // Check if this is a full exit
      const isFullExit = Math.abs(targetVal) < 0.01;
      const qtyToSell = isFullExit ? sec.workingQty : Math.floor(rawQty);

      if (qtyToSell > 0) {
        const sellValue = qtyToSell * sec.price;

        trades.push({
          accountId: sec.accountId,
          securityId: sec.securityId,
          action: 'SELL',
          qty: -qtyToSell, // Negative for sells
          estPrice: sec.price,
          estValue: -sellValue, // Negative for sells
        });

        availableCash += sellValue;
        sec.workingQty -= qtyToSell;
      }
    }
  });

  // PASS 2: BUY underweight positions
  const postSellMV = workingSecurities.reduce((sum, sec) => sum + sec.workingQty * sec.price, 0);

  // Calculate shortfalls and rank by amount
  const underweights = workingSecurities
    .map((sec) => {
      const currentVal = sec.workingQty * sec.price;
      const targetVal = (sec.targetPct / 100) * postSellMV; // Convert percentage to decimal
      const shortfall = targetVal - currentVal;
      return { ...sec, shortfall };
    })
    .filter((sec) => sec.shortfall > 0.01)
    .sort((a, b) => b.shortfall - a.shortfall);

  // Buy underweights in order of priority
  underweights.forEach((sec) => {
    if (availableCash >= sec.price) {
      const buyVal = Math.min(sec.shortfall, availableCash);
      const buyQty = Math.floor(buyVal / sec.price);

      if (buyQty > 0) {
        // Validate trade against wash sale restrictions
        const validation = validateTradeAgainstRestrictions(
          sec.securityId,
          'BUY',
          restrictionChecker,
        );

        if (!validation.isAllowed) {
          console.log(`🚫 [ALLOCATION] Trade blocked: ${validation.reason}`);
          return; // Skip this security
        }

        const actualBuyVal = buyQty * sec.price;

        trades.push({
          accountId: sec.accountId,
          securityId: sec.securityId,
          action: 'BUY',
          qty: buyQty, // Positive for buys
          estPrice: sec.price,
          estValue: actualBuyVal, // Positive for buys
        });

        availableCash -= actualBuyVal;
        sec.workingQty += buyQty;
      }
    }
  });

  return consolidateTrades(trades);
}

function deployCashOverinvestment(
  sleeves: RebalanceSleeveDataNew[],
  existingTrades: Trade[],
  accountCashMap: Map<string, number>,
  washSaleRestrictions: WashSaleRestriction[] = [],
  maxOverinvestmentPercent = 5.0,
  transactions: Transaction[] = [],
): Trade[] {
  const additionalTrades: Trade[] = [];
  const restrictionChecker = createRestrictionChecker(washSaleRestrictions, transactions);

  // Check total available cash across all accounts
  let totalAvailableCash = 0;
  for (const [, cashAmount] of accountCashMap) {
    totalAvailableCash += Math.max(0, cashAmount); // Only count positive cash
  }

  if (totalAvailableCash < 1.0) {
    console.log('💰 Less than $1 remaining cash, skipping overinvestment deployment');
    return additionalTrades;
  }

  console.log(
    `💰 Deploying ${totalAvailableCash.toFixed(2)} remaining cash with max ${maxOverinvestmentPercent}% overinvestment`,
  );

  // Filter eligible sleeves (non-cash, has securities)
  const eligibleSleeves = sleeves.filter(
    (sleeve) =>
      sleeve.sleeveId !== 'cash' && sleeve.securities.length > 0 && sleeve.targetValue > 0,
  );

  if (eligibleSleeves.length === 0) {
    return additionalTrades;
  }

  // Track current values including existing trades
  const sleeveCurrentValues = new Map<string, number>();
  eligibleSleeves.forEach((sleeve) => {
    let currentValue = sleeve.currentValue;
    // Add value from existing trades
    existingTrades.forEach((trade) => {
      const sleeveSecurity = sleeve.securities.find((s) => s.securityId === trade.securityId);
      if (sleeveSecurity) {
        currentValue += trade.estValue;
      }
    });
    sleeveCurrentValues.set(sleeve.sleeveId, currentValue);
  });

  // Deploy cash using batch optimization approach
  while (totalAvailableCash >= 1.0) {
    // Step 1: Generate all possible purchases (one share each)
    const possiblePurchases: {
      sleeveId: string;
      securityId: string;
      price: number;
      accountId: string;
      overinvestmentAfter: number;
      totalDeviationAfter: number;
    }[] = [];

    for (const sleeve of eligibleSleeves) {
      const currentValue = sleeveCurrentValues.get(sleeve.sleeveId) || 0;

      // Sort securities by rank (lower rank = higher priority)
      const sortedSecurities = [...sleeve.securities].sort((a, b) => {
        const rankA = a.rank || 999;
        const rankB = b.rank || 999;
        return rankA - rankB;
      });

      // Reduced debug for cash deployment
      // console.log(`💰 [CASH DEPLOYMENT DEBUG] Sleeve ${sleeve.sleeveId} securities:`,
      //   sortedSecurities.map(s => ({
      //     id: s.securityId,
      //     targetPct: s.targetPct,
      //     rank: s.rank || 999,
      //     restricted: restrictedTickers.has(s.securityId),
      //     price: s.price
      //   }))
      // );

      // Consider buying the highest priority (lowest rank) security that's not wash sale restricted
      const security = sortedSecurities.find(
        (s) =>
          !restrictionChecker.isSecurityRestricted(s.securityId).isRestricted && s.targetPct > 0,
      );

      // console.log(`💰 [CASH DEPLOYMENT DEBUG] Selected security for sleeve ${sleeve.sleeveId}:`,
      //   security ? { id: security.securityId, targetPct: security.targetPct, rank: security.rank || 999 } : 'NONE'
      // );

      if (!security) continue;

      // Check if the specific account has enough cash for this purchase
      const accountCash = accountCashMap.get(security.accountId) || 0;
      if (accountCash < security.price) continue;

      // Calculate overinvestment percentage if we buy this security
      const newSleeveValue = currentValue + security.price;
      const overinvestmentPercent =
        ((newSleeveValue - sleeve.targetValue) / sleeve.targetValue) * 100;

      // Skip if this would exceed max overinvestment
      if (overinvestmentPercent > maxOverinvestmentPercent) continue;

      // Calculate TOTAL portfolio deviation after this purchase
      let totalSquaredDeviation = 0;
      for (const evalSleeve of eligibleSleeves) {
        const evalCurrentValue = sleeveCurrentValues.get(evalSleeve.sleeveId) || 0;
        const evalValueAfterPurchase =
          evalSleeve.sleeveId === sleeve.sleeveId
            ? evalCurrentValue + security.price
            : evalCurrentValue;
        const deviationPercent =
          ((evalValueAfterPurchase - evalSleeve.targetValue) / evalSleeve.targetValue) * 100;
        totalSquaredDeviation += deviationPercent * deviationPercent;
      }

      possiblePurchases.push({
        sleeveId: sleeve.sleeveId,
        securityId: security.securityId,
        price: security.price,
        accountId: security.accountId,
        overinvestmentAfter: overinvestmentPercent,
        totalDeviationAfter: totalSquaredDeviation,
      });
    }

    // Step 2: No valid purchases available
    if (possiblePurchases.length === 0) {
      console.log('💰 No valid purchases remaining within overinvestment limits');
      break;
    }

    // Step 3: Sort by total deviation (lower is better) and execute the best one
    possiblePurchases.sort((a, b) => a.totalDeviationAfter - b.totalDeviationAfter);
    const bestPurchase = possiblePurchases[0];

    // Validate trade against wash sale restrictions
    const validation = validateTradeAgainstRestrictions(
      bestPurchase.securityId,
      'BUY',
      restrictionChecker,
    );

    if (!validation.isAllowed) {
      console.log(`🚫 [CASH DEPLOYMENT] Trade blocked: ${validation.reason}`);
      continue;
    }

    // Execute the best purchase
    additionalTrades.push({
      accountId: bestPurchase.accountId,
      securityId: bestPurchase.securityId,
      action: 'BUY',
      qty: 1,
      estPrice: bestPurchase.price,
      estValue: bestPurchase.price,
    });

    // Update tracking
    totalAvailableCash -= bestPurchase.price;
    const currentValue = sleeveCurrentValues.get(bestPurchase.sleeveId) || 0;
    sleeveCurrentValues.set(bestPurchase.sleeveId, currentValue + bestPurchase.price);

    // Update account cash tracking
    const accountCash = accountCashMap.get(bestPurchase.accountId) || 0;
    accountCashMap.set(bestPurchase.accountId, accountCash - bestPurchase.price);

    console.log(
      `💰 [CASH DEPLOYMENT] Deployed $${bestPurchase.price.toFixed(2)} to ${bestPurchase.securityId} (${bestPurchase.overinvestmentAfter.toFixed(2)}% overinvestment, deviation score: ${bestPurchase.totalDeviationAfter.toFixed(2)})`,
    );
  }

  console.log(
    `💰 Cash deployment complete. Remaining: $${totalAvailableCash.toFixed(2)}, Additional trades: ${additionalTrades.length}`,
  );

  return additionalTrades;
}

function calculateSleeveBasedAllocationRebalance(
  sleeves: RebalanceSleeveDataNew[],
  washSaleRestrictions: WashSaleRestriction[] = [],
  allowOverinvestment = false,
  maxOverinvestmentPercent = 5.0,
  transactions: Transaction[] = [],
): Trade[] {
  const trades: Trade[] = [];
  const restrictionChecker = createRestrictionChecker(washSaleRestrictions, transactions);

  console.log('🎯 Sleeve-Based Allocation Rebalance Debug:');
  console.log('📊 Total sleeves:', sleeves.length);
  console.log(
    '📊 Sleeve details:',
    sleeves.map((s) => ({
      id: s.sleeveId,
      targetPct: s.targetPct,
      targetValue: s.targetValue.toFixed(2),
      currentValue: s.currentValue.toFixed(2),
      securitiesCount: s.securities.length,
    })),
  );

  const restrictedTickers = restrictionChecker.getRestrictedTickers();
  if (restrictedTickers.size > 0) {
    console.log('🚫 Wash sale restricted tickers:', Array.from(restrictedTickers));
  }

  // Initialize cash tracking for this operation
  // Allocation method should only use proceeds from sells, not pre-existing cash
  const accountCashMap = new Map<string, number>();
  console.log('💰 Starting account cash map at $0 for all accounts (allocation method)');

  // Handle sells first (overweight sleeves)
  for (const sleeve of sleeves) {
    // Skip Cash sleeve - it will be updated automatically based on other trades
    if (sleeve.sleeveId === 'cash') {
      console.log('💰 Skipping Cash sleeve - will be updated based on trade flows');
      continue;
    }

    const diff = sleeve.currentValue - sleeve.targetValue;

    if (diff > 0.01) {
      // Sleeve is overweight - sell to get as close to target as possible
      // Sort securities by rank for processing
      const sortedSecurities = [...sleeve.securities].sort((a, b) => {
        const rankA = a.rank || 999;
        const rankB = b.rank || 999;
        return rankA - rankB;
      });

      const sellOrder = [...sortedSecurities].reverse(); // Highest rank first
      let remainingSellValue = diff;

      for (const security of sellOrder) {
        if (remainingSellValue <= 0.01 || security.currentQty <= 0) continue;

        // Handle legacy securities specially - don't sell if they have restrictions or unrealized gains
        if (security.isLegacy) {
          const isRestricted = restrictionChecker.isSecurityRestricted(
            security.securityId,
          ).isRestricted;
          const hasUnrealizedGain = security.unrealizedGain && security.unrealizedGain > 0;
          const wouldIncurTaxableGain = security.isTaxable && hasUnrealizedGain;

          // Skip selling legacy security if it's restricted OR would incur taxable gain
          if (isRestricted || wouldIncurTaxableGain) {
            console.log(
              `🛡️ Skipping legacy security ${security.securityId} - restricted: ${isRestricted}, taxable gain: ${wouldIncurTaxableGain}`,
            );
            continue;
          }
        }

        const securityValue = security.currentQty * security.price;

        // Calculate optimal sell quantity that minimizes deviation from target
        const maxSellValue = Math.min(remainingSellValue, securityValue);
        const maxSellQty = Math.floor(maxSellValue / security.price);

        if (maxSellQty > 0) {
          // Try different sell quantities to find the one that gets closest to target sleeve value
          let bestSellQty = maxSellQty;
          const currentSleeveValue = sleeve.currentValue;
          const targetSleeveValue = sleeve.targetValue;

          // Calculate deviation from target if we sell maxSellQty shares
          const valueAfterMaxSell = currentSleeveValue - maxSellQty * security.price;
          let bestDeviation = Math.abs(valueAfterMaxSell - targetSleeveValue);

          // Also consider selling one more share if it gets us closer to target
          if (maxSellQty < security.currentQty) {
            const altSellQty = maxSellQty + 1;
            const valueAfterAltSell = currentSleeveValue - altSellQty * security.price;
            const altDeviation = Math.abs(valueAfterAltSell - targetSleeveValue);

            if (altDeviation < bestDeviation) {
              bestSellQty = altSellQty;
              bestDeviation = altDeviation;
            }
          }

          // Also consider selling one less share if it gets us closer to target
          if (maxSellQty > 1) {
            const altSellQty = maxSellQty - 1;
            const valueAfterAltSell = currentSleeveValue - altSellQty * security.price;
            const altDeviation = Math.abs(valueAfterAltSell - targetSleeveValue);

            if (altDeviation < bestDeviation) {
              bestSellQty = altSellQty;
              bestDeviation = altDeviation;
            }
          }

          const actualSellValue = bestSellQty * security.price;

          trades.push({
            accountId: security.accountId,
            securityId: security.securityId,
            action: 'SELL',
            qty: -bestSellQty,
            estPrice: security.price,
            estValue: -actualSellValue,
          });

          // Update cash tracking - selling adds cash to the account
          const currentCash = accountCashMap.get(security.accountId) || 0;
          const newCash = currentCash + actualSellValue;
          accountCashMap.set(security.accountId, newCash);
          console.log(
            `💰 [SELL] Account ${security.accountId}: $${currentCash.toFixed(2)} + $${actualSellValue.toFixed(2)} = $${newCash.toFixed(2)}`,
          );

          remainingSellValue -= actualSellValue;
        }
      }
    }
  }

  // Phase 1: Buy lowest ranked security per sleeve up to target (accounting for wash sale restrictions)
  console.log('🔺 Phase 1: Buying lowest ranked securities for each underweight sleeve');

  // Track sleeve current values after sells but before buys
  const sleeveCurrentValues = new Map<string, number>();
  sleeves.forEach((sleeve) => {
    if (sleeve.sleeveId !== 'cash') {
      // Calculate current value after sells
      let currentValue = sleeve.currentValue;
      trades.forEach((trade) => {
        const sleeveSecurity = sleeve.securities.find((s) => s.securityId === trade.securityId);
        if (sleeveSecurity && trade.action === 'SELL') {
          currentValue += trade.estValue; // estValue is negative for sells
        }
      });
      sleeveCurrentValues.set(sleeve.sleeveId, currentValue);
    }
  });

  for (const sleeve of sleeves) {
    if (sleeve.sleeveId === 'cash') continue;

    // Skip sleeves with zero target percentage (like "Unassigned")
    if (sleeve.targetPct <= 0) {
      console.log(
        `🚫 [PHASE 1] Skipping sleeve ${sleeve.sleeveId} with targetPct: ${sleeve.targetPct}%`,
      );
      continue;
    }

    const currentValue = sleeveCurrentValues.get(sleeve.sleeveId) || sleeve.currentValue;
    if (currentValue >= sleeve.targetValue - 0.01) continue; // Not underweight

    const targetAmount = sleeve.targetValue - currentValue;

    // console.log(
    //   `🔺 [PHASE 1] ${sleeve.sleeveId}: needs $${targetAmount.toFixed(2)} (current: $${currentValue.toFixed(2)}, target: $${sleeve.targetValue.toFixed(2)})`
    // );

    // Sort securities by rank to find lowest rank available
    const sortedSecurities = [...sleeve.securities].sort((a, b) => {
      const rankA = a.rank || 999;
      const rankB = b.rank || 999;
      return rankA - rankB;
    });

    // Find the lowest ranked security that's not wash sale restricted
    // and that can be purchased using cash from ANY account with sufficient balance
    let selectedSecurity = null as (typeof sortedSecurities)[number] | null;
    let purchaseAccountId: string | null = null;
    for (const sec of sortedSecurities) {
      const restriction = restrictionChecker.isSecurityRestricted(sec.securityId);
      if (restriction.isRestricted) continue;
      // Prefer buying in the security's own account if it has cash
      const ownCash = accountCashMap.get(sec.accountId) || 0;
      if (ownCash >= sec.price) {
        selectedSecurity = sec;
        purchaseAccountId = sec.accountId;
        break;
      }
      // Otherwise, try any other account with sufficient cash
      for (const [accId, cash] of accountCashMap.entries()) {
        if (cash >= sec.price) {
          selectedSecurity = sec;
          purchaseAccountId = accId;
          break;
        }
      }
      if (selectedSecurity) break;
    }

    if (!selectedSecurity || !purchaseAccountId) {
      // console.log(
      //   `⚠️ [PHASE 1] No available securities for sleeve ${sleeve.sleeveId} (all restricted)`
      // );
      continue;
    }

    // console.log(
    //   `🔺 [PHASE 1] Selected security for ${sleeve.sleeveId}: ${selectedSecurity.securityId} (rank ${selectedSecurity.rank})`
    // );

    // We have confirmed available cash in purchaseAccountId for at least one share
    const availableCash = accountCashMap.get(purchaseAccountId) || 0;

    // Buy up to target but not beyond
    const maxBuyQtyByValue = Math.floor(targetAmount / selectedSecurity.price);
    const maxBuyQtyByCash = Math.floor(availableCash / selectedSecurity.price);
    const buyQty = Math.min(maxBuyQtyByValue, maxBuyQtyByCash);

    if (buyQty > 0) {
      // Validate trade against wash sale restrictions
      const validation = validateTradeAgainstRestrictions(
        selectedSecurity.securityId,
        'BUY',
        restrictionChecker,
      );

      if (!validation.isAllowed) {
        // console.log(`🚫 [PHASE 1] Trade blocked: ${validation.reason}`);
        continue;
      }

      const actualBuyValue = buyQty * selectedSecurity.price;
      // console.log(
      //   `🔺 [PHASE 1] Buying ${buyQty} shares of ${selectedSecurity.securityId} (rank ${selectedSecurity.rank || 999}) for sleeve ${sleeve.sleeveId} - $${actualBuyValue.toFixed(2)}`
      // );

      trades.push({
        accountId: purchaseAccountId,
        securityId: selectedSecurity.securityId,
        action: 'BUY',
        qty: buyQty,
        estPrice: selectedSecurity.price,
        estValue: actualBuyValue,
      });

      // Update cash tracking
      const currentCash = accountCashMap.get(purchaseAccountId) || 0;
      const newCash = currentCash - actualBuyValue;
      accountCashMap.set(purchaseAccountId, newCash);
      // console.log(
      //   `💰 [PHASE 1] Account ${selectedSecurity.accountId}: $${currentCash.toFixed(2)} - $${actualBuyValue.toFixed(2)} = $${newCash.toFixed(2)}`
      // );

      // Update sleeve current value for phase 2
      sleeveCurrentValues.set(sleeve.sleeveId, currentValue + actualBuyValue);
    }
  }

  // Check if any sleeves were processed in Phase 1
  const processedSleeves = sleeves.filter((s) => s.sleeveId !== 'cash' && s.targetPct > 0);
  console.log('🔍 Phase 1 completion - processed sleeves:', processedSleeves.length);
  console.log(
    '🔍 All non-cash sleeves:',
    sleeves.filter((s) => s.sleeveId !== 'cash').map((s) => `${s.sleeveId}: ${s.targetPct}%`),
  );

  if (processedSleeves.length === 0) {
    const allSleeveTargets = sleeves
      .filter((s) => s.sleeveId !== 'cash')
      .map((s) => `${s.sleeveId}: ${(s.targetPct * 100).toFixed(2)}%`) // Show as percentage
      .join(', ');
    throw new ValidationError(
      `No sleeves can be processed for rebalancing. All sleeves have zero or negative target percentages. Sleeve targets: ${allSleeveTargets}`,
      'sleeves',
    );
  }

  // Phase 2: Apply existing buy logic for least absolute deviation across ALL sleeves
  console.log('🔺 Phase 2: Applying optimal buy logic for least absolute deviation');

  // Continue buying while we have cash, optimizing for least absolute deviation
  let totalAvailableCash = 0;
  for (const [, cashAmount] of accountCashMap) {
    totalAvailableCash += Math.max(0, cashAmount);
  }

  console.log(`🔺 [PHASE 2] Total available cash: $${totalAvailableCash.toFixed(2)}`);

  while (totalAvailableCash >= 1.0) {
    // Generate all possible purchases (one share each) and calculate their impact on total deviation
    const possiblePurchases: {
      sleeveId: string;
      securityId: string;
      price: number;
      accountId: string;
      totalDeviationAfter: number;
    }[] = [];

    // Consider all non-cash sleeves with positive targets for purchases
    for (const sleeve of sleeves) {
      if (sleeve.sleeveId === 'cash') continue;

      // Skip sleeves with zero target percentage (like "Unassigned")
      if (sleeve.targetPct <= 0) {
        console.log(
          `🚫 [PHASE 2] Skipping sleeve ${sleeve.sleeveId} with targetPct: ${sleeve.targetPct}%`,
        );
        continue;
      }

      // Sort securities by rank to find lowest rank available
      const sortedSecurities = [...sleeve.securities].sort((a, b) => {
        const rankA = a.rank || 999;
        const rankB = b.rank || 999;
        return rankA - rankB;
      });

      // Find the lowest ranked security that's not wash sale restricted
      // and that can be purchased using cash from ANY account with sufficient balance
      let selectedSecurity = null as (typeof sortedSecurities)[number] | null;
      let purchaseAccountId: string | null = null;
      for (const sec of sortedSecurities) {
        const restriction = restrictionChecker.isSecurityRestricted(sec.securityId);
        if (restriction.isRestricted) continue;
        const ownCash = accountCashMap.get(sec.accountId) || 0;
        if (ownCash >= sec.price) {
          selectedSecurity = sec;
          purchaseAccountId = sec.accountId;
          break;
        }
        for (const [accId, cash] of accountCashMap.entries()) {
          if (cash >= sec.price) {
            selectedSecurity = sec;
            purchaseAccountId = accId;
            break;
          }
        }
        if (selectedSecurity) break;
      }

      if (!selectedSecurity || !purchaseAccountId) continue;

      // Calculate TOTAL portfolio deviation after this purchase
      let totalSquaredDeviation = 0;
      for (const evalSleeve of sleeves) {
        if (evalSleeve.sleeveId === 'cash') continue;

        const evalCurrentValue =
          sleeveCurrentValues.get(evalSleeve.sleeveId) || evalSleeve.currentValue;
        const evalValueAfterPurchase =
          evalSleeve.sleeveId === sleeve.sleeveId
            ? evalCurrentValue + selectedSecurity.price
            : evalCurrentValue;
        const deviationDollars = Math.abs(evalValueAfterPurchase - evalSleeve.targetValue);
        totalSquaredDeviation += deviationDollars * deviationDollars;
      }

      possiblePurchases.push({
        sleeveId: sleeve.sleeveId,
        securityId: selectedSecurity.securityId,
        price: selectedSecurity.price,
        accountId: purchaseAccountId,
        totalDeviationAfter: totalSquaredDeviation,
      });
    }

    // No valid purchases available
    if (possiblePurchases.length === 0) {
      console.log('🔺 [PHASE 2] No valid purchases remaining');
      break;
    }

    // Sort by total deviation (lower is better) and execute the best one
    possiblePurchases.sort((a, b) => a.totalDeviationAfter - b.totalDeviationAfter);
    const bestPurchase = possiblePurchases[0];

    // Validate trade against wash sale restrictions
    const validation = validateTradeAgainstRestrictions(
      bestPurchase.securityId,
      'BUY',
      restrictionChecker,
    );

    if (!validation.isAllowed) {
      continue;
    }

    // Execute the best purchase
    trades.push({
      accountId: bestPurchase.accountId,
      securityId: bestPurchase.securityId,
      action: 'BUY',
      qty: 1,
      estPrice: bestPurchase.price,
      estValue: bestPurchase.price,
    });

    // Update account cash tracking
    const accountCash = accountCashMap.get(bestPurchase.accountId) || 0;
    accountCashMap.set(bestPurchase.accountId, accountCash - bestPurchase.price);

    // Update tracking
    const currentSleeveValue = sleeveCurrentValues.get(bestPurchase.sleeveId) || 0;
    sleeveCurrentValues.set(bestPurchase.sleeveId, currentSleeveValue + bestPurchase.price);

    // Recalculate total available cash after this purchase
    totalAvailableCash = 0;
    for (const [, cashAmount] of accountCashMap) {
      totalAvailableCash += Math.max(0, cashAmount);
    }
  }

  console.log(`🔺 [PHASE 2] Complete. Remaining cash: $${totalAvailableCash.toFixed(2)}`);

  // Debug: Show remaining cash by account after Phase 2
  console.log(
    '💰 [PHASE 2] Remaining cash by account:',
    Array.from(accountCashMap.entries()).map(
      ([accountId, cash]) => `${accountId}: $${cash.toFixed(2)}`,
    ),
  );

  let totalTradeValue = trades.reduce((sum, t) => sum + t.estValue, 0);

  // Deploy remaining cash through strategic overinvestment if enabled
  if (allowOverinvestment && totalTradeValue < -1.0) {
    const additionalTrades = deployCashOverinvestment(
      sleeves,
      trades,
      accountCashMap,
      washSaleRestrictions,
      maxOverinvestmentPercent,
      transactions,
    );
    trades.push(...additionalTrades);

    // Recalculate total trade value after cash deployment
    const newTotalTradeValue = trades.reduce((sum, t) => sum + t.estValue, 0);
    totalTradeValue = newTotalTradeValue;
  }

  // Add virtual Cash trade to show cash flow
  // Negative totalTradeValue means we underbought (have excess cash remaining)
  // Positive totalTradeValue means we overbought (need more cash than we have)
  if (Math.abs(totalTradeValue) > 0.01) {
    const cashSleeve = sleeves.find((s) => s.sleeveId === 'cash');
    if (cashSleeve && cashSleeve.securities.length > 0) {
      trades.push({
        accountId: cashSleeve.securities[0].accountId,
        securityId: CASH_TICKER,
        action: totalTradeValue < 0 ? 'BUY' : 'SELL', // If underbought (negative), we "buy"/accumulate cash
        qty: totalTradeValue < 0 ? 1 : -1, // Virtual quantity
        estPrice: Math.abs(totalTradeValue),
        estValue: -totalTradeValue, // Opposite sign: negative total = positive cash gain
      });
    }
  }

  // console.log("\n📊 Generated trades:", trades.map(t => ({
  //   action: t.action,
  //   securityId: t.securityId,
  //   qty: t.qty,
  //   estValue: t.estValue
  // })));

  // Consolidate trades before returning to reduce trade count
  return consolidateTrades(trades);
}

function calculateTLHSwap(
  securities: RebalanceSecurityData[],
  washSaleRestrictions: WashSaleRestriction[],
  replacementCandidates: SecurityReplacement[],
  transactions: Transaction[] = [],
): Trade[] {
  const trades: Trade[] = [];
  const restrictionChecker = createRestrictionChecker(washSaleRestrictions, transactions);

  // Create a map for quick security price lookup
  const securityPriceMap = new Map<string, number>();
  securities.forEach((sec) => {
    securityPriceMap.set(sec.securityId, sec.price);
  });

  // Find taxable securities with unrealized losses
  // Skip legacy securities that have restrictions or would incur taxable gains
  const lossSecurities = securities.filter(
    (sec) =>
      sec.isTaxable &&
      sec.unrealizedGain &&
      sec.unrealizedGain < 0 &&
      !restrictionChecker.isSecurityRestricted(sec.securityId).isRestricted &&
      // Skip legacy securities that would incur taxable gains or have restrictions
      (!sec.isLegacy || (sec.isLegacy && sec.unrealizedGain >= 0)),
  );

  // Create replacement map
  const replacementMap = new Map<string, SecurityReplacement>();
  replacementCandidates.forEach((r) => {
    if (!restrictionChecker.isSecurityRestricted(r.replacementTicker).isRestricted) {
      replacementMap.set(r.originalTicker, r);
    }
  });

  lossSecurities.forEach((sec) => {
    const replacement = replacementMap.get(sec.securityId);

    if (replacement && sec.currentQty > 0) {
      const sellValue = sec.currentQty * sec.price;

      // Sell entire position (may be fractional) - no restriction check needed for sells
      trades.push({
        accountId: sec.accountId,
        securityId: sec.securityId,
        action: 'SELL',
        qty: -sec.currentQty, // Negative for sells
        estPrice: sec.price,
        estValue: -sellValue, // Negative for sells
      });

      // Get the actual price of the replacement security
      const replacementPrice = securityPriceMap.get(replacement.replacementTicker);

      if (replacementPrice && replacementPrice > 0) {
        // Calculate buy quantity based on sell proceeds and replacement price
        const buyQty = Math.floor(sellValue / replacementPrice);

        if (buyQty > 0) {
          // Validate replacement purchase against wash sale restrictions
          const validation = validateTradeAgainstRestrictions(
            replacement.replacementTicker,
            'BUY',
            restrictionChecker,
          );

          if (validation.isAllowed) {
            trades.push({
              accountId: sec.accountId,
              securityId: replacement.replacementTicker,
              action: 'BUY',
              qty: buyQty, // Positive for buys
              estPrice: replacementPrice,
              estValue: buyQty * replacementPrice, // Positive for buys
            });
          } else {
            console.log(`🚫 [TLH] Replacement trade blocked: ${validation.reason}`);
          }
        }
      } else {
        console.log(
          `⚠️ [TLH] No price found for replacement security ${replacement.replacementTicker}`,
        );
      }
    }
  });

  return consolidateTrades(trades);
}

function calculateTLHAndRebalance(
  securities: RebalanceSecurityData[],
  washSaleRestrictions: WashSaleRestriction[],
  replacementCandidates: SecurityReplacement[],
  transactions: Transaction[] = [],
): Trade[] {
  // Step 1: Perform TLH swaps
  const tlhTrades = calculateTLHSwap(
    securities,
    washSaleRestrictions,
    replacementCandidates,
    transactions,
  );

  // Step 2: Apply TLH trades to get updated security positions
  const updatedSecurities = applyTradesToSecurities(securities, tlhTrades);

  // Step 3: Perform allocation rebalance with wash-sale constraints
  const rebalanceTrades = calculateAllocationRebalanceWithConstraints(
    updatedSecurities,
    washSaleRestrictions,
    transactions,
  );

  return [...tlhTrades, ...rebalanceTrades];
}

function calculateAllocationRebalanceWithConstraints(
  securities: RebalanceSecurityData[],
  washSaleRestrictions: WashSaleRestriction[],
  transactions: Transaction[] = [],
): Trade[] {
  const restrictionChecker = createRestrictionChecker(washSaleRestrictions, transactions);

  // Filter out wash-sale restricted securities for new buys/sells
  const tradableSecurities = securities.filter(
    (sec) => !restrictionChecker.isSecurityRestricted(sec.securityId).isRestricted,
  );

  return calculateAllocationRebalance(tradableSecurities, washSaleRestrictions, transactions);
}

function applyTradesToSecurities(
  securities: RebalanceSecurityData[],
  trades: Trade[],
): RebalanceSecurityData[] {
  const securitiesMap = new Map<string, RebalanceSecurityData>();
  for (const sec of securities) {
    securitiesMap.set(sec.securityId, { ...sec });
  }

  trades.forEach((trade) => {
    const sec = securitiesMap.get(trade.securityId);
    if (sec) {
      if (trade.action === 'BUY') {
        sec.currentQty += trade.qty;
      } else {
        sec.currentQty += trade.qty; // qty is already negative for sells
      }
    } else if (trade.action === 'BUY') {
      // New position from TLH replacement
      securitiesMap.set(trade.securityId, {
        securityId: trade.securityId,
        currentQty: trade.qty,
        targetPct: 0, // TLH replacements don't have targets initially
        price: trade.estPrice,
        accountId: trade.accountId,
        isTaxable: true,
      });
    }
  });

  return Array.from(securitiesMap.values()).filter((sec) => sec.currentQty > 0);
}

function calculatePostHoldings(
  securities: RebalanceSecurityData[],
  trades: Trade[],
): HoldingPost[] {
  const holdingsMap = new Map<string, number>();

  // Start with current holdings
  securities.forEach((sec) => {
    holdingsMap.set(sec.securityId, sec.currentQty);
  });

  // Apply trades
  trades.forEach((trade) => {
    const currentQty = holdingsMap.get(trade.securityId) || 0;
    const newQty = currentQty + trade.qty; // qty already has correct sign

    if (newQty > 0) {
      holdingsMap.set(trade.securityId, newQty);
    } else {
      holdingsMap.delete(trade.securityId);
    }
  });

  return Array.from(holdingsMap.entries()).map(([securityId, qty]) => ({
    securityId,
    qty,
  }));
}

function calculateSleeveSummaries(
  sleeves: InternalRebalanceSleeveData[],
  trades: Trade[],
  postHoldings: HoldingPost[],
): SleeveSummary[] {
  return sleeves.map((sleeve) => {
    // Calculate sleeve's trade totals
    const sleeveTrades = trades.filter((trade) =>
      sleeve.securities.some((sec) => sec.securityId === trade.securityId),
    );

    const tradeQty = sleeveTrades.reduce((sum, trade) => sum + trade.qty, 0);
    const tradeUSD = sleeveTrades.reduce((sum, trade) => sum + trade.estValue, 0);

    // Calculate post-trade percentage
    const sleevePostValue = sleeve.securities.reduce((sum, sec) => {
      const postHolding = postHoldings.find((h) => h.securityId === sec.securityId);
      const postQty = postHolding?.qty || 0;
      return sum + postQty * sec.price;
    }, 0);

    const totalPostValue = postHoldings.reduce((sum, holding) => {
      const sec = sleeve.securities.find((s) => s.securityId === holding.securityId);
      const price = sec?.price || 0;
      return sum + holding.qty * price;
    }, 0);

    const postPct = totalPostValue > 0 ? (sleevePostValue / totalPostValue) * 100 : 0;

    return {
      sleeveId: sleeve.sleeveId,
      tradeQty: Math.abs(tradeQty) < 0.01 ? 0 : tradeQty,
      tradeUSD: Math.abs(tradeUSD) < 0.01 ? 0 : tradeUSD,
      postPct: Number(postPct.toFixed(1)),
    };
  });
}

interface SleeveWithFillRatio {
  sleeve: RebalanceSleeveDataNew;
  fillRatio: number;
  deficit: number;
  selectedSecurity: RebalanceSecurityData | null;
}

// Helper function to calculate fill ratios for sleeves
function calculateSleevesFillRatios(
  sleeves: RebalanceSleeveDataNew[],
  washSaleRestrictions: WashSaleRestriction[] = [],
): SleeveWithFillRatio[] {
  return sleeves.map((sleeve) => {
    const fillRatio = sleeve.targetValue > 0 ? sleeve.currentValue / sleeve.targetValue : 0;
    const deficit = Math.max(0, sleeve.targetValue - sleeve.currentValue);

    // Find the best available security in this sleeve
    let selectedSecurity = null;
    for (const security of sleeve.securities.sort((a, b) => (a.rank || 999) - (b.rank || 999))) {
      const isRestricted = washSaleRestrictions.some(
        (restriction) => restriction.ticker === security.securityId,
      );

      if (!isRestricted && security.price > 0) {
        selectedSecurity = security;
        break;
      }
    }

    return {
      sleeve,
      fillRatio,
      deficit,
      selectedSecurity,
    };
  });
}

function calculateInvestCash(
  sleeves: RebalanceSleeveDataNew[],
  cashAmount: number,
  washSaleRestrictions: WashSaleRestriction[] = [],
  _transactions: Transaction[] = [],
): Trade[] {
  console.log(`🚀 INVEST CASH DEBUG: Starting with cashAmount: $${cashAmount}`);
  console.log(`🚀 INVEST CASH DEBUG: Sleeves count: ${sleeves.length}`);

  if (cashAmount <= 0) {
    return [];
  }

  // Filter out non-investable sleeves (cash, orphan securities, etc.)
  // Focus only on model sleeves that have target allocations > 0
  const investableSleeves = sleeves.filter(
    (sleeve) =>
      sleeve.sleeveId !== 'cash' &&
      sleeve.sleeveId !== 'orphan-securities' &&
      sleeve.targetPct > 0 &&
      sleeve.securities.length > 0,
  );

  // For round-robin investment, use ALL investable sleeves to achieve better balance
  // The round-robin approach can efficiently handle many sleeves by buying one share at a time
  const processedSleeves = investableSleeves;

  if (processedSleeves.length === 0) {
    return [];
  }

  // Calculate total portfolio value for processed sleeves only
  const totalPortfolioValue = processedSleeves.reduce(
    (sum, sleeve) => sum + sleeve.currentValue,
    0,
  );

  // Calculate how much each sleeve should have after cash injection
  const newTotalPortfolioValue = totalPortfolioValue + cashAmount;

  // Calculate target values after cash injection and current drift
  const sleeveDrifts = processedSleeves.map((sleeve) => {
    const newTargetValue = (sleeve.targetPct / 100) * newTotalPortfolioValue;
    const deficit = newTargetValue - sleeve.currentValue;
    const currentPct =
      totalPortfolioValue > 0 ? (sleeve.currentValue / totalPortfolioValue) * 100 : 0;

    return {
      sleeveId: sleeve.sleeveId,
      deficit: Math.max(0, deficit), // Only consider positive deficits (underweight)
      newTargetValue: newTargetValue,
      currentValue: sleeve.currentValue,
      targetPct: sleeve.targetPct,
      currentPct: currentPct,
      securities: sleeve.securities,
    };
  });

  // For micro-sleeve models, we need to be more aggressive about cash deployment
  // If total deficits are much smaller than available cash, distribute more evenly
  const totalDeficit = sleeveDrifts.reduce((sum, sleeve) => sum + sleeve.deficit, 0);
  const shouldDistributeEvenly = totalDeficit < cashAmount * 0.5; // If deficits are less than 50% of cash

  console.log(
    `🚀 INVEST CASH DEBUG: Total deficit: $${totalDeficit.toFixed(2)}, Available cash: $${cashAmount}, Should distribute evenly: ${shouldDistributeEvenly}`,
  );
  console.log(
    '🚀 INVEST CASH DEBUG: Sleeve deficits:',
    sleeveDrifts.map((s) => ({
      sleeveId: s.sleeveId,
      deficit: s.deficit.toFixed(2),
      targetPct: s.targetPct.toFixed(2),
    })),
  );

  // Sort by deficit (largest deficit first to prioritize most underweight sleeves)
  sleeveDrifts.sort((a, b) => b.deficit - a.deficit);

  // Implement simplified balanced investment algorithm
  // For micro-sleeve models, the sophisticated leveling approach is too complex
  // Instead, buy one share of each security in price order to achieve balance
  console.log(
    `🚀 INVEST CASH DEBUG: Starting balanced investment with ${processedSleeves.length} sleeves`,
  );

  const trades: Trade[] = [];
  let remainingCash = cashAmount;

  // Create a list of all available securities with their sleeves, sorted by price
  const availableInvestments = processedSleeves
    .map((sleeve) => {
      const selectedSecurity = sleeve.securities.find((sec) => {
        const isRestricted = washSaleRestrictions.some(
          (restriction) => restriction.ticker === sec.securityId,
        );
        return !isRestricted && sec.price > 0;
      });

      return selectedSecurity
        ? {
            sleeve,
            security: selectedSecurity,
            currentShares: 0, // Track how many shares we've bought
          }
        : null;
    })
    .filter((item) => item !== null)
    .sort((a, b) => a?.security.price - b?.security.price);

  console.log(`🚀 INVEST CASH DEBUG: Found ${availableInvestments.length} investable securities`);
  console.log(
    `🚀 INVEST CASH DEBUG: Price range: $${availableInvestments[0]?.security.price.toFixed(2)} - $${availableInvestments[availableInvestments.length - 1]?.security.price.toFixed(2)}`,
  );

  // Round-robin investment: keep buying one share of the cheapest available securities
  // until we run out of cash or have invested in all securities
  let round = 0;
  while (remainingCash > 0 && round < 100) {
    // Prevent infinite loops
    round++;
    let investmentsThisRound = 0;

    console.log(
      `🚀 INVEST CASH DEBUG: Round ${round} - remaining cash: $${remainingCash.toFixed(2)}`,
    );

    // Try to buy one share of each security we can afford, starting with cheapest
    for (const investment of availableInvestments) {
      if (remainingCash >= investment.security.price) {
        console.log(
          `🚀 INVEST CASH DEBUG: Round ${round} - Buying 1 share of ${investment.security.securityId} for $${investment.security.price.toFixed(2)}`,
        );

        trades.push({
          accountId: investment.security.accountId,
          securityId: investment.security.securityId,
          action: 'BUY',
          qty: 1,
          estPrice: investment.security.price,
          estValue: investment.security.price,
        });

        investment.sleeve.currentValue += investment.security.price;
        investment.currentShares += 1;
        remainingCash -= investment.security.price;
        investmentsThisRound++;
      }
    }

    // If we couldn't buy any securities this round, we're done
    if (investmentsThisRound === 0) {
      console.log(`🚀 INVEST CASH DEBUG: No affordable securities in round ${round}, stopping`);
      break;
    }

    console.log(
      `🚀 INVEST CASH DEBUG: Round ${round} complete - bought ${investmentsThisRound} shares`,
    );
  }

  // Calculate final fill ratios and statistics
  const finalSleevesWithRatios = calculateSleevesFillRatios(processedSleeves, washSaleRestrictions);
  const finalFillRatios = finalSleevesWithRatios.map((s) => s.fillRatio);
  const avgFillRatio =
    finalFillRatios.reduce((sum, ratio) => sum + ratio, 0) / finalFillRatios.length;
  const fillRatioStdDev = Math.sqrt(
    finalFillRatios.reduce((sum, ratio) => sum + (ratio - avgFillRatio) ** 2, 0) /
      finalFillRatios.length,
  );

  console.log(
    `🚀 INVEST CASH DEBUG: Generated ${trades.length} trades over ${round} rounds, remaining cash: $${remainingCash.toFixed(2)}`,
  );
  console.log(`🚀 INVEST CASH DEBUG: Total invested: $${(cashAmount - remainingCash).toFixed(2)}`);
  console.log(
    `🚀 INVEST CASH DEBUG: Final fill ratio stats - Avg: ${avgFillRatio.toFixed(3)}, StdDev: ${fillRatioStdDev.toFixed(3)}`,
  );

  // Show final fill ratios for first 10 sleeves
  const finalRatioSummary = finalSleevesWithRatios.slice(0, 10).map((s) => ({
    sleeveId: s.sleeve.sleeveId,
    fillRatio: s.fillRatio.toFixed(3),
    currentValue: s.sleeve.currentValue.toFixed(2),
  }));
  console.log('🚀 INVEST CASH DEBUG: Final fill ratios (first 10):', finalRatioSummary);

  return consolidateTrades(trades);
}

function consolidateTrades(trades: Trade[]): Trade[] {
  const consolidatedMap = new Map<string, Trade>();

  trades.forEach((trade) => {
    // Create a unique key for each security + account + action combination
    const key = `${trade.securityId}_${trade.accountId}_${trade.action}`;

    if (consolidatedMap.has(key)) {
      const existing = consolidatedMap.get(key);
      if (existing) {
        // Combine quantities and values
        existing.qty += trade.qty;
        existing.estValue += trade.estValue;
        // Keep the price as weighted average
        existing.estPrice = Math.abs(existing.estValue / existing.qty);
      }
    } else {
      consolidatedMap.set(key, { ...trade });
    }
  });

  // Filter out trades with zero quantity (shouldn't happen but good safety check)
  return Array.from(consolidatedMap.values()).filter((trade) => Math.abs(trade.qty) > 0.001);
}
