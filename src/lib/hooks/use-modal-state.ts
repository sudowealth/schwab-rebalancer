import { useState } from 'react';

export function useModalState() {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null);
  const [showSleeveModal, setShowSleeveModal] = useState(false);

  return {
    editModalOpen,
    setEditModalOpen,
    deleteModalOpen,
    setDeleteModalOpen,
    selectedTicker,
    setSelectedTicker,
    showSecurityModal,
    setShowSecurityModal,
    selectedSleeve,
    setSelectedSleeve,
    showSleeveModal,
    setShowSleeveModal,
  };
}
