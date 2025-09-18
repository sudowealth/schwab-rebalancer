import { useEffect, useId, useState } from 'react';
import { updateAccountServerFn } from '../../lib/server-functions';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface Account {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  accountNumber?: string;
}

interface EditAccountModalProps {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  onAccountUpdated?: () => void;
}

const ACCOUNT_TYPES = ['TAXABLE', 'TAX_DEFERRED', 'TAX_EXEMPT'];

const formatAccountType = (type: string): string => {
  if (!type) return '';
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function EditAccountModal({
  account,
  open,
  onOpenChange,
  onClose,
  onAccountUpdated,
}: EditAccountModalProps) {
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const accountNameId = useId();

  // Initialize form with account data
  useEffect(() => {
    if (account && open) {
      setAccountName(account.accountName);
      setAccountType(account.accountType || 'NONE');
      setError('');
    }
  }, [account, open]);

  const handleSubmit = async () => {
    if (!accountName.trim()) {
      setError('Account name is required');
      return;
    }

    if (!account) return;

    setIsLoading(true);
    setError('');

    try {
      await updateAccountServerFn({
        data: {
          accountId: account.accountId,
          name: accountName.trim(),
          type: accountType === 'NONE' ? '' : accountType,
        },
      });

      onAccountUpdated?.();
      onClose();
    } catch (err: unknown) {
      console.error('Failed to update account:', err);
      setError(err instanceof Error ? err.message : 'Failed to update account');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setError('');
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription className="sr-only">
            Update the account name and type information.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={accountNameId}>Account Name</Label>
            <Input
              id={accountNameId}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g., John's Roth IRA"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-type">Account Type</Label>
            <Select value={accountType} onValueChange={setAccountType} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select account type (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">None</SelectItem>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatAccountType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
