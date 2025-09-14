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
      className="h-8 px-2 text-xs"
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <Download className="h-3 w-3 mr-1" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
