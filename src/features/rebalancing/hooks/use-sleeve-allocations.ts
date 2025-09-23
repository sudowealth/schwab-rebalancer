import { useMemo } from 'react';
import type {
  SleeveAllocationData,
  SleeveTableData,
  Trade,
} from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-types';
import {
  calculateSleeveAllocations,
  generateSleeveTableData,
} from '~/features/rebalancing/utils/rebalancing-utils';

export function useSleeveAllocations(
  group: Parameters<typeof calculateSleeveAllocations>[0],
  accountHoldings: Parameters<typeof calculateSleeveAllocations>[1],
  sleeveMembers: Parameters<typeof calculateSleeveAllocations>[2],
  transactions: Parameters<typeof calculateSleeveAllocations>[3],
  selectedAccountFilter: string,
  totalValue: number,
) {
  // Create a stable reference for the group with only the assignedModel to avoid
  // unnecessary recalculations when other group properties change
  const stableGroupRef = useMemo(
    () => ({
      assignedModel: group.assignedModel,
    }),
    [group.assignedModel],
  );

  const sleeveAllocationData = useMemo(() => {
    return calculateSleeveAllocations(
      stableGroupRef as Parameters<typeof calculateSleeveAllocations>[0],
      accountHoldings,
      sleeveMembers,
      transactions,
    );
  }, [stableGroupRef, accountHoldings, sleeveMembers, transactions]);

  const sleeveTableData = useMemo(() => {
    return generateSleeveTableData(sleeveAllocationData, selectedAccountFilter, totalValue);
  }, [sleeveAllocationData, selectedAccountFilter, totalValue]);

  return {
    sleeveAllocationData,
    sleeveTableData,
  };
}

export function useAvailableCash(
  sleeveTableData: Array<{ sleeveId: string; currentValue?: number }>,
) {
  return useMemo(() => {
    const sleeveData = sleeveTableData.find((sleeve) => sleeve.sleeveId === 'cash');
    return sleeveData?.currentValue || 0;
  }, [sleeveTableData]);
}

export function useTransformedSleeveTableData(
  sleeveTableData: SleeveTableData[],
): SleeveTableData[] {
  return useMemo(
    () =>
      sleeveTableData.map((sleeve) => ({
        ...sleeve,
        targetPercent:
          'targetPercent' in sleeve && typeof sleeve.targetPercent === 'number'
            ? sleeve.targetPercent
            : 0,
      })),
    [sleeveTableData],
  );
}

export function useTransformedSleeveAllocationData(
  sleeveAllocationData: Record<string, unknown>[],
): SleeveAllocationData[] {
  return useMemo(
    () =>
      sleeveAllocationData.map((account) => ({
        ...account,
        sleeves: (account.sleeves as Record<string, unknown>[]).map((sleeve) => ({
          ...sleeve,
          targetPercent:
            'targetPercent' in sleeve && typeof sleeve.targetPercent === 'number'
              ? sleeve.targetPercent
              : 0,
          securities: ((sleeve.securities as Record<string, unknown>[]) || []).map((security) => ({
            ...security,
            targetPercent: (security.targetPercent as number) || 0,
            accountNames: Array.isArray(security.accountNames)
              ? security.accountNames
              : Array.from((security.accountNames as Set<string> | string[]) || []),
          })),
        })),
      })) as SleeveAllocationData[],
    [sleeveAllocationData],
  );
}

export function useTransformedAccountHoldings(
  accountHoldings: Array<{
    accountId: string;
    accountType?: string;
    holdings: Array<{
      ticker: string;
      qty?: number;
      costBasisPerShare?: number;
      marketValue?: number;
      unrealizedGain?: number;
      openedAt?: Date;
    }>;
  }>,
) {
  return useMemo(
    () =>
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
        : [],
    [accountHoldings],
  );
}

export function useFilteredAllocationData(
  allocationData: Array<{
    name?: string | null;
    value?: number | null;
    percentage?: number | null;
    color?: string | null;
    [key: string]: unknown;
  }>,
) {
  return useMemo(
    () =>
      allocationData.filter(
        (
          item,
        ): item is {
          name: string;
          value: number;
          percentage: number;
          color: string;
          [key: string]: unknown;
        } => item.name != null && item.value != null,
      ),
    [allocationData],
  );
}

export function useAccountSummaryMembers(
  groupMembers: Array<{
    id: string;
    accountId: string;
    accountName?: string;
    accountType?: string;
    accountNumber?: string;
    balance?: number;
    [key: string]: unknown;
  }>,
) {
  return useMemo(
    () =>
      groupMembers.map((member) => ({
        id: member.id,
        accountId: member.accountId,
        accountName: member.accountName || '',
        accountType: member.accountType || '',
        accountNumber: (member as { accountNumber?: string }).accountNumber,
        balance: member.balance || 0,
      })),
    [groupMembers],
  );
}

export function useSleeveTableGroupMembers(
  groupMembers: Array<{
    id: string;
    accountId: string;
    accountName?: string;
    accountType?: string;
    isActive: boolean;
    balance?: number;
    [key: string]: unknown;
  }>,
) {
  return useMemo(
    () =>
      groupMembers.map((member) => ({
        ...member,
        accountName: member.accountName || '',
        accountType: member.accountType || '',
      })),
    [groupMembers],
  );
}

export function useSummaryTrades(rebalanceTrades: Trade[]) {
  return useMemo(
    () =>
      rebalanceTrades
        .filter((trade) => trade.securityId || trade.ticker)
        .map((trade) => ({
          ...trade,
          securityId: trade.securityId || trade.ticker || '',
        })),
    [rebalanceTrades],
  );
}
