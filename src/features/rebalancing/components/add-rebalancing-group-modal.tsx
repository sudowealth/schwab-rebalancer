import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { AddModelModal } from '~/features/models/components/add-model-modal';
import { queryInvalidators } from '~/lib/query-keys';
import {
  assignModelToGroupServerFn,
  createRebalancingGroupServerFn,
  getAccountsForRebalancingGroupsServerFn,
  getModelsServerFn,
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
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const loadData = useCallback(async () => {
    try {
      console.log('🔄 [RebalancingModal] Loading data...');

      const [accountsData, modelsData] = await Promise.all([
        getAccountsForRebalancingGroupsServerFn({ data: {} }),
        getModelsServerFn(),
      ]);

      console.log('📊 [RebalancingModal] Loaded data:', {
        accountsCount: accountsData.length,
        modelsCount: modelsData.length,
        accounts: accountsData.map((a) => ({ id: a.id, name: a.name, dataSource: a.dataSource })),
        models: modelsData.map((m) => ({ id: m.id, name: m.name })),
      });

      setAccounts(
        accountsData.map((account) => ({
          ...account,
          type: account.type || '',
        })),
      );
      setModels(modelsData);

      // Check if user has no accounts (likely hasn't connected Schwab)
      if (accountsData.length === 0) {
        setError(
          'No accounts found. Please connect your Schwab account first by going to the homepage and clicking "Connect to Schwab".',
        );
      } else if (modelsData.length === 0) {
        setError(
          'No investment models found. Please create a model first by going to the Models page.',
        );
      }
    } catch (err) {
      console.error('Failed to load data:', err);

      // Check if this is likely because the user hasn't connected Schwab
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (
        errorMessage.includes('Failed query') ||
        errorMessage.includes('rebalancing_group_member')
      ) {
        setError(
          'No accounts found. Please connect your Schwab account first by going to the homepage and clicking "Connect to Schwab".',
        );
      } else {
        setError('Failed to load data');
      }
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
      // Clear cache to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ['accounts-for-rebalancing'],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ['models'],
        exact: false,
      });
      loadData();
    }
  }, [isOpen, loadData, queryClient, externalIsOpen, internalIsOpen]);

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
    if (accounts.length === 0) {
      setError('No accounts available. Please connect your Schwab account first.');
      return;
    }

    if (models.length === 0) {
      setError('No investment models available. Please create a model first.');
      return;
    }

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

    // Additional validation: ensure selectedModelId is a valid UUID
    if (!selectedModelId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      setError(`Invalid model selected: ${selectedModelId}`);
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
        // Validate that selectedModelId is a valid UUID before sending
        if (
          !selectedModelId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        ) {
          throw new Error(`Invalid model ID format: ${selectedModelId}`);
        }

        await assignModelToGroupServerFn({
          data: {
            modelId: selectedModelId,
            groupId: result.groupId,
          },
        });
        // ✅ USE GRANULAR INVALIDATION - only invalidate what model assignment affects
        queryInvalidators.composites.afterModelAssignment(queryClient, result.groupId);
      }

      // ✅ USE GRANULAR INVALIDATION - only invalidate what group creation affects
      queryInvalidators.composites.afterRebalancingGroupCreate(queryClient);
      // Also invalidate route loader data
      router.invalidate();

      // Call the callback if provided
      if (onGroupCreated) {
        onGroupCreated();
      }

      // Set navigating state and navigate to the newly created group
      setIsNavigating(true);
      if (result.groupId) {
        console.log('🎯 Navigating to newly created group:', result.groupId);
        console.log('🚀 Navigation target:', `/rebalancing-groups/${result.groupId}`);
        router.navigate({ to: `/rebalancing-groups/${result.groupId}` });
      } else {
        console.error('❌ No groupId returned from creation');
      }
    } catch (err: unknown) {
      console.error('Failed to create rebalancing group:', err);
      setError(err instanceof Error ? err.message : 'Failed to create rebalancing group');
      setIsLoading(false);
      setIsNavigating(false);
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
    setIsNavigating(false);
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
          <DialogDescription className="sr-only">
            Create a new rebalancing group by selecting accounts and assigning a model.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={groupNameInputId}>Name</Label>
            <Input
              id={groupNameInputId}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Miller, John and Jane - Retirement"
              disabled={isLoading || isNavigating || accounts.length === 0}
            />
          </div>
          {models.length === 0 && accounts.length > 0 && (
            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
              No investment models available. Please create a model first by going to the Models
              page.
            </div>
          )}
          <div className="space-y-2">
            <Label>Accounts</Label>

            {/* Selected Accounts Display */}
            <SelectedAccountsDisplay
              selectedAccounts={selectedAccounts}
              accounts={accounts}
              onRemoveAccount={handleAccountToggle}
              isLoading={isLoading || isNavigating}
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
              emptyMessage={
                accounts.length === 0
                  ? 'No accounts available. Please connect your Schwab account first by going to the homepage.'
                  : 'No available accounts found.'
              }
              onValueChange={(accountId) => {
                if (accountId && accounts.length > 0) {
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
              disabled={isLoading || isNavigating || accounts.length === 0}
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
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error.includes('homepage') ? (
                <>
                  No accounts found. Please connect your Schwab account first by going to the{' '}
                  <a
                    href="/"
                    className="underline hover:text-red-800"
                    onClick={(e) => {
                      e.preventDefault();
                      router.navigate({ to: '/', search: { schwabConnected: undefined } });
                    }}
                  >
                    homepage
                  </a>{' '}
                  and clicking "Connect to Schwab".
                </>
              ) : (
                error
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading || isNavigating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || isNavigating || accounts.length === 0 || models.length === 0}
          >
            {isNavigating ? 'Redirecting...' : isLoading ? 'Creating...' : 'Create Group'}
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
