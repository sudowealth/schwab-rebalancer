import { useState } from 'react';
import type {
  SortDirection,
  SortField,
} from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-table-headers';

export function useSortingState() {
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(undefined);
      } else {
        setSortDirection('asc');
      }
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return {
    sortField,
    sortDirection,
    handleSort,
  };
}
