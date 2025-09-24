import { useState } from 'react';
import type { SortField } from '~/features/rebalancing/components/sleeve-allocation/sleeve-allocation-table-headers';

/**
 * Simplified UI state management for rebalancing group
 * Replaces the complex 90+ line reducer with simple useState hooks
 */
export function useRebalancingGroupState(_groupId: string) {
  // UI state - simple useState instead of complex reducer
  const [allocationView, setAllocationView] = useState<
    'account' | 'sector' | 'industry' | 'sleeve'
  >('sleeve');
  const [groupingMode, setGroupingMode] = useState<'sleeve' | 'account'>('sleeve');
  const [expandedSleeves, setExpandedSleeves] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [rebalanceModalOpen, setRebalanceModalOpen] = useState(false);

  // Modal state
  const [editGroupModal, setEditGroupModal] = useState(false);
  const [deleteGroupModal, setDeleteGroupModal] = useState(false);
  const [securityModal, setSecurityModal] = useState<{ ticker: string } | null>(null);
  const [sleeveModal, setSleeveModal] = useState<{ sleeveId: string } | null>(null);

  // Trades state
  const [trades, setTrades] = useState<
    Array<{
      accountId: string;
      securityId: string;
      action: 'BUY' | 'SELL';
      qty: number;
      estPrice: number;
      estValue: number;
    }>
  >([]);

  // UI Actions
  const toggleSleeveExpansion = (sleeveId: string) => {
    setExpandedSleeves((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sleeveId)) {
        newSet.delete(sleeveId);
      } else {
        newSet.add(sleeveId);
      }
      return newSet;
    });
  };

  const toggleAccountExpansion = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      // Collapse all
      setExpandedSleeves(new Set());
      setExpandedAccounts(new Set());
      setIsAllExpanded(false);
    } else {
      // Expand all - this would need data to determine what to expand
      // For now, just set the flag
      setIsAllExpanded(true);
    }
  };

  const setSort = (field: SortField, direction: 'asc' | 'desc' | null) => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Modal actions
  const openEditModal = () => setEditGroupModal(true);
  const closeEditModal = () => setEditGroupModal(false);
  const openDeleteModal = () => setDeleteGroupModal(true);
  const closeDeleteModal = () => setDeleteGroupModal(false);
  const openSecurityModal = (ticker: string) => setSecurityModal({ ticker });
  const closeSecurityModal = () => setSecurityModal(null);
  const openSleeveModal = (sleeveId: string) => setSleeveModal({ sleeveId });
  const closeSleeveModal = () => setSleeveModal(null);

  // Trade actions
  const updateTrades = (newTrades: typeof trades) => setTrades(newTrades);
  const handleTradeQtyChange = (ticker: string, qty: number) => {
    // Update trade quantities - this would need more complex logic
    // For now, just log the change
    console.log(`Trade quantity changed for ${ticker}: ${qty}`);
  };

  // Group all UI state
  const uiState = {
    allocationView,
    groupingMode,
    expandedSleeves,
    expandedAccounts,
    selectedAccount,
    sortField,
    sortDirection,
    isAllExpanded,
    rebalanceModalOpen,
  };

  // Group all modal state
  const modalState = {
    editGroup: editGroupModal,
    deleteGroup: deleteGroupModal,
    security: securityModal,
    sleeve: sleeveModal,
  };

  // UI actions
  const uiActions = {
    setAllocationView,
    setGroupingMode,
    toggleSleeveExpansion,
    toggleAccountExpansion,
    toggleExpandAll,
    setSelectedAccount,
    setSort,
    setRebalanceModal: setRebalanceModalOpen,
    openEditModal,
    closeEditModal,
    openDeleteModal,
    closeDeleteModal,
    openSecurityModal,
    closeSecurityModal,
    openSleeveModal,
    closeSleeveModal,
  };

  // Trade actions
  const tradeActions = {
    updateTrades,
    handleTradeQtyChange,
  };

  return {
    uiState,
    modalState,
    trades,
    uiActions,
    tradeActions,
  };
}
