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
