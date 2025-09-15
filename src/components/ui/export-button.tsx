import { Download, Loader2 } from 'lucide-react';
import { Button } from './button';

interface ExportButtonProps {
  onExport: () => Promise<void> | void;
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
}

export function ExportButton({
  onExport,
  disabled = false,
  isLoading = false,
  label = 'Export to Excel',
}: ExportButtonProps) {
  return (
    <Button
      onClick={onExport}
      disabled={disabled || isLoading}
      aria-label={label}
      title={label}
      variant="outline"
      size="sm"
      className="h-9 w-9 px-0"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
}
