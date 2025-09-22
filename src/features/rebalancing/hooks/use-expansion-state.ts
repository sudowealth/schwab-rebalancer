import { useState } from 'react';

export function useExpansionState() {
  const [expandedSleeves, setExpandedSleeves] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  const toggleSleeveExpansion = (sleeveKey: string) => {
    setExpandedSleeves((prev) => {
      const next = new Set(prev);
      next.has(sleeveKey) ? next.delete(sleeveKey) : next.add(sleeveKey);
      return next;
    });
  };

  const toggleAccountExpansion = (accountKey: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      next.has(accountKey) ? next.delete(accountKey) : next.add(accountKey);
      return next;
    });
  };

  const expandAllAccounts = (
    sleeveAllocationData: Array<{ accountId: string; sleeves: Array<{ sleeveId: string }> }>,
  ) => {
    const allAccountKeys = sleeveAllocationData.map((account) => account.accountId);
    const allSleeveKeys: string[] = [];
    sleeveAllocationData.forEach((account) => {
      account.sleeves.forEach((sleeve) => {
        allSleeveKeys.push(`${account.accountId}-${sleeve.sleeveId}`);
      });
    });
    setExpandedAccounts(new Set(allAccountKeys));
    setExpandedSleeves(new Set(allSleeveKeys));
  };

  const expandAllCompositeAccounts = (
    sleeveTableData: Array<{ sleeveId: string }>,
    sleeveAllocationData: Array<{ accountId: string; sleeves: Array<{ sleeveId: string }> }>,
  ) => {
    const allSleeveKeys = sleeveTableData.map((sleeve) => sleeve.sleeveId);
    setExpandedSleeves(new Set(allSleeveKeys));

    // Build composite account keys: `${sleeveId}-${accountId}`
    const allCompositeAccountKeys: string[] = [];
    sleeveTableData.forEach((sleeve) => {
      sleeveAllocationData.forEach((account) => {
        const hasSleeve = account.sleeves.some((s) => s.sleeveId === sleeve.sleeveId);
        if (hasSleeve) {
          allCompositeAccountKeys.push(`${sleeve.sleeveId}-${account.accountId}`);
        }
      });
    });
    setExpandedAccounts(new Set(allCompositeAccountKeys));
  };

  const collapseAll = () => {
    setExpandedSleeves(new Set());
    setExpandedAccounts(new Set());
    setIsAllExpanded(false);
  };

  const toggleExpandAll = (
    groupingMode: 'sleeve' | 'account',
    sleeveTableData: Array<{ sleeveId: string }>,
    sleeveAllocationData: Array<{ accountId: string; sleeves: Array<{ sleeveId: string }> }>,
  ) => {
    if (isAllExpanded) {
      collapseAll();
    } else {
      if (groupingMode === 'sleeve') {
        expandAllCompositeAccounts(sleeveTableData, sleeveAllocationData);
      } else {
        expandAllAccounts(sleeveAllocationData);
      }
      setIsAllExpanded(true);
    }
  };

  return {
    expandedSleeves,
    expandedAccounts,
    isAllExpanded,
    toggleSleeveExpansion,
    toggleAccountExpansion,
    toggleExpandAll,
    collapseAll,
    setIsAllExpanded,
  };
}
