import { useState } from 'react';

export function useDashboardModals() {
  // Sleeve modal state
  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null);
  const [showSleeveModal, setShowSleeveModal] = useState(false);

  // Security modal state
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  const handleTickerClick = (ticker: string) => {
    setSelectedTicker(ticker);
    setShowSecurityModal(true);
  };

  const handleSleeveClick = (sleeveId: string) => {
    setSelectedSleeve(sleeveId);
    setShowSleeveModal(true);
  };

  const closeSleeveModal = () => {
    setShowSleeveModal(false);
    setSelectedSleeve(null);
  };

  const closeSecurityModal = () => {
    setShowSecurityModal(false);
    setSelectedTicker(null);
  };

  return {
    // Sleeve modal state and handlers
    selectedSleeve,
    showSleeveModal,
    handleSleeveClick,
    closeSleeveModal,

    // Security modal state and handlers
    selectedTicker,
    showSecurityModal,
    handleTickerClick,
    closeSecurityModal,
  };
}
