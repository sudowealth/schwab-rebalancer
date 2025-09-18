import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp } from 'lucide-react';
import React from 'react';

type SortableHeaderProps = {
  field: SortField;
  children: React.ReactNode;
  className?: string;
  onSort?: (field: SortField) => void;
  getSortIcon: (field: SortField) => React.ReactNode;
};

function SortableHeader({
  field,
  children,
  className = 'text-right p-2',
  onSort,
  getSortIcon,
}: SortableHeaderProps) {
  return (
    <th className={className}>
      {onSort ? (
        <button
          type="button"
          onClick={() => onSort(field)}
          className="flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-end"
        >
          {children}
          {getSortIcon(field)}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

import type { ColumnConfig } from './column-management-modal';

export type SortField =
  | 'name'
  | 'currentValue'
  | 'currentPercent'
  | 'targetValue'
  | 'targetPercent'
  | 'difference'
  | 'percentDistance'
  | 'costBasis'
  | 'openedAt'
  | 'totalGainLoss'
  | 'longTermGainLoss'
  | 'shortTermGainLoss'
  | 'realizedGainLoss'
  | 'realizedLongTermGainLoss'
  | 'realizedShortTermGainLoss'
  | 'action'
  | 'tradeQty'
  | 'tradeValue'
  | 'postTradePercent'
  | 'postTradeDiff'
  | 'postTradeDiffPercent';
export type SortDirection = 'asc' | 'desc' | null;

interface TableHeadersProps {
  hasTrades: boolean;
  groupingMode: 'sleeve' | 'account';
  onToggleExpandAll?: () => void;
  isAllExpanded?: boolean;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSort?: (field: SortField) => void;
  visibleColumns?: ColumnConfig[];
  columnOrder?: string[];
}

export const TableHeaders: React.FC<TableHeadersProps> = ({
  hasTrades,
  groupingMode,
  onToggleExpandAll,
  isAllExpanded,
  sortField,
  sortDirection,
  onSort,
  visibleColumns,
  columnOrder,
}) => {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3 w-3 text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-3 w-3 text-blue-600" />;
    }
    if (sortDirection === 'desc') {
      return <ChevronDown className="h-3 w-3 text-blue-600" />;
    }
    return <ChevronsUpDown className="h-3 w-3 text-gray-400" />;
  };

  // (SortableHeader moved to top-level)

  // Define all possible columns with their configurations
  const allColumnConfigs = [
    {
      id: 'name',
      field: 'name' as SortField,
      label: groupingMode === 'sleeve' ? 'Sleeve' : 'Account',
      className:
        'text-left p-2 sticky left-0 bg-white z-40 shadow-[1px_0_0_0_rgba(229,231,235,1),2px_0_4px_-2px_rgba(0,0,0,0.1)] w-64 max-w-64',
      locked: true,
      render: () => (
        <th className="text-left p-2 sticky left-0 bg-white z-40 shadow-[1px_0_0_0_rgba(229,231,235,1),2px_0_4px_-2px_rgba(0,0,0,0.1)] w-64 max-w-64">
          <div className="flex items-center gap-2">
            {onToggleExpandAll && (
              <button
                type="button"
                onClick={onToggleExpandAll}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                {isAllExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {onSort ? (
              <button
                type="button"
                onClick={() => onSort('name')}
                className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              >
                <span>{groupingMode === 'sleeve' ? 'Sleeve' : 'Account'}</span>
                {getSortIcon('name')}
              </button>
            ) : (
              <span>{groupingMode === 'sleeve' ? 'Sleeve' : 'Account'}</span>
            )}
          </div>
        </th>
      ),
    },
    {
      id: 'currentValue',
      field: 'currentValue' as SortField,
      label: 'Current $',
      render: () => (
        <SortableHeader field="currentValue" onSort={onSort} getSortIcon={getSortIcon}>
          Current $
        </SortableHeader>
      ),
    },
    {
      id: 'currentPercent',
      field: 'currentPercent' as SortField,
      label: 'Current %',
      render: () => (
        <SortableHeader field="currentPercent" onSort={onSort} getSortIcon={getSortIcon}>
          Current %
        </SortableHeader>
      ),
    },
    {
      id: 'currentQty',
      label: 'Current QTY',
      render: () => <th className="text-right p-2">Current QTY</th>,
    },
    {
      id: 'costBasis',
      field: 'costBasis' as SortField,
      label: 'Cost Basis',
      render: () => (
        <SortableHeader field="costBasis" onSort={onSort} getSortIcon={getSortIcon}>
          Cost Basis
        </SortableHeader>
      ),
    },
    {
      id: 'price',
      label: 'Price',
      render: () => <th className="text-right p-2">Price</th>,
    },
    {
      id: 'targetValue',
      field: 'targetValue' as SortField,
      label: 'Target $',
      render: () => (
        <SortableHeader field="targetValue" onSort={onSort} getSortIcon={getSortIcon}>
          Target $
        </SortableHeader>
      ),
    },
    {
      id: 'targetPercent',
      field: 'targetPercent' as SortField,
      label: 'Target %',
      render: () => (
        <SortableHeader field="targetPercent" onSort={onSort} getSortIcon={getSortIcon}>
          Target %
        </SortableHeader>
      ),
    },
    {
      id: 'targetQty',
      label: 'Target QTY',
      render: () => <th className="text-right p-2">Target QTY</th>,
    },
    {
      id: 'difference',
      field: 'difference' as SortField,
      label: 'Diff $',
      render: () => (
        <SortableHeader field="difference" onSort={onSort} getSortIcon={getSortIcon}>
          Diff $
        </SortableHeader>
      ),
    },
    {
      id: 'percentDistance',
      field: 'percentDistance' as SortField,
      label: 'Diff %',
      render: () => (
        <SortableHeader field="percentDistance" onSort={onSort} getSortIcon={getSortIcon}>
          Diff %
        </SortableHeader>
      ),
    },
    {
      id: 'openedAt',
      field: 'openedAt' as SortField,
      label: 'Opened At',
      render: () => (
        <SortableHeader field="openedAt" onSort={onSort} getSortIcon={getSortIcon}>
          Opened At
        </SortableHeader>
      ),
    },
    {
      id: 'totalGainLoss',
      field: 'totalGainLoss' as SortField,
      label: 'Total G/L',
      render: () => (
        <SortableHeader field="totalGainLoss" onSort={onSort} getSortIcon={getSortIcon}>
          Total G/L
        </SortableHeader>
      ),
    },
    {
      id: 'longTermGainLoss',
      field: 'longTermGainLoss' as SortField,
      label: 'LT G/L',
      render: () => (
        <SortableHeader field="longTermGainLoss" onSort={onSort} getSortIcon={getSortIcon}>
          LT G/L
        </SortableHeader>
      ),
    },
    {
      id: 'shortTermGainLoss',
      field: 'shortTermGainLoss' as SortField,
      label: 'ST G/L',
      render: () => (
        <SortableHeader field="shortTermGainLoss" onSort={onSort} getSortIcon={getSortIcon}>
          ST G/L
        </SortableHeader>
      ),
    },
    {
      id: 'realizedGainLoss',
      field: 'realizedGainLoss' as SortField,
      label: 'Realized G/L',
      render: () => (
        <SortableHeader field="realizedGainLoss" onSort={onSort} getSortIcon={getSortIcon}>
          Realized G/L
        </SortableHeader>
      ),
    },
    {
      id: 'realizedLongTermGainLoss',
      field: 'realizedLongTermGainLoss' as SortField,
      label: 'Realized LT G/L',
      render: () => (
        <SortableHeader field="realizedLongTermGainLoss" onSort={onSort} getSortIcon={getSortIcon}>
          Realized LT G/L
        </SortableHeader>
      ),
    },
    {
      id: 'realizedShortTermGainLoss',
      field: 'realizedShortTermGainLoss' as SortField,
      label: 'Realized ST G/L',
      render: () => (
        <SortableHeader field="realizedShortTermGainLoss" onSort={onSort} getSortIcon={getSortIcon}>
          Realized ST G/L
        </SortableHeader>
      ),
    },
    // Trade columns (only shown when hasTrades is true)
    {
      id: 'action',
      field: 'action' as SortField,
      label: 'Action',
      tradeDependant: true,
      render: () => (
        <SortableHeader
          field="action"
          className="text-center p-2"
          onSort={onSort}
          getSortIcon={getSortIcon}
        >
          Action
        </SortableHeader>
      ),
    },
    {
      id: 'tradeQty',
      field: 'tradeQty' as SortField,
      label: 'Trade QTY',
      tradeDependant: true,
      render: () => (
        <SortableHeader field="tradeQty" onSort={onSort} getSortIcon={getSortIcon}>
          Trade QTY
        </SortableHeader>
      ),
    },
    {
      id: 'tradeValue',
      field: 'tradeValue' as SortField,
      label: 'Trade $',
      tradeDependant: true,
      render: () => (
        <SortableHeader field="tradeValue" onSort={onSort} getSortIcon={getSortIcon}>
          Trade $
        </SortableHeader>
      ),
    },
    {
      id: 'postTradePercent',
      field: 'postTradePercent' as SortField,
      label: 'Post-Trade %',
      tradeDependant: true,
      render: () => (
        <SortableHeader field="postTradePercent" onSort={onSort} getSortIcon={getSortIcon}>
          Post-Trade %
        </SortableHeader>
      ),
    },
    {
      id: 'postTradeDiff',
      field: 'postTradeDiff' as SortField,
      label: 'Post-Trade Diff $',
      tradeDependant: true,
      render: () => (
        <SortableHeader field="postTradeDiff" onSort={onSort} getSortIcon={getSortIcon}>
          Post-Trade Diff $
        </SortableHeader>
      ),
    },
    {
      id: 'postTradeDiffPercent',
      field: 'postTradeDiffPercent' as SortField,
      label: 'Post-Trade Diff %',
      tradeDependant: true,
      render: () => (
        <SortableHeader field="postTradeDiffPercent" onSort={onSort} getSortIcon={getSortIcon}>
          Post-Trade Diff %
        </SortableHeader>
      ),
    },
  ];

  // Get visible columns based on visibility settings and order
  const getVisibleColumns = () => {
    if (!visibleColumns) {
      // Default: show all columns except trade columns when hasTrades is false
      return allColumnConfigs.filter((col) => !col.tradeDependant || hasTrades);
    }

    // Create a map for quick lookup of visibility
    const visibilityMap = visibleColumns.reduce(
      (map, col) => {
        map[col.id] = col.visible;
        return map;
      },
      {} as Record<string, boolean>,
    );

    // Get columns in the specified order
    const orderedColumns = columnOrder || visibleColumns.map((col) => col.id);

    return orderedColumns
      .map((id) => allColumnConfigs.find((col) => col.id === id))
      .filter((col): col is (typeof allColumnConfigs)[0] => {
        if (!col) return false;
        if (col.tradeDependant && !hasTrades) return false;
        return visibilityMap[col.id] !== false;
      });
  };

  const visibleHeaders = getVisibleColumns();

  return (
    <thead className="sticky top-0 z-30 bg-white">
      <tr className="border-b">
        {visibleHeaders.map((col) => (
          <React.Fragment key={col.id}>{col.render()}</React.Fragment>
        ))}
      </tr>
    </thead>
  );
};

// Export function to get default column configurations
export const getDefaultColumnConfigs = (hasTrades: boolean): ColumnConfig[] => {
  const baseColumns: ColumnConfig[] = [
    { id: 'name', label: 'Sleeve/Account', visible: true, locked: true },
    { id: 'currentValue', label: 'Current $', visible: true },
    { id: 'currentPercent', label: 'Current %', visible: true },
    { id: 'currentQty', label: 'Current QTY', visible: true },
    { id: 'costBasis', label: 'Cost Basis', visible: true },
    { id: 'price', label: 'Price', visible: true },
    { id: 'targetValue', label: 'Target $', visible: true },
    { id: 'targetPercent', label: 'Target %', visible: true },
    { id: 'targetQty', label: 'Target QTY', visible: true },
    { id: 'difference', label: 'Diff $', visible: true },
    { id: 'percentDistance', label: 'Diff %', visible: true },
    { id: 'openedAt', label: 'Opened At', visible: true },
    { id: 'totalGainLoss', label: 'Total G/L', visible: true },
    { id: 'longTermGainLoss', label: 'LT G/L', visible: true },
    { id: 'shortTermGainLoss', label: 'ST G/L', visible: true },
    { id: 'realizedGainLoss', label: 'Realized G/L', visible: true },
    { id: 'realizedLongTermGainLoss', label: 'Realized LT G/L', visible: true },
    {
      id: 'realizedShortTermGainLoss',
      label: 'Realized ST G/L',
      visible: true,
    },
  ];

  const tradeColumns: ColumnConfig[] = [
    { id: 'action', label: 'Action', visible: true },
    { id: 'tradeQty', label: 'Trade QTY', visible: true },
    { id: 'tradeValue', label: 'Trade $', visible: true },
    { id: 'postTradePercent', label: 'Post-Trade %', visible: true },
    { id: 'postTradeDiff', label: 'Post-Trade Diff $', visible: true },
    { id: 'postTradeDiffPercent', label: 'Post-Trade Diff %', visible: true },
  ];

  return hasTrades ? [...baseColumns, ...tradeColumns] : baseColumns;
};

// Removed: SecurityTableHeaders - was unused and never imported
