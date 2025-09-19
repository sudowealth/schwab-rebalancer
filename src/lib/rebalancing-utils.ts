// Utility functions for rebalancing group calculations

import { CASH_TICKER, isAnyCashTicker, isBaseCashTicker, MANUAL_CASH_TICKER } from './constants';
import type { AccountHoldingsResult, SP500DataResult } from './db-api';
import {
  type Transaction as BaseTransaction,
  checkTransactionHistoryForWashSale,
} from './restrictions-utils';

// Internal security data structure used in rebalancing calculations
export interface SecurityData {
  ticker: string;
  targetValue: number;
  targetPercent: number;
  currentValue: number;
  currentPercent: number;
  difference: number;
  differencePercent: number;
  qty: number;
  currentPrice?: number;
  isHeld: boolean;
  rank?: number;
  isTarget?: boolean;
  hasWashSaleRisk?: boolean;
  washSaleInfo?: unknown;
  accountNames: Set<string>; // Internal calculations use Set, UI uses array
  costBasis?: number;
  costBasisPerShare?: number;
  openedAt?: Date | number | { getTime(): number } | null; // Internal can be null
  totalGainLoss?: number;
  longTermGainLoss?: number;
  shortTermGainLoss?: number;
  realizedGainLoss?: number;
  realizedLongTermGainLoss?: number;
  realizedShortTermGainLoss?: number;
}

export interface AggregatedSleeveData {
  sleeveId: string;
  sleeveName: string;
  targetValue: number;
  currentValue: number;
  targetPercent: number;
  currentPercent: number;
  securities: Map<string, SecurityData>;
  accountNames: Set<string>;
}

// Color palette for charts
const CHART_COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884D8',
  '#82CA9D',
  '#A4DE6C',
  '#FFD93D',
];

// Check if a security has wash sale risk (sold at loss within 31 days) - unified with rebalancing logic
// Extended transaction interface with rebalancing-specific properties
interface Transaction extends BaseTransaction {
  qty: number;
  price: number;
}

const checkWashSaleRisk = (ticker: string, transactions: Transaction[] = []) => {
  return checkTransactionHistoryForWashSale(ticker, transactions);
};

// Generate allocation data for different views
import type { RebalancingGroupsResult } from './db-api';

type GroupMember = RebalancingGroupsResult[number]['members'][number];

interface Group {
  members: GroupMember[];
  assignedModel?: {
    members: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface SleeveInfo {
  sleeveId: string;
  sleeveName: string;
  [key: string]: unknown;
}

interface Holding {
  ticker: string;
  marketValue: number;
  qty?: number;
  costBasis?: number;
  openedAt?: Date | number | { getTime(): number };
  currentPrice?: number;
  sleeves?: SleeveInfo[];
  [key: string]: unknown;
}

interface AccountHoldingData {
  holdings: Holding[];
  [key: string]: unknown;
}

export type SP500Security = SP500DataResult[number];

export const generateAllocationData = (
  allocationView: 'account' | 'sector' | 'industry' | 'sleeve',
  group: Group,
  accountHoldings: AccountHoldingData[],
  sp500Data: SP500Security[],
  totalValue: number,
) => {
  if (allocationView === 'account') {
    const result = group.members.map((member, index: number) => ({
      name: member.accountName,
      value: member.balance,
      percentage: ((member.balance || 0) / totalValue) * 100,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
    return result;
  }
  if (allocationView === 'sector') {
    const result = generateSectorAllocationData(accountHoldings, sp500Data, totalValue);
    return result;
  }
  if (allocationView === 'sleeve') {
    const result = generateSleeveAllocationData(accountHoldings, totalValue);
    return result;
  }
  const result = generateIndustryAllocationData(accountHoldings, sp500Data, totalValue);
  return result;
};

// Generate sector allocation data
const generateSectorAllocationData = (
  accountHoldings: AccountHoldingData[],
  sp500Data: SP500Security[],
  totalValue: number,
) => {
  const sectorMap = new Map<string, number>();
  const securityInfoMap = new Map();

  sp500Data.forEach((security) => {
    securityInfoMap.set(security.ticker, security);
  });

  for (const account of accountHoldings) {
    for (const holding of account.holdings) {
      const securityInfo = securityInfoMap.get(holding.ticker);
      const sector = securityInfo?.sector || 'Unknown';
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + holding.marketValue);
    }
  }

  return Array.from(sectorMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([sector, value], index) => ({
      name: sector,
      value,
      percentage: (value / totalValue) * 100,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
};

// Generate industry allocation data
const generateIndustryAllocationData = (
  accountHoldings: AccountHoldingData[],
  sp500Data: SP500Security[],
  totalValue: number,
) => {
  const industryMap = new Map<string, number>();
  const securityInfoMap = new Map();

  sp500Data.forEach((security) => {
    securityInfoMap.set(security.ticker, security);
  });

  for (const account of accountHoldings) {
    for (const holding of account.holdings) {
      const securityInfo = securityInfoMap.get(holding.ticker);
      const industry = securityInfo?.industry || 'Unknown';
      industryMap.set(industry, (industryMap.get(industry) || 0) + holding.marketValue);
    }
  }

  return Array.from(industryMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([industry, value], index) => ({
      name: industry,
      value,
      percentage: (value / totalValue) * 100,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
};

// Generate sleeve allocation data
const generateSleeveAllocationData = (
  accountHoldings: AccountHoldingData[],
  totalValue: number,
) => {
  const sleeveMap = new Map<string, number>();

  for (const account of accountHoldings) {
    for (const holding of account.holdings) {
      if (holding.sleeves && holding.sleeves.length > 0) {
        const sleeve = holding.sleeves[0];
        sleeveMap.set(
          sleeve.sleeveName,
          (sleeveMap.get(sleeve.sleeveName) || 0) + holding.marketValue,
        );
      } else {
        sleeveMap.set('Unassigned', (sleeveMap.get('Unassigned') || 0) + holding.marketValue);
      }
    }
  }

  return Array.from(sleeveMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([sleeveName, value], index) => ({
      name: sleeveName,
      value,
      percentage: (value / totalValue) * 100,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
};

// Generate top holdings data from account holdings
export const generateTopHoldingsData = (
  accountHoldings: AccountHoldingData[],
  totalValue: number,
  limit?: number,
) => {
  const holdingsMap = new Map<string, number>();

  // Aggregate holdings across all accounts
  for (const account of accountHoldings) {
    for (const holding of account.holdings) {
      holdingsMap.set(holding.ticker, (holdingsMap.get(holding.ticker) || 0) + holding.marketValue);
    }
  }

  // Sort by value and optionally limit
  const sortedHoldings = Array.from(holdingsMap.entries()).sort(([, a], [, b]) => b - a);

  const finalHoldings = limit ? sortedHoldings.slice(0, limit) : sortedHoldings;

  // Return all holdings without "Others" category
  const result = finalHoldings.map(([ticker, value]) => ({
    ticker,
    value,
    percentage: (value / totalValue) * 100,
  }));

  return result;
};

// Calculate sleeve allocations for each account
interface SleeveData {
  sleeveId: string;
  sleeveName: string;
  members: Array<{
    id: string;
    ticker: string;
    rank: number;
    isActive: boolean;
    currentPrice: number;
    targetWeight: number;
  }>;
  [key: string]: unknown;
}

// Extract the account holding type from the function return type
type AccountHoldingFromResult = AccountHoldingsResult[number];

// Define AccountHoldingWithSleeve to match the expected structure
interface AccountHoldingWithSleeve extends AccountHoldingFromResult {
  holdings: Array<{
    id: string;
    ticker: string;
    qty: number;
    currentPrice: number;
    marketValue: number;
    costBasisPerShare: number;
    costBasisTotal: number;
    unrealizedGain: number;
    unrealizedGainPercent: number;
    sleeves: Array<{
      sleeveId: string;
      sleeveName: string;
    }>;
    sector: string;
    industry: string;
    openedAt: Date;
  }>;
}

export const calculateSleeveAllocations = (
  group: Group & { assignedModel?: unknown },
  accountHoldings: AccountHoldingWithSleeve[],
  sleeveMembers: SleeveData[],
  transactions: Transaction[],
) => {
  if (!group.assignedModel) return [];

  const sleeveMembersMap = new Map<string, SleeveData>();
  for (const sleeveData of sleeveMembers) {
    sleeveMembersMap.set(sleeveData.sleeveId, sleeveData);
  }

  const results = [];

  for (const account of accountHoldings) {
    const accountData = {
      accountId: account.accountId,
      accountName: account.accountName,
      accountType: account.accountType,
      accountNumber: account.accountNumber || '',
      totalValue: account.accountBalance,
      sleeves: [] as Array<{
        sleeveId: string;
        sleeveName: string;
        targetPercent: number;
        targetValue: number;
        currentValue: number;
        currentPercent: number;
        difference: number;
        differencePercent: number;
        securities: SecurityData[];
      }>,
    };

    // Group holdings by sleeve
    interface SleeveHoldingData {
      sleeveId: string;
      sleeveName: string;
      securities: unknown[];
      currentValue: number;
      holdingsByTicker: Map<
        string,
        {
          ticker: string;
          currentValue: number;
          costBasis: number;
          qty: number;
          openedAt?: Date | number | { getTime(): number };
          currentPrice?: number;
          totalCostBasis: number;
          weightedOpenedAt: number;
          totalQty: number;
          [key: string]: unknown;
        }
      >;
      [key: string]: unknown;
    }
    const sleeveHoldings = new Map<string, SleeveHoldingData>();
    for (const holding of account.holdings) {
      // Skip base cash and manual cash holdings as they'll be handled separately
      if (isAnyCashTicker(holding.ticker)) {
        continue;
      }

      // Only treat a holding as assigned to a sleeve if that sleeve exists
      // in the group's assigned model (sleeveMembersMap). Otherwise, treat it
      // as Unassigned. This prevents globally defined sleeves from pulling
      // holdings into non-model sleeves for the current group.
      const assignedSleeve = (holding.sleeves || []).find((s) => sleeveMembersMap.has(s.sleeveId));

      if (assignedSleeve) {
        const sleeve = assignedSleeve;

        if (!sleeveHoldings.has(sleeve.sleeveId)) {
          sleeveHoldings.set(sleeve.sleeveId, {
            sleeveId: sleeve.sleeveId,
            sleeveName: sleeve.sleeveName,
            securities: [],
            currentValue: 0,
            holdingsByTicker: new Map(),
          });
        }
        const sleeveData = sleeveHoldings.get(sleeve.sleeveId) as SleeveHoldingData | undefined;
        if (!sleeveData) {
          // Should not happen due to set above, but guard for safety
          continue;
        }
        sleeveData.currentValue += holding.marketValue;

        if (!sleeveData.holdingsByTicker.has(holding.ticker)) {
          sleeveData.holdingsByTicker.set(holding.ticker, {
            ticker: holding.ticker,
            currentValue: 0,
            qty: 0,
            currentPrice: holding.currentPrice,
            costBasis: 0,
            openedAt: undefined,
            totalCostBasis: 0,
            weightedOpenedAt: 0,
            totalQty: 0,
          });
        }
        const tickerData = sleeveData.holdingsByTicker.get(holding.ticker) as {
          ticker: string;
          currentValue: number;
          costBasis: number;
          qty: number;
          openedAt?: Date | number | { getTime(): number };
          currentPrice?: number;
          totalCostBasis: number;
          weightedOpenedAt: number;
          totalQty: number;
        };
        if (!tickerData) continue;
        tickerData.currentValue += holding.marketValue;
        tickerData.qty += holding.qty || 0;

        // Calculate weighted average cost basis and opened date
        const holdingCostBasis = holding.costBasisPerShare || 0;
        const holdingOpenedAt = holding.openedAt
          ? typeof holding.openedAt === 'object' && 'getTime' in holding.openedAt
            ? holding.openedAt.getTime()
            : typeof holding.openedAt === 'number'
              ? holding.openedAt
              : Date.now()
          : Date.now();

        const holdingQty = holding.qty || 0;
        // Update aggregated values for weighted calculations
        tickerData.totalCostBasis += holdingCostBasis * holdingQty;
        tickerData.weightedOpenedAt += holdingOpenedAt * holdingQty;
        tickerData.totalQty += holdingQty;

        // Update weighted averages
        tickerData.costBasis =
          tickerData.totalQty > 0 ? tickerData.totalCostBasis / tickerData.totalQty : 0;
        tickerData.openedAt =
          tickerData.totalQty > 0
            ? new Date(tickerData.weightedOpenedAt / tickerData.totalQty)
            : undefined;
      } else {
        // Handle unassigned holdings
        const unassignedSleeveId = 'unassigned';
        if (!sleeveHoldings.has(unassignedSleeveId)) {
          sleeveHoldings.set(unassignedSleeveId, {
            sleeveId: unassignedSleeveId,
            sleeveName: 'Unassigned',
            currentValue: 0,
            securities: [],
            holdingsByTicker: new Map<
              string,
              {
                ticker: string;
                currentValue: number;
                costBasis: number;
                qty: number;
                openedAt?: Date | number | { getTime(): number };
                currentPrice?: number;
                totalCostBasis: number;
                weightedOpenedAt: number;
                totalQty: number;
              }
            >(),
          });
        }
        const sleeveData = sleeveHoldings.get(unassignedSleeveId) as SleeveHoldingData | undefined;
        if (!sleeveData) {
          continue;
        }
        sleeveData.currentValue += holding.marketValue;

        if (!sleeveData.holdingsByTicker.has(holding.ticker)) {
          sleeveData.holdingsByTicker.set(holding.ticker, {
            ticker: holding.ticker,
            currentValue: 0,
            qty: 0,
            currentPrice: holding.currentPrice,
            costBasis: 0,
            openedAt: undefined,
            totalCostBasis: 0,
            weightedOpenedAt: 0,
            totalQty: 0,
          });
        }
        const tickerData = sleeveData.holdingsByTicker.get(holding.ticker) as {
          ticker: string;
          currentValue: number;
          costBasis: number;
          qty: number;
          openedAt?: Date | number | { getTime(): number };
          currentPrice?: number;
          totalCostBasis: number;
          weightedOpenedAt: number;
          totalQty: number;
        };
        if (!tickerData) continue;
        tickerData.currentValue += holding.marketValue;
        tickerData.qty += holding.qty || 0;

        // Calculate weighted average cost basis and opened date
        const holdingCostBasis = holding.costBasisPerShare || 0;
        const holdingOpenedAt = holding.openedAt
          ? typeof holding.openedAt === 'object' && 'getTime' in holding.openedAt
            ? holding.openedAt.getTime()
            : typeof holding.openedAt === 'number'
              ? holding.openedAt
              : Date.now()
          : Date.now();

        const holdingQty = holding.qty || 0;
        // Update aggregated values for weighted calculations
        tickerData.totalCostBasis += holdingCostBasis * holdingQty;
        tickerData.weightedOpenedAt += holdingOpenedAt * holdingQty;
        tickerData.totalQty += holdingQty;

        // Update weighted averages
        tickerData.costBasis =
          tickerData.totalQty > 0 ? tickerData.totalCostBasis / tickerData.totalQty : 0;
        tickerData.openedAt =
          tickerData.totalQty > 0
            ? new Date(tickerData.weightedOpenedAt / tickerData.totalQty)
            : undefined;
      }
    }

    // Add target allocations from model
    for (const modelMember of group.assignedModel.members) {
      const member = modelMember as {
        targetWeight: number;
        sleeveId: string;
        sleeveName: string;
      };
      const targetValue = (member.targetWeight / 10000) * accountData.totalValue;
      const currentSleeveData = sleeveHoldings.get(member.sleeveId);
      const currentValue = currentSleeveData?.currentValue || 0;
      const currentPercent =
        accountData.totalValue > 0 ? (currentValue / accountData.totalValue) * 100 : 0;

      // Get target securities for this sleeve
      // Even if there are no current holdings, we still need to calculate target securities
      const targetSecurities = calculateSleeveTargetSecurities(
        member,
        sleeveMembersMap,
        currentSleeveData || { holdingsByTicker: new Map() },
        targetValue,
        transactions,
        accountData.totalValue,
      );

      accountData.sleeves.push({
        sleeveId: member.sleeveId,
        sleeveName: member.sleeveName,
        targetPercent: member.targetWeight / 100,
        targetValue,
        currentValue,
        currentPercent,
        difference: currentValue - targetValue,
        differencePercent: currentPercent - member.targetWeight / 100,
        securities: targetSecurities,
      });
    }

    // Add Unassigned sleeve if it has holdings
    const unassignedSleeveData = sleeveHoldings.get('unassigned');
    if (unassignedSleeveData) {
      const unassignedCurrentValue = unassignedSleeveData.currentValue;
      const unassignedCurrentPercent =
        accountData.totalValue > 0 ? (unassignedCurrentValue / accountData.totalValue) * 100 : 0;

      // Create securities list for unassigned holdings
      const unassignedSecurities = [];
      for (const [, tickerData] of unassignedSleeveData.holdingsByTicker) {
        const securityCurrentPercent =
          accountData.totalValue > 0 ? (tickerData.currentValue / accountData.totalValue) * 100 : 0;

        // Calculate gains/losses
        const totalCostValue = tickerData.costBasis * tickerData.qty;
        const totalGainLoss = tickerData.currentValue - totalCostValue;
        const isLongTerm = tickerData.openedAt
          ? Date.now() -
              (typeof tickerData.openedAt === 'number'
                ? tickerData.openedAt
                : 'getTime' in tickerData.openedAt
                  ? tickerData.openedAt.getTime()
                  : new Date(tickerData.openedAt).getTime()) >
            365 * 24 * 60 * 60 * 1000
          : false;

        unassignedSecurities.push({
          ticker: tickerData.ticker,
          targetValue: 0, // No target for unassigned
          targetPercent: 0,
          currentValue: tickerData.currentValue,
          currentPercent: securityCurrentPercent,
          difference: tickerData.currentValue, // All current value is "excess"
          differencePercent: securityCurrentPercent,
          qty: tickerData.qty,
          currentPrice: tickerData.currentPrice,
          costBasis: tickerData.costBasis,
          openedAt: tickerData.openedAt,
          totalGainLoss,
          longTermGainLoss: isLongTerm ? totalGainLoss : 0,
          shortTermGainLoss: isLongTerm ? 0 : totalGainLoss,
          isHeld: true,
          isTarget: false,
          hasWashSaleRisk: false,
          washSaleInfo: null,
          accountNames: new Set<string>(),
        });
      }

      accountData.sleeves.push({
        sleeveId: 'unassigned',
        sleeveName: 'Unassigned',
        targetPercent: 0, // No target allocation for unassigned
        targetValue: 0,
        currentValue: unassignedCurrentValue,
        currentPercent: unassignedCurrentPercent,
        difference: unassignedCurrentValue, // All current value is "excess"
        differencePercent: unassignedCurrentPercent,
        securities: unassignedSecurities,
      });
    }

    // Add Cash sleeve for tracking cash flow during rebalancing
    // Calculate holdings value excluding cash holdings
    const holdingsValue = account.holdings
      .filter((h: { ticker: string; marketValue: number }) => !isAnyCashTicker(h.ticker))
      .reduce((sum: number, h: { marketValue: number }) => sum + h.marketValue, 0);

    // Calculate available cash (including cash and MCASH holdings)

    const availableCash = accountData.totalValue - holdingsValue;

    // Build cash securities from actual cash holdings
    const cashSecurities: SecurityData[] = [];

    // Get base cash holdings ($$$)
    const regularCashHoldings = account.holdings.filter((h: Holding) => isBaseCashTicker(h.ticker));
    const regularCashValue = regularCashHoldings.reduce(
      (sum: number, h: Holding) => sum + h.marketValue,
      0,
    );

    if (regularCashValue > 0) {
      cashSecurities.push({
        ticker: CASH_TICKER,
        targetValue: regularCashValue,
        targetPercent: (regularCashValue / accountData.totalValue) * 100,
        currentValue: regularCashValue,
        currentPercent: (regularCashValue / accountData.totalValue) * 100,
        difference: 0,
        differencePercent: 0,
        qty: regularCashHoldings.reduce(
          (sum: number, h: Holding & { qty?: number }) => sum + (h.qty || 0),
          0,
        ),
        currentPrice: 1.0,
        isHeld: true,
        isTarget: true,
        hasWashSaleRisk: false,
        accountNames: new Set([accountData.accountName]),
      });
    }

    // Get MCASH holdings
    const manualCashHoldings = account.holdings.filter(
      (h: Holding) => h.ticker === MANUAL_CASH_TICKER,
    );
    const manualCashValue = manualCashHoldings.reduce(
      (sum: number, h: Holding) => sum + h.marketValue,
      0,
    );

    if (manualCashValue > 0) {
      cashSecurities.push({
        ticker: 'MCASH',
        targetValue: manualCashValue,
        targetPercent: (manualCashValue / accountData.totalValue) * 100,
        currentValue: manualCashValue,
        currentPercent: (manualCashValue / accountData.totalValue) * 100,
        difference: 0,
        differencePercent: 0,
        qty: manualCashHoldings.reduce(
          (sum: number, h: Holding & { qty?: number }) => sum + (h.qty || 0),
          0,
        ),
        currentPrice: 1.0, // $1.00 per share
        isHeld: true,
        isTarget: true,
        hasWashSaleRisk: false,
        accountNames: new Set([accountData.accountName]),
      });
    }

    accountData.sleeves.unshift({
      sleeveId: 'cash',
      sleeveName: 'Cash',
      targetPercent: 0, // We target 0% cash allocation
      targetValue: 0, // Target is to invest all cash
      currentValue: availableCash,
      currentPercent: (availableCash / accountData.totalValue) * 100,
      difference: availableCash, // All current cash is "excess"
      differencePercent: (availableCash / accountData.totalValue) * 100,
      securities: cashSecurities.map((sec) => ({
        ...sec,
        targetValue: 0, // Each cash security targets $0
        targetPercent: 0, // Each cash security targets 0%
        difference: sec.currentValue, // All current value is "excess"
        differencePercent: sec.currentPercent,
      })),
    });

    results.push(accountData);
  }

  return results;
};

// Calculate target securities for a sleeve
interface ModelMember {
  sleeveId: string;
  targetWeight: number;
  [key: string]: unknown;
}

interface CurrentSleeveData {
  holdingsByTicker: Map<
    string,
    {
      ticker: string;
      currentValue: number;
      costBasis: number;
      qty: number;
      openedAt?: Date | number | { getTime(): number };
      currentPrice?: number;
      totalCostBasis: number;
      weightedOpenedAt: number;
      totalQty: number;
    }
  >;
  [key: string]: unknown;
}

interface SleeveMember {
  ticker: string;
  rank: number;
  currentPrice?: number;
  [key: string]: unknown;
}

interface SleeveTargetData {
  members: SleeveMember[];
  [key: string]: unknown;
}

const calculateSleeveTargetSecurities = (
  modelMember: ModelMember,
  sleeveMembersMap: Map<string, SleeveTargetData>,
  currentSleeveData: CurrentSleeveData,
  targetValue: number,
  transactions: Transaction[],
  totalAccountValue: number,
) => {
  const targetSecurities = [];
  const sleeveTargetData = sleeveMembersMap.get(modelMember.sleeveId);

  if (sleeveTargetData) {
    const sortedMembers = [...sleeveTargetData.members].sort((a, b) => a.rank - b.rank);

    // Check if any security is currently held
    const heldSecurity = sortedMembers.find((member) => {
      const currentHolding = currentSleeveData?.holdingsByTicker.get(member.ticker);
      return !!currentHolding;
    });

    let targetSecurityTicker = null;

    if (heldSecurity) {
      targetSecurityTicker = heldSecurity.ticker;
    } else {
      // Find the lowest ranked security without wash sale risk
      for (const member of sortedMembers) {
        const washSaleRisk = checkWashSaleRisk(member.ticker, transactions);
        if (!washSaleRisk.hasRisk) {
          targetSecurityTicker = member.ticker;
          break;
        }
      }
    }

    for (const targetMember of sortedMembers) {
      const currentHolding = currentSleeveData?.holdingsByTicker.get(targetMember.ticker);
      const securityCurrentValue = currentHolding?.currentValue || 0;
      const securityCurrentPercent =
        totalAccountValue > 0 ? (securityCurrentValue / totalAccountValue) * 100 : 0;

      const washSaleRisk = checkWashSaleRisk(targetMember.ticker, transactions);
      const isTargetSecurity = targetMember.ticker === targetSecurityTicker;
      const securityTargetPercent = isTargetSecurity ? modelMember.targetWeight / 100 : 0;
      const securityTargetValue = isTargetSecurity ? targetValue : 0;

      // Calculate gains/losses for held securities
      const costBasis = currentHolding?.costBasis || 0;
      const openedAt = currentHolding?.openedAt || null;
      const totalCostValue = costBasis * (currentHolding?.qty || 0);
      const totalGainLoss = securityCurrentValue - totalCostValue;
      const isLongTerm = openedAt
        ? Date.now() -
            (typeof openedAt === 'number'
              ? openedAt
              : 'getTime' in openedAt
                ? openedAt.getTime()
                : new Date(openedAt).getTime()) >
          365 * 24 * 60 * 60 * 1000
        : false;

      targetSecurities.push({
        ticker: targetMember.ticker,
        targetValue: securityTargetValue,
        targetPercent: securityTargetPercent,
        currentValue: securityCurrentValue,
        currentPercent: securityCurrentPercent,
        difference: securityCurrentValue - securityTargetValue,
        differencePercent: securityCurrentPercent - securityTargetPercent,
        qty: currentHolding?.qty || 0,
        currentPrice: targetMember.currentPrice,
        costBasis,
        openedAt,
        totalGainLoss: currentHolding ? totalGainLoss : 0,
        longTermGainLoss: !!currentHolding && isLongTerm ? totalGainLoss : 0,
        shortTermGainLoss: !!currentHolding && !isLongTerm ? totalGainLoss : 0,
        isHeld: !!currentHolding,
        rank: targetMember.rank,
        isTarget: isTargetSecurity,
        hasWashSaleRisk: washSaleRisk.hasRisk,
        washSaleInfo: washSaleRisk.info,
        accountNames: new Set<string>(),
      });
    }
  }

  return targetSecurities;
};

// Generate sleeve table data with aggregation
interface SleeveAllocationDataWithSleeves {
  accountName: string;
  sleeves: {
    sleeveId: string;
    sleeveName: string;
    targetValue: number;
    currentValue: number;
    securities: SecurityData[];
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

export const generateSleeveTableData = (
  sleeveAllocationData: SleeveAllocationDataWithSleeves[],
  selectedAccountFilter: string,
  totalValue: number,
) => {
  if (selectedAccountFilter === 'all') {
    const sleeveMap = new Map<string, AggregatedSleeveData>();

    for (const account of sleeveAllocationData) {
      for (const sleeve of account.sleeves) {
        const key = sleeve.sleeveId;
        if (!sleeveMap.has(key)) {
          sleeveMap.set(key, {
            sleeveId: sleeve.sleeveId,
            sleeveName: sleeve.sleeveName,
            targetValue: 0,
            currentValue: 0,
            targetPercent: 0,
            currentPercent: 0,
            securities: new Map<string, SecurityData>(),
            accountNames: new Set<string>(),
          });
        }

        const aggregatedSleeve = sleeveMap.get(key) as AggregatedSleeveData | undefined;
        if (!aggregatedSleeve) continue;
        aggregatedSleeve.targetValue += sleeve.targetValue;
        aggregatedSleeve.currentValue += sleeve.currentValue;
        aggregatedSleeve.accountNames.add(account.accountName);

        // Aggregate securities
        for (const security of sleeve.securities) {
          const secKey = security.ticker;
          if (!aggregatedSleeve.securities.has(secKey)) {
            aggregatedSleeve.securities.set(secKey, {
              ...security,
              accountNames: new Set<string>(),
            });
          }
          const aggSec = aggregatedSleeve.securities.get(secKey) as SecurityData | undefined;
          if (!aggSec) continue;
          aggSec.currentValue += security.currentValue;
          aggSec.targetValue += security.targetValue;
          aggSec.qty += security.qty || 0;
          aggSec.accountNames.add(account.accountName);
        }
      }
    }

    return Array.from(sleeveMap.values()).map((sleeve) => {
      // Calculate aggregated unrealized G/L values for the sleeve
      let totalGainLoss = 0;
      let longTermGainLoss = 0;
      let shortTermGainLoss = 0;

      // Sum up unrealized G/L from all securities in the sleeve
      // (Realized G/L is calculated on-demand during sorting and rendering)
      Array.from(sleeve.securities.values()).forEach((security) => {
        totalGainLoss += security.totalGainLoss || 0;
        longTermGainLoss += security.longTermGainLoss || 0;
        shortTermGainLoss += security.shortTermGainLoss || 0;
      });

      return {
        ...sleeve,
        currentPercent: totalValue > 0 ? (sleeve.currentValue / totalValue) * 100 : 0,
        targetPercent: totalValue > 0 ? (sleeve.targetValue / totalValue) * 100 : 0,
        difference: sleeve.currentValue - sleeve.targetValue,
        differencePercent:
          totalValue > 0 ? ((sleeve.currentValue - sleeve.targetValue) / totalValue) * 100 : 0,
        // Add aggregated unrealized G/L values
        totalGainLoss,
        longTermGainLoss,
        shortTermGainLoss,
        securities: Array.from(sleeve.securities.values()).map((sec) => ({
          ...sec,
          currentPercent:
            sleeve.targetValue > 0 ? (sec.currentValue / sleeve.targetValue) * 100 : 0,
          targetPercent: sleeve.targetValue > 0 ? (sec.targetValue / sleeve.targetValue) * 100 : 0,
          difference: sec.currentValue - sec.targetValue,
          differencePercent:
            sleeve.targetValue > 0
              ? ((sec.currentValue - sec.targetValue) / sleeve.targetValue) * 100
              : 0,
          accountNames: Array.from(sec.accountNames || new Set()),
        })),
        accountNames: Array.from(sleeve.accountNames),
      };
    });
  }
  const selectedAccountData = sleeveAllocationData.find(
    (account) => account.accountId === selectedAccountFilter,
  );
  return selectedAccountData
    ? selectedAccountData.sleeves.map((sleeve) => {
        // Calculate aggregated unrealized G/L values for the sleeve
        let totalGainLoss = 0;
        let longTermGainLoss = 0;
        let shortTermGainLoss = 0;

        // Sum up unrealized G/L from all securities in the sleeve
        // (Realized G/L is calculated on-demand during sorting and rendering)
        (sleeve.securities || []).forEach((security) => {
          totalGainLoss += security.totalGainLoss || 0;
          longTermGainLoss += security.longTermGainLoss || 0;
          shortTermGainLoss += security.shortTermGainLoss || 0;
        });

        return {
          ...sleeve,
          // Add aggregated unrealized G/L values
          totalGainLoss,
          longTermGainLoss,
          shortTermGainLoss,
          securities: (sleeve.securities || []).map((sec) => ({
            ...sec,
            accountNames: [selectedAccountData.accountName],
          })),
          accountNames: [selectedAccountData.accountName],
        };
      })
    : [];
};
export type GenerateSleeveTableDataResult = ReturnType<typeof generateSleeveTableData>;
