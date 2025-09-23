import React from 'react';
import { AccountSummary } from './account-summary';

interface GroupAccountSummarySectionProps {
  members: Array<{
    id: string;
    accountId: string;
    balance: number;
    accountName?: string;
    accountNumber?: string;
    accountType?: string;
  }>;
  selectedAccount: string | null;
  totalValue: number;
  onAccountSelect: (accountId: string | null) => void;
  onManualCashUpdate: () => void;
  onAccountUpdate: () => void;
}

export const GroupAccountSummarySection = React.memo(function GroupAccountSummarySection({
  members,
  selectedAccount,
  totalValue,
  onAccountSelect,
  onManualCashUpdate,
  onAccountUpdate,
}: GroupAccountSummarySectionProps) {
  // Add default accountType for members that don't have it
  const membersWithAccountType = members.map((member) => ({
    id: member.id,
    accountId: member.accountId,
    balance: member.balance,
    accountName: member.accountName || 'Unknown Account',
    accountNumber: member.accountNumber,
    accountType: member.accountType || 'INVESTMENT',
  }));

  return (
    <AccountSummary
      members={membersWithAccountType}
      selectedAccount={selectedAccount}
      totalValue={totalValue}
      onAccountSelect={onAccountSelect}
      onManualCashUpdate={onManualCashUpdate}
      onAccountUpdate={onAccountUpdate}
    />
  );
});

GroupAccountSummarySection.displayName = 'GroupAccountSummarySection';
