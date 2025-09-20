import { useRouter } from '@tanstack/react-router';
import { useEffect, useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { VirtualizedSelect } from '~/components/ui/virtualized-select';
import type { RebalancingGroup } from '~/features/auth/schemas';
import {
  assignModelToGroupServerFn,
  getAccountsForRebalancingGroupsServerFn,
  getModelsServerFn,
  unassignModelFromGroupServerFn,
  updateRebalancingGroupServerFn,
} from '~/lib/server-functions';
import { SelectedAccountsDisplay } from './selected-accounts-display';

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

interface Model {
  id: string;
  name: string;
  description?: string;
}

interface EditRebalancingGroupModalProps {
  group: RebalancingGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export function EditRebalancingGroupModal({
  group,
  open,
  onOpenChange,
  onClose,
}: EditRebalancingGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const router = useRouter();
  const groupNameId = useId();

  // Initialize form with group data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [accountsData, modelsData] = await Promise.all([
          getAccountsForRebalancingGroupsServerFn({
            data: { excludeGroupId: group.id },
          }),
          getModelsServerFn(),
        ]);
        setAccounts(
          accountsData.map((account) => ({
            ...account,
            type: account.type || '',
          })),
        );
        setModels(modelsData);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load data');
      }
    };

    if (group && open) {
      setGroupName(group.name);
      setSelectedAccounts(new Set(group.members.map((m) => m.accountId)));
      setSelectedModelId(group.assignedModel?.id || '');
      loadData();
    }
  }, [group, open]);

  const handleAccountToggle = (accountId: string) => {
    const newSelection = new Set(selectedAccounts);
    if (newSelection.has(accountId)) {
      newSelection.delete(accountId);
    } else {
      newSelection.add(accountId);
    }
    setSelectedAccounts(newSelection);
  };

  const handleSubmit = async () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    if (selectedAccounts.size === 0) {
      setError('Please select at least one account');
      return;
    }

    if (!selectedModelId) {
      setError('Please select a model for this group');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const members = Array.from(selectedAccounts).map((accountId) => ({
        accountId,
      }));

      // Update the group first
      await updateRebalancingGroupServerFn({
        data: {
          groupId: group.id,
          name: groupName.trim(),
          members,
        },
      });

      // Handle model assignment changes
      const currentModelId = group.assignedModel?.id || '';

      if (selectedModelId !== currentModelId) {
        if (currentModelId && currentModelId !== selectedModelId) {
          // Unassign current model
          await unassignModelFromGroupServerFn({
            data: { modelId: currentModelId, groupId: group.id },
          });
        }
        if (selectedModelId) {
          // Assign new model
          await assignModelToGroupServerFn({
            data: {
              modelId: selectedModelId,
              groupId: group.id,
            },
          });
        }
      }

      onClose();
      router.invalidate();
    } catch (err: unknown) {
      console.error('Failed to update rebalancing group:', err);
      setError(err instanceof Error ? err.message : 'Failed to update rebalancing group');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBalance = (balance: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(balance);
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
          <DialogTitle>Edit Rebalancing Group</DialogTitle>
          <DialogDescription className="sr-only">
            Modify the group name, accounts, and assigned model.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={groupNameId}>Name</Label>
            <Input
              id={groupNameId}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Miller, John and Jane - Retirement"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>Accounts</Label>

            {/* Selected Accounts Display */}
            <SelectedAccountsDisplay
              selectedAccounts={selectedAccounts}
              accounts={accounts}
              onRemoveAccount={handleAccountToggle}
              isLoading={isLoading}
            />

            {/* Account Selection Dropdown */}
            <VirtualizedSelect
              options={accounts
                .filter((account) => !selectedAccounts.has(account.id))
                .map((account) => ({
                  value: account.id,
                  label: `${account.name}${account.accountNumber ? ` (${account.accountNumber})` : ''} • ${account.dataSource === 'SCHWAB' ? 'Schwab' : 'Manual'} - ${formatBalance(account.balance)}`,
                  disabled: account.isAssigned,
                  disabledReason: account.isAssigned
                    ? `This account is unavailable as it is already used in the '${account.assignedGroupName}' rebalancing group`
                    : undefined,
                }))}
              placeholder="Add accounts to group..."
              searchPlaceholder="Search accounts..."
              emptyMessage="No available accounts found."
              onValueChange={(accountId) => {
                if (accountId) {
                  handleAccountToggle(accountId);
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-select">Model</Label>
            <Select value={selectedModelId} onValueChange={setSelectedModelId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model for this group" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{model.name}</span>
                    </div>
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
            {isLoading ? 'Updating...' : 'Update Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
