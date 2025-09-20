import { X } from 'lucide-react';
import { Badge } from '~/components/ui/badge';

interface Account {
  id: string;
  name: string;
  type: string;
  accountNumber: string | null;
  dataSource: string;
  balance: number;
  isAssigned: boolean;
  assignedGroupName?: string;
}

interface SelectedAccountsDisplayProps {
  selectedAccounts: Set<string>;
  accounts: Account[];
  onRemoveAccount: (accountId: string) => void;
  isLoading?: boolean;
}

export function SelectedAccountsDisplay({
  selectedAccounts,
  accounts,
  onRemoveAccount,
  isLoading = false,
}: SelectedAccountsDisplayProps) {
  if (selectedAccounts.size === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 py-3 rounded-md mb-2">
      {Array.from(selectedAccounts).map((accountId) => {
        const account = accounts.find((a) => a.id === accountId);
        if (!account) return null;
        return (
          <Badge key={accountId} variant="secondary" className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span>{account.name}</span>
              {account.accountNumber && (
                <span className="text-xs text-gray-500">({account.accountNumber})</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemoveAccount(accountId)}
              className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
              disabled={isLoading}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
    </div>
  );
}
