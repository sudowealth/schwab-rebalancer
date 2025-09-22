import { useState } from 'react';

export function useModalState() {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null);
  const [showSleeveModal, setShowSleeveModal] = useState(false);

  const openSecurityModal = (ticker: string) => {
    setSelectedTicker(ticker);
    setShowSecurityModal(true);
  };

  const closeSecurityModal = () => {
    setShowSecurityModal(false);
    setSelectedTicker(null);
  };

  const openSleeveModal = (sleeveId: string) => {
    setSelectedSleeve(sleeveId);
    setShowSleeveModal(true);
  };

  const closeSleeveModal = () => {
    setShowSleeveModal(false);
    setSelectedSleeve(null);
  };

  const openEditModal = () => setEditModalOpen(true);
  const closeEditModal = () => setEditModalOpen(false);

  const openDeleteModal = () => setDeleteModalOpen(true);
  const closeDeleteModal = () => setDeleteModalOpen(false);

  return {
    selectedAccount,
    setSelectedAccount,
    editModalOpen,
    setEditModalOpen,
    deleteModalOpen,
    setDeleteModalOpen,
    selectedTicker,
    showSecurityModal,
    selectedSleeve,
    showSleeveModal,
    openSecurityModal,
    closeSecurityModal,
    openSleeveModal,
    closeSleeveModal,
    openEditModal,
    closeEditModal,
    openDeleteModal,
    closeDeleteModal,
  };
}
