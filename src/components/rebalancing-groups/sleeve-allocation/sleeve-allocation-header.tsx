import { Target } from "lucide-react";
import { useState } from "react";
import { CardHeader, CardTitle, CardDescription } from "../../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Button } from "../../ui/button";
import { ExportButton } from "../../ui/export-button";
import { ColumnManagementModal, ColumnConfig } from "./column-management-modal";

interface SleeveAllocationHeaderProps {
  selectedAccountFilter: string;
  groupingMode: "sleeve" | "account";
  groupMembers: {
    accountId: string;
    accountName: string;
  }[];
  onAccountFilterChange: (value: string) => void;
  onGroupingModeChange: (mode: "sleeve" | "account") => void;
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
  selectedAccountFilter,
  groupingMode,
  groupMembers,
  onAccountFilterChange,
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
    <CardHeader>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Current vs Target Allocation
          </CardTitle>
          <CardDescription>
            Compare current allocations with target percentages{" "}
            {selectedAccountFilter !== "all" &&
              `for ${groupMembers.find((m) => m.accountId === selectedAccountFilter)?.accountName || selectedAccountFilter}`}
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {columns && onColumnsChange && (
            <ColumnManagementModal
              columns={columns}
              onColumnsChange={onColumnsChange}
            />
          )}

          <ExportButton onExport={handleExportClick} isLoading={isExporting} />

          {onRebalance && <Button onClick={onRebalance}>Rebalance</Button>}
          {addToBlotter?.visible && (
            <Button
              onClick={addToBlotter.onClick}
              disabled={!!addToBlotter.disabled}
            >
              {addToBlotter.disabled
                ? "Adding..."
                : addToBlotter.count && addToBlotter.count > 0
                  ? `Add ${addToBlotter.count} to Blotter`
                  : "Add to Blotter"}
            </Button>
          )}
        </div>
      </div>

      {/* Only show controls when there are multiple accounts */}
      {groupMembers.length > 1 && (
        <div className="flex items-center gap-4 mt-4">
          {/* Account Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Account:</label>
            <Select
              value={selectedAccountFilter}
              onValueChange={onAccountFilterChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {groupMembers.map((member) => (
                  <SelectItem key={member.accountId} value={member.accountId}>
                    {member.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group by toggle - only when viewing all accounts */}
          {selectedAccountFilter === "all" && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Group by:</label>
              <div className="flex items-center">
                <Button
                  variant={groupingMode === "sleeve" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onGroupingModeChange("sleeve")}
                  className="rounded-r-none"
                >
                  By Sleeve
                </Button>
                <Button
                  variant={groupingMode === "account" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onGroupingModeChange("account")}
                  className="rounded-l-none border-l-0"
                >
                  By Account
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </CardHeader>
  );
};
