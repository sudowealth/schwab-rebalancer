export type RebalanceMethod = 'allocation' | 'tlhSwap' | 'tlhRebalance' | 'investCash';

export interface RebalanceRequest {
  portfolioId: string;
  method: RebalanceMethod;
  allowOverinvestment?: boolean;
  maxOverinvestmentPercent?: number;
  cashAmount?: number;
}

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

export interface RebalanceSummary {
  totalBuyValue: number;
  totalSellValue: number;
  estimatedTaxLoss: number;
  tradeCount: number;
}

// Use function return type instead of manual interface
export type { ExecuteRebalanceResult as RebalanceResponse } from '../lib/rebalance-logic';

export interface SleeveTarget {
  ticker: string;
  targetWeight: number;
  targetValue: number;
  currentValue: number;
  currentWeight: number;
  drift: number;
  marketPrice?: number;
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
