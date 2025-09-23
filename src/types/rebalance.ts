export type RebalanceMethod = 'allocation' | 'tlhSwap' | 'tlhRebalance' | 'investCash';

export interface Trade {
  accountId: string;
  securityId: string;
  action: 'BUY' | 'SELL';
  qty: number;
  estPrice: number;
  estValue: number;
}

export interface HoldingPost {
  securityId: string;
  qty: number;
}

export interface SleeveSummary {
  sleeveId: string;
  tradeQty: number;
  tradeUSD: number;
  postPct: number;
}

export interface AccountHolding {
  accountId: string;
  ticker: string;
  qty: number;
  costBasis: number;
  marketValue: number;
  unrealizedGain: number;
  isTaxable: boolean;
  purchaseDate: Date;
}

export interface AccountSummaryMember {
  id: string;
  accountId: string;
  isActive: boolean;
  balance: number;
  accountName: string;
  accountNumber: string;
  accountType: string;
}

export interface WashSaleRestriction {
  ticker: string;
  restrictedUntil: Date;
  reason: string;
}

export interface SecurityReplacement {
  originalTicker: string;
  replacementTicker: string;
  rank: number;
}

// Server function return types for type safety - matches actual server function returns
export interface RebalancingGroupData {
  group: {
    id: string;
    name: string;
    isActive: boolean;
    members: Array<{
      balance: number;
      id: string;
      accountId: string;
      isActive: boolean;
      accountName?: string;
      accountType?: string;
    }>;
    assignedModel?: {
      id: string;
      name: string;
      isActive: boolean;
      members: Array<{
        id: string;
        sleeveId: string;
        targetWeight: number;
        isActive: boolean;
        sleeveName?: string;
      }>;
      description?: string;
      createdAt?: Date;
      updatedAt?: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  };
  accountHoldings: Array<{
    accountBalance: number;
    accountId: string;
    accountName: string;
    accountType: string;
    accountNumber: string;
    totalValue: number;
    holdings: Array<{
      id: string;
      ticker: string;
      qty: number;
      currentPrice: number;
      costBasis: number;
      marketValue: number;
      unrealizedGainLoss: number;
      isTaxable: boolean;
      purchaseDate: Date;
      openedAt: Date;
      totalGainLoss: number;
      longTermGainLoss: number;
      shortTermGainLoss: number;
      realizedGainLoss: number;
      realizedLongTermGainLoss: number;
      realizedShortTermGainLoss: number;
    }>;
  }>;
  sleeveMembers: Array<{
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
  }>;
  sp500Data: Array<{
    ticker: string;
    name: string;
    price: number;
    marketCap: string;
    industry: string;
    sector: string;
    peRatio?: number;
  }>;
  transactions: Array<{
    id: string;
    sleeveId: string;
    sleeveName: string;
    ticker: string;
    type: 'BUY' | 'SELL';
    qty: number;
    price: number;
    executedAt: Date;
    realizedGainLoss: number;
    accountId: string;
    accountName: string;
    accountType: string;
    isLongTerm?: boolean;
    accountNumber?: string;
  }>;
  positions: Array<{
    id: string;
    sleeveId: string;
    sleeveName: string;
    ticker: string;
    qty: number;
    costBasis: number;
    currentPrice: number;
    marketValue: string;
    dollarGainLoss: string;
    percentGainLoss: string;
    daysHeld: number;
    accountId: string;
    accountName: string;
    accountType: string;
    accountNumber?: string;
  }>;
  proposedTrades: Array<{
    id: string;
    type: 'BUY' | 'SELL';
    ticker: string;
    sleeveId: string;
    sleeveName: string;
    qty: number;
    currentPrice: number;
    estimatedValue: number;
    reason: string;
    canExecute: boolean;
    accountId: string;
    accountName: string;
    accountType: string;
    accountNumber?: string;
  }>;
  allocationData: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  holdingsData: Array<{
    ticker: string;
    value: number;
    percentage: number;
  }>;
  sleeveTableData: Array<{
    totalGainLoss: number;
    longTermGainLoss: number;
    shortTermGainLoss: number;
    securities: Array<{
      accountNames: string[];
      isHeld: boolean;
      ticker: string;
      isTarget?: boolean;
      hasWashSaleRisk?: boolean;
      washSaleInfo?: unknown;
      targetValue: number;
      targetPercent: number;
      currentValue: number;
      currentPercent: number;
      difference: number;
      differencePercent: number;
      qty: number;
      currentPrice?: number;
      costBasis?: number;
      costBasisPerShare?: number;
      openedAt?: Date;
      totalGainLoss?: number;
      longTermGainLoss?: number;
      shortTermGainLoss?: number;
      realizedGainLoss?: number;
      realizedLongTermGainLoss?: number;
      realizedShortTermGainLoss?: number;
      sleeveName?: string;
      accountName?: string;
      sleeveId?: string;
      accountId?: string;
      securities?: unknown[];
    }>;
    accountNames: string[];
    sleeveId: string;
    sleeveName: string;
    targetValue: number;
    currentValue: number;
    targetPercent: number;
    currentPercent: number;
    difference: number;
    differencePercent: number;
  }>;
  sleeveAllocationData: Array<{
    accountId: string;
    accountName: string;
    accountType: string;
    accountNumber: string;
    totalValue: number;
    sleeves: Array<{
      sleeveId: string;
      sleeveName: string;
      targetPercent: number;
      targetValue: number;
      currentValue: number;
      currentPercent: number;
      difference: number;
      differencePercent: number;
      securities: Array<{
        ticker: string;
        isHeld: boolean;
        accountNames: string[];
        isTarget?: boolean;
        hasWashSaleRisk?: boolean;
        washSaleInfo?: unknown;
        qty: number;
        currentValue: number;
        targetValue: number;
        currentPercent: number;
        targetPercent: number;
        difference: number;
        differencePercent: number;
        currentPrice?: number;
        costBasis?: number;
        costBasisPerShare?: number;
        openedAt?: Date;
        totalGainLoss?: number;
        longTermGainLoss?: number;
        shortTermGainLoss?: number;
        realizedGainLoss?: number;
        realizedLongTermGainLoss?: number;
        realizedShortTermGainLoss?: number;
        accountName?: string;
        accountId?: string;
        sleeveName?: string;
        sleeveId?: string;
        securities?: unknown[];
      }>;
    }>;
  }>;
  groupOrders: Array<{
    id: string;
    userId: string;
    accountId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    qty: number;
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
    tif: 'DAY' | 'GTC';
    session: 'NORMAL' | 'AM' | 'PM' | 'ALL';
    duration?: string;
    price?: number;
    stopPrice?: number;
    status: string;
    filledQty?: number;
    remainingQty?: number;
    avgFillPrice?: number;
    createdAt: Date;
    updatedAt?: Date;
    externalId?: string;
    batchId?: string;
    batchLabel?: string;
    estimatedCommission?: number;
    estimatedFees?: number;
  }>;
  transformedAccountHoldings: Array<{
    accountId: string;
    ticker: string;
    qty: number;
    costBasis: number;
    marketValue: number;
    unrealizedGain: number;
    isTaxable: boolean;
    purchaseDate: Date;
  }>;
}
