import { useMemo } from 'react';
import { calculateSleeveAllocations, generateSleeveTableData } from '../lib/rebalancing-utils';

export function useSleeveAllocations(
  group: Parameters<typeof calculateSleeveAllocations>[0],
  accountHoldings: Parameters<typeof calculateSleeveAllocations>[1],
  sleeveMembers: Parameters<typeof calculateSleeveAllocations>[2],
  transactions: Parameters<typeof calculateSleeveAllocations>[3],
  selectedAccountFilter: string,
  totalValue: number,
) {
  const sleeveAllocationData = useMemo(() => {
    // Type-safe adapters instead of casting
    const adaptedGroup = {
      ...group,
      members: group.members.map((member) => ({
        ...member,
        accountName: member.accountName || '',
        balance: member.balance || 0,
      })),
    };

    return calculateSleeveAllocations(adaptedGroup, accountHoldings, sleeveMembers, transactions);
  }, [group, accountHoldings, sleeveMembers, transactions]);

  const sleeveTableData = useMemo(() => {
    return generateSleeveTableData(sleeveAllocationData, selectedAccountFilter, totalValue);
  }, [sleeveAllocationData, selectedAccountFilter, totalValue]);

  return {
    sleeveAllocationData,
    sleeveTableData,
  };
}
