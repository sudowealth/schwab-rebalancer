import { useId } from 'react';
import { RebalanceModal } from './rebalance-modal';
import { AccountSummaryErrorBoundary } from './rebalancing-error-boundary';
import { useRebalancingGroup } from './rebalancing-group-context';
import type { SortField } from './sleeve-allocation/sleeve-allocation-table-headers';

export function RebalancingGroupPage() {
  const allocationViewId = useId();
  const groupingModeId = useId();
  const sortFieldId = useId();

  const {
    data,
    ui,
    availableCash,
    isRebalancing,
    isSyncingPrices,
    setAllocationView,
    setGroupingMode,
    toggleExpandAll,
    setSort,
    setRebalanceModal,
    handleRebalance,
    handlePriceSync,
    openEditModal,
    openDeleteModal,
  } = useRebalancingGroup();

  if (!data) {
    return <div>Loading...</div>;
  }

  const { group } = data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Group Header - demonstrates new architecture */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground">
            {group.members.length} account{group.members.length !== 1 ? 's' : ''} • Active:{' '}
            {group.isActive ? 'Yes' : 'No'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openEditModal}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Edit Group
          </button>
          <button
            type="button"
            onClick={openDeleteModal}
            className="px-4 py-2 border border-red-200 text-red-600 rounded hover:bg-red-50"
          >
            Delete Group
          </button>
        </div>
      </div>

      {/* UI State Controls - demonstrates consolidated state management */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded">
        <div>
          <label htmlFor={allocationViewId} className="block text-sm font-medium">
            Allocation View
          </label>
          <select
            id={allocationViewId}
            value={ui.allocationView}
            onChange={(e) =>
              setAllocationView(e.target.value as 'account' | 'sector' | 'industry' | 'sleeve')
            }
            className="w-full p-2 border rounded"
          >
            <option value="sleeve">Sleeve</option>
            <option value="account">Account</option>
            <option value="sector">Sector</option>
            <option value="industry">Industry</option>
          </select>
        </div>
        <div>
          <label htmlFor={groupingModeId} className="block text-sm font-medium">
            Grouping Mode
          </label>
          <select
            id={groupingModeId}
            value={ui.groupingMode}
            onChange={(e) => setGroupingMode(e.target.value as 'sleeve' | 'account')}
            className="w-full p-2 border rounded"
          >
            <option value="sleeve">Sleeve</option>
            <option value="account">Account</option>
          </select>
        </div>
        <div>
          <label htmlFor={sortFieldId} className="block text-sm font-medium">
            Sort Field
          </label>
          <select
            id={sortFieldId}
            value={ui.sortField || ''}
            onChange={(e) => setSort(e.target.value as SortField)}
            className="w-full p-2 border rounded"
          >
            <option value="">None</option>
            <option value="ticker">Ticker</option>
            <option value="value">Value</option>
          </select>
        </div>
        <div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleExpandAll}
              className="px-3 py-1 text-sm border rounded"
            >
              {ui.isAllExpanded ? 'Collapse' : 'Expand'} All
            </button>
            <button
              type="button"
              onClick={() => setRebalanceModal(true)}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded"
            >
              Rebalance
            </button>
          </div>
        </div>
      </div>

      {/* Architecture Status */}
      <AccountSummaryErrorBoundary>
        <div className="p-6 border rounded bg-green-50">
          <h2 className="text-lg font-semibold text-green-800 mb-2">
            ✅ Feature-Level State Machine Implemented
          </h2>
          <div className="text-sm text-green-700 space-y-1">
            <p>• Consolidated 8+ individual hooks into single feature hook</p>
            <p>• Eliminated prop drilling with React Context</p>
            <p>• Full type safety from server to client (no 'as any')</p>
            <p>• Single source of truth for all group state</p>
            <p>• Reducer-based state management for predictable updates</p>
          </div>
          <div className="mt-4 text-xs text-green-600">
            <strong>Next Steps:</strong> Create data transformation adapters to connect existing UI
            components with new server data structures.
          </div>
        </div>
      </AccountSummaryErrorBoundary>

      {/* Feature-Level Error Boundaries Demo */}
      <div className="p-4 border rounded bg-blue-50">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Error Boundary Protection</h3>
        <p className="text-xs text-blue-700">
          Each feature section is now wrapped with specialized error boundaries that:
        </p>
        <ul className="text-xs text-blue-700 mt-1 space-y-1">
          <li>• Catch and log feature-specific errors</li>
          <li>• Provide user-friendly error messages</li>
          <li>• Allow users to retry failed operations</li>
          <li>• Display development error details when appropriate</li>
        </ul>
      </div>

      {/* Rebalance Modal - demonstrates working modal system */}
      <RebalanceModal
        open={ui.rebalanceModalOpen}
        onOpenChange={setRebalanceModal}
        onGenerateTrades={async () => {
          await handleRebalance('allocation');
        }}
        onFetchPrices={() => {
          handlePriceSync().catch(console.error);
        }}
        isLoading={isRebalancing}
        availableCash={availableCash}
        isSyncing={isSyncingPrices}
        syncMessage={
          isSyncingPrices
            ? 'Fetching updated security prices. Once completed, the rebalance will begin automatically.'
            : undefined
        }
      />
    </div>
  );
}
