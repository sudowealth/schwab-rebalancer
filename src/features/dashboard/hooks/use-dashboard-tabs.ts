import { useState } from 'react';

export type DashboardTab = 'positions' | 'transactions' | 'rebalancing-groups';

export function useDashboardTabs() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('rebalancing-groups');

  return {
    activeTab,
    setActiveTab,
  };
}
