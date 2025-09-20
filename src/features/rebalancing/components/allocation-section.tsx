import type { RebalancingGroup } from '~/features/auth/schemas';
import type { AccountHoldingsResult } from '~/lib/db-api';
import { RebalanceSummaryCards } from './rebalance-summary-cards';
import { SleeveAllocationTable } from './sleeve-allocation/sleeve-allocation-table';
import type { SortDirection, SortField } from './sleeve-allocation/sleeve-allocation-table-headers';
import type { Trade } from './sleeve-allocation/sleeve-allocation-types';

interface AllocationSectionProps {
  group: RebalancingGroup;
  groupId: string;
  sleeveTableData: Array<{
    sleeveId: string;
    sleeveName: string;
    currentValue: number;
    targetValue: number;
    targetPercent?: number;
    totalGainLoss: number;
    longTermGainLoss: number;
    shortTermGainLoss: number;
    accountNames: string[];
    securities: Array<{
      ticker: string;
      currentValue: number;
      targetValue: number;
      targetPercent: number;
      accountNames: string[];
      currentPercent: number;
      difference: number;
      differencePercent: number;
      qty: number;
      isHeld: boolean;
    }>;
  }>;
  sleeveAllocationData: Array<{
    accountId: string;
    accountName: string;
    accountType?: string;
    accountNumber?: string;
    totalValue?: number;
    sleeves: Array<{
      sleeveId: string;
      sleeveName: string;
      currentValue: number;
      targetValue: number;
      targetPercent?: number;
      totalGainLoss?: number;
      longTermGainLoss?: number;
      shortTermGainLoss?: number;
      accountNames?: string[];
      securities: Array<{
        ticker: string;
        currentValue: number;
        targetValue: number;
        targetPercent: number;
        accountNames: string[];
        currentPercent?: number;
        difference?: number;
        differencePercent?: number;
        qty?: number;
        isHeld?: boolean;
      }>;
    }>;
  }>;
  expandedSleeves: Set<string>;
  expandedAccounts: Set<string>;
  groupingMode: 'sleeve' | 'account';
  isAllExpanded: boolean;
  trades: Trade[];
  sortField: SortField | undefined;
  sortDirection: SortDirection;
  accountHoldings: AccountHoldingsResult;
  onGroupingModeChange: (mode: 'sleeve' | 'account') => void;
  onSleeveExpansionToggle: (sleeveId: string) => void;
  onAccountExpansionToggle: (accountId: string) => void;
  onTickerClick: (ticker: string) => void;
  onSleeveClick: (sleeveId: string) => void;
  onRebalance: () => void;
  onToggleExpandAll: () => void;
  onSort: (field: SortField) => void;
  onTradeQtyChange: (tradeId: string, newQty: number) => void;
}

export function AllocationSection({
  group,
  groupId,
  sleeveTableData,
  sleeveAllocationData,
  expandedSleeves,
  expandedAccounts,
  groupingMode,
  isAllExpanded,
  trades,
  sortField,
  sortDirection,
  accountHoldings,
  onGroupingModeChange,
  onSleeveExpansionToggle,
  onAccountExpansionToggle,
  onTickerClick,
  onSleeveClick,
  onRebalance,
  onToggleExpandAll,
  onSort,
  onTradeQtyChange,
}: AllocationSectionProps) {
  if (!group.assignedModel) {
    return null;
  }

  return (
    <SleeveAllocationTable
      groupId={groupId}
      sleeveTableData={sleeveTableData.map((sleeve) => ({
        ...sleeve,
        targetPercent:
          'targetPercent' in sleeve && typeof sleeve.targetPercent === 'number'
            ? sleeve.targetPercent
            : 0,
        totalGainLoss: sleeve.totalGainLoss || 0,
        longTermGainLoss: sleeve.longTermGainLoss || 0,
        shortTermGainLoss: sleeve.shortTermGainLoss || 0,
        accountNames: sleeve.accountNames || [],
        securities:
          sleeve.securities?.map((security) => ({
            ...security,
            currentPercent: security.currentPercent || 0,
            difference: security.difference || 0,
            differencePercent: security.differencePercent || 0,
            qty: security.qty || 0,
            isHeld: security.isHeld || false,
          })) || [],
      }))}
      expandedSleeves={expandedSleeves}
      expandedAccounts={expandedAccounts}
      groupMembers={group.members.map((member) => ({
        ...member,
        accountName: member.accountName || '',
        accountType: member.accountType || '',
      }))}
      sleeveAllocationData={sleeveAllocationData.map((account) => ({
        ...account,
        accountType: account.accountType || 'Unknown',
        accountNumber: account.accountNumber || 'N/A',
        totalValue: account.totalValue || 0,
        sleeves: account.sleeves.map((sleeve) => ({
          ...sleeve,
          targetPercent:
            'targetPercent' in sleeve && typeof sleeve.targetPercent === 'number'
              ? sleeve.targetPercent
              : 0,
          totalGainLoss: sleeve.totalGainLoss || 0,
          longTermGainLoss: sleeve.longTermGainLoss || 0,
          shortTermGainLoss: sleeve.shortTermGainLoss || 0,
          accountNames: sleeve.accountNames || [],
          securities: (sleeve.securities || []).map((security) => ({
            ...security,
            targetPercent: security.targetPercent || 0,
            accountNames: Array.from(security.accountNames || []),
            currentPercent: security.currentPercent || 0,
            difference: security.difference || 0,
            differencePercent: security.differencePercent || 0,
            qty: security.qty || 0,
            isHeld: security.isHeld || false,
          })),
        })),
      }))}
      groupingMode={groupingMode}
      onGroupingModeChange={onGroupingModeChange}
      onSleeveExpansionToggle={onSleeveExpansionToggle}
      onAccountExpansionToggle={onAccountExpansionToggle}
      onTickerClick={onTickerClick}
      onSleeveClick={onSleeveClick}
      onRebalance={onRebalance}
      onToggleExpandAll={onToggleExpandAll}
      isAllExpanded={isAllExpanded}
      trades={trades}
      sortField={sortField}
      sortDirection={sortDirection}
      onSort={onSort}
      onTradeQtyChange={onTradeQtyChange}
      accountHoldings={
        Array.isArray(accountHoldings)
          ? accountHoldings.flatMap((account) =>
              Array.isArray(account.holdings)
                ? account.holdings.map((holding) => ({
                    accountId: account.accountId,
                    ticker: holding.ticker,
                    qty: holding.qty || 0,
                    costBasis: holding.costBasisPerShare || 0,
                    marketValue: holding.marketValue || 0,
                    unrealizedGain: holding.unrealizedGain || 0,
                    isTaxable: account.accountType === 'taxable',
                    purchaseDate: holding.openedAt || new Date(),
                  }))
                : [],
            )
          : []
      }
      renderSummaryCards={() => (
        <RebalanceSummaryCards
          trades={trades
            .filter((trade) => trade.securityId || trade.ticker)
            .map((trade) => ({
              ...trade,
              securityId: trade.securityId || trade.ticker || '',
            }))}
          sleeveTableData={sleeveTableData}
          group={{
            ...group,
            members: group.members.map((member) => ({
              ...member,
              balance: member.balance || 0,
            })),
          }}
          accountHoldings={
            Array.isArray(accountHoldings)
              ? accountHoldings.flatMap((account) =>
                  Array.isArray(account.holdings)
                    ? account.holdings.map((holding) => ({
                        accountId: account.accountId,
                        ticker: holding.ticker,
                        qty: holding.qty || 0,
                        costBasis: holding.costBasisPerShare || 0,
                        marketValue: holding.marketValue || 0,
                        unrealizedGain: holding.unrealizedGain || 0,
                        isTaxable: account.accountType === 'taxable',
                        purchaseDate: holding.openedAt || new Date(),
                      }))
                    : [],
                )
              : []
          }
        />
      )}
    />
  );
}
