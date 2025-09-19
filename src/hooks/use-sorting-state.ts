import { useState } from 'react';
import type {
  SortDirection,
  SortField,
} from '../components/rebalancing-groups/sleeve-allocation/sleeve-allocation-table-headers';

export function useSortingState() {
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null -> asc
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(undefined);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return {
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    handleSort,
  };
}
