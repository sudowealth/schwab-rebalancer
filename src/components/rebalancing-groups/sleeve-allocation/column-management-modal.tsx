import { GripVertical, Settings } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  locked?: boolean; // Some columns like "Sleeve" can't be hidden
}

interface ColumnManagementModalProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

export const ColumnManagementModal: React.FC<ColumnManagementModalProps> = ({
  columns,
  onColumnsChange,
}) => {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalColumns([...columns]);
  }, [columns]);

  const handleVisibilityChange = (columnId: string, checked: boolean) => {
    setLocalColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, visible: checked } : col)),
    );
  };

  const handleSave = () => {
    onColumnsChange(localColumns);
    setIsOpen(false);
  };

  const handleReset = () => {
    // Reset to default visibility (all visible)
    const resetColumns = localColumns.map((col) => ({ ...col, visible: true }));
    setLocalColumns(resetColumns);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newColumns = [...localColumns];
    const draggedColumn = newColumns[draggedIndex];

    // Remove dragged column
    newColumns.splice(draggedIndex, 1);

    // Insert at new position
    newColumns.splice(dropIndex, 0, draggedColumn);

    setLocalColumns(newColumns);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Manage columns" title="Columns">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Table Columns</DialogTitle>
        </DialogHeader>

        <ul className="space-y-2 max-h-96 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-4">
            Check/uncheck to show/hide columns. Drag to reorder.
          </p>

          {localColumns.map((column, index) => (
            <li
              key={column.id}
              className={`flex items-center gap-3 p-2 rounded border ${
                draggedIndex === index ? 'opacity-50' : ''
              } ${column.locked ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}
              draggable={!column.locked}
              onDragStart={(e) => !column.locked && handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              aria-grabbed={draggedIndex === index}
            >
              {!column.locked && <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />}

              <Checkbox
                id={column.id}
                checked={column.visible}
                onCheckedChange={(checked) =>
                  !column.locked && handleVisibilityChange(column.id, checked as boolean)
                }
                disabled={column.locked}
              />

              <label
                htmlFor={column.id}
                className={`flex-1 text-sm ${column.locked ? 'text-gray-500' : 'cursor-pointer'}`}
              >
                {column.label}
                {column.locked && <span className="text-xs text-gray-400 ml-1">(required)</span>}
              </label>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleReset}>
            Reset All
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Apply Changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
