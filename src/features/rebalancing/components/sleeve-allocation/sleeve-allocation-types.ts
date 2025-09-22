import type { ReactNode } from 'react';
import type { SortDirection, SortField } from './sleeve-allocation-table-headers';

// UI-specific types that extend base types with additional properties
export interface Security extends Record<string, unknown> {
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
  accountNames: string[]; // UI uses array format
  costBasis?: number;
  costBasisPerShare?: number;
  openedAt?: Date | null;
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
  securities?: Security[];
}

export interface SleeveTableData extends Record<string, unknown> {
  sleeveId: string;
  sleeveName?: string;
  currentValue: number;
  targetValue: number;
  currentPercent?: number;
  targetPercent: number;
  difference?: number;
  differencePercent?: number;
  securities?: Security[];
  accountName?: string;
  ticker?: string;
  accountId?: string;
  totalValue?: number;
  hasWashSaleRisk?: boolean;
  washSaleInfo?: unknown;
  currentPrice?: number;
  totalGainLoss?: number;
  longTermGainLoss?: number;
  shortTermGainLoss?: number;
  accountNames?: string[];
}

export interface SleeveAllocationData extends Record<string, unknown> {
  accountId: string;
  accountName: string;
  accountType?: string;
  accountNumber?: string;
  totalValue?: number;
  sleeves: SleeveTableData[];
}

import type { RebalancingGroupsResult } from '~/lib/db-api';
export type GroupMember = RebalancingGroupsResult[number]['members'][number] & {
  accountName: string; // Ensure accountName is required for UI
  balance?: number; // Make balance optional
};

// Import base types from central location
import type { AccountHolding as BaseAccountHolding, Trade as BaseTrade } from '~/types/rebalance';

// Extend Trade to include ticker for UI purposes
export interface Trade extends BaseTrade {
  ticker?: string;
}

// Re-export AccountHolding
export type AccountHolding = BaseAccountHolding;

export interface SleeveAllocationTableProps {
  sleeveTableData: SleeveTableData[];
  expandedSleeves: Set<string>;
  expandedAccounts: Set<string>;
  groupMembers: GroupMember[];
  sleeveAllocationData: SleeveAllocationData[];
  groupingMode: 'sleeve' | 'account';
  onGroupingModeChange: (mode: 'sleeve' | 'account') => void;
  onSleeveExpansionToggle: (sleeveKey: string) => void;
  onAccountExpansionToggle: (accountKey: string) => void;
  onTickerClick: (ticker: string) => void;
  onSleeveClick: (sleeveId: string) => void;
  onRebalance?: () => void;
  onToggleExpandAll?: () => void;
  isAllExpanded?: boolean;
  trades?: Trade[];
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSort?: (field: SortField) => void;
  onTradeQtyChange?: (ticker: string, newQty: number, isPreview?: boolean) => void;
  accountHoldings?: AccountHolding[];
  renderSummaryCards?: () => ReactNode;
  groupId: string;
  isRebalancing?: boolean;
}
