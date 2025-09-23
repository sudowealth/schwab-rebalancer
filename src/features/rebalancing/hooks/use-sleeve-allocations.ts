import { useMemo } from 'react';
import {
  calculateSleeveAllocations,
  generateSleeveTableData,
} from '~/features/rebalancing/rebalancing-utils';

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
