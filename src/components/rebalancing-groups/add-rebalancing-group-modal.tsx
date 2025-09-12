import { useRouter } from '@tanstack/react-router';
import { Plus, X } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import {
  assignModelToGroupServerFn,
  createRebalancingGroupServerFn,
  getAccountsForRebalancingGroupsServerFn,
  getModelsServerFn,
} from '../../lib/server-functions';
import { AddModelModal } from '../models/add-model-modal';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { VirtualizedSelect } from '../ui/virtualized-select-fixed';

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

interface GroupMember {
  accountId: string;
}

interface AddRebalancingGroupModalProps {
  triggerButton?: React.ReactNode;
  autoSelectSingleOptions?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onGroupCreated?: () => void;
}

export function AddRebalancingGroupModal({
  triggerButton,
  autoSelectSingleOptions = false,
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange,
  onGroupCreated,
}: AddRebalancingGroupModalProps = {}) {
  const groupNameInputId = useId();
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Use external control if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnOpenChange || setInternalIsOpen;
  const [groupName, setGroupName] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [accountsData, modelsData] = await Promise.all([
        getAccountsForRebalancingGroupsServerFn({ data: {} }),
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
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const modelsData = await getModelsServerFn();
      setModels(modelsData);
    } catch (err) {
      console.error('Failed to refresh models:', err);
    }
  }, []);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Auto-select single options when data is loaded and autoSelectSingleOptions is enabled
  useEffect(() => {
    if (autoSelectSingleOptions && accounts.length > 0 && models.length > 0) {
      // Auto-select the only account if there's only one available
      const availableAccounts = accounts.filter((account) => !account.isAssigned);
      if (availableAccounts.length === 1) {
        setSelectedAccounts(new Set([availableAccounts[0].id]));
      }

      // Auto-select the only model if there's only one available
      if (models.length === 1) {
        setSelectedModelId(models[0].id);
      }
    }
  }, [accounts, models, autoSelectSingleOptions]);

  // Refresh models when they might have been updated
  useEffect(() => {
    if (isOpen) {
      refreshModels();
    }
  }, [isOpen, refreshModels]);

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
      const members: GroupMember[] = Array.from(selectedAccounts).map((accountId) => ({
        accountId,
      }));

      const result = await createRebalancingGroupServerFn({
        data: {
          name: groupName.trim(),
          members,
        },
      });

      // Assign model (now required)
      if (selectedModelId && result.groupId) {
        await assignModelToGroupServerFn({
          data: {
            modelId: selectedModelId,
            groupId: result.groupId,
          },
        });
      }

      // Reset form
      setGroupName('');
      setSelectedAccounts(new Set());
      setSelectedModelId('');
      setIsOpen(false);

      // Call the callback if provided
      if (onGroupCreated) {
        onGroupCreated();
      }

      // Navigate to the new group's page
      if (result.groupId) {
        router.navigate({ to: `/rebalancing-groups/${result.groupId}` });
      }
    } catch (err: unknown) {
      console.error('Failed to create rebalancing group:', err);
      setError(err instanceof Error ? err.message : 'Failed to create rebalancing group');
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
    setGroupName('');
    setSelectedAccounts(new Set());
    setSelectedModelId('');
    setError('');
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Group
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Rebalancing Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={groupNameInputId}>Name</Label>
            <Input
              id={groupNameInputId}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Miller, John and Jane - Retirement"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>Accounts</Label>

            {/* Selected Accounts Display */}
            {selectedAccounts.size > 0 && (
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
                        onClick={() => handleAccountToggle(accountId)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                        disabled={isLoading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

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
            <Select
              value={selectedModelId}
              onValueChange={(value) => {
                if (value === 'create-new') {
                  setShowAddModelModal(true);
                  setSelectedModelId(''); // Clear selection
                } else {
                  setSelectedModelId(value);
                }
              }}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model for this group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create-new">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>New Model</span>
                  </div>
                </SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="font-medium">{model.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Group'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Add Model Modal */}
      <AddModelModal
        isOpen={showAddModelModal}
        onOpenChange={setShowAddModelModal}
        onModelCreated={() => {
          refreshModels();
          setShowAddModelModal(false);
        }}
      />
    </Dialog>
  );
}
