import { Target } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/button';
import { CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { ExportButton } from '../../ui/export-button';
import { type ColumnConfig, ColumnManagementModal } from './column-management-modal';

interface SleeveAllocationHeaderProps {
  groupingMode: 'sleeve' | 'account';
  groupMembers: {
    accountId: string;
    accountName: string;
  }[];
  onGroupingModeChange: (mode: 'sleeve' | 'account') => void;
  onRebalance?: () => void;
  onExportToExcel: () => Promise<void> | void;
  columns?: ColumnConfig[];
  onColumnsChange?: (columns: ColumnConfig[]) => void;
  addToBlotter?: {
    onClick: () => void;
    disabled?: boolean;
    visible?: boolean;
    count?: number;
  };
}

export const SleeveAllocationHeader: React.FC<SleeveAllocationHeaderProps> = ({
  groupingMode,
  groupMembers,
  onGroupingModeChange,
  onRebalance,
  onExportToExcel,
  columns,
  onColumnsChange,
  addToBlotter,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const handleExportClick = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await onExportToExcel();
    } finally {
      setIsExporting(false);
    }
  };
  // Show "Add to Blotter" button when there are trades (active rebalance)
  return (
    <CardHeader className="pb-0">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Rebalance Summary
          </CardTitle>
          <CardDescription>Generate trade recommendations for the group</CardDescription>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {onRebalance && <Button onClick={onRebalance}>Rebalance</Button>}
          {addToBlotter?.visible && (
            <Button onClick={addToBlotter.onClick} disabled={!!addToBlotter.disabled}>
              {addToBlotter.disabled
                ? 'Adding...'
                : addToBlotter.count && addToBlotter.count > 0
                  ? `Add ${addToBlotter.count} to Blotter`
                  : 'Add to Blotter'}
            </Button>
          )}
        </div>
      </div>

      {/* Only show controls when there are multiple accounts */}
      {groupMembers.length > 1 && (
        <div className="flex items-center justify-between mt-4">
          {/* Group by toggle on the left */}
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Button
                variant={groupingMode === 'sleeve' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onGroupingModeChange('sleeve')}
                className="rounded-r-none"
              >
                By Sleeve
              </Button>
              <Button
                variant={groupingMode === 'account' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onGroupingModeChange('account')}
                className="rounded-l-none border-l-0"
              >
                By Account
              </Button>
            </div>
          </div>

          {/* Export and Column Management buttons on the right */}
          <div className="flex items-center gap-2">
            {columns && onColumnsChange && (
              <ColumnManagementModal columns={columns} onColumnsChange={onColumnsChange} />
            )}
            <ExportButton onExport={handleExportClick} isLoading={isExporting} />
          </div>
        </div>
      )}
    </CardHeader>
  );
};
