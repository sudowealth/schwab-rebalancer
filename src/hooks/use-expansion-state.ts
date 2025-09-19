import { useState } from 'react';

export function useExpansionState() {
  const [expandedSleeves, setExpandedSleeves] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  const toggleSleeveExpansion = (sleeveId: string) => {
    const newExpanded = new Set(expandedSleeves);
    if (newExpanded.has(sleeveId)) {
      newExpanded.delete(sleeveId);
    } else {
      newExpanded.add(sleeveId);
    }
    setExpandedSleeves(newExpanded);
  };

  const toggleAccountExpansion = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  return {
    expandedSleeves,
    setExpandedSleeves,
    expandedAccounts,
    setExpandedAccounts,
    isAllExpanded,
    setIsAllExpanded,
    toggleSleeveExpansion,
    toggleAccountExpansion,
  };
}
