import { useMemo } from 'react';
import type { AccountSummaryMember } from '~/types/rebalance';

/**
 * Hook for expensive rebalancing computations
 * Extracted from RebalancingGroupPage to improve performance and separation of concerns
 */
export function useRebalancingComputations(
  groupMembers:
    | Array<{
        balance: number;
        id: string;
        accountId: string;
        isActive: boolean;
        accountName?: string;
        accountType?: string;
      }>
    | undefined,
  accountHoldings:
    | Array<{
        accountId: string;
        accountName: string;
        accountNumber: string;
      }>
    | undefined,
) {
  // Total value computation - memoized
  const totalValue = useMemo(() => {
    if (!groupMembers) return 0;
    return groupMembers.reduce((sum: number, member) => sum + (member.balance || 0), 0);
  }, [groupMembers]);

  // Account lookup for quick account info access - memoized
  const accountLookup = useMemo(() => {
    if (!accountHoldings) return {};
    return accountHoldings.reduce(
      (acc: Record<string, { name: string; number: string }>, account) => {
        acc[account.accountId] = {
          name: account.accountName,
          number: account.accountNumber,
        };
        return acc;
      },
      {},
    );
  }, [accountHoldings]);

  // Account summary members with proper typing - memoized
  const accountSummaryMembers: AccountSummaryMember[] = useMemo(() => {
    if (!groupMembers) return [];
    return groupMembers.map((member) => {
      const accountInfo = accountLookup[member.accountId];
      return {
        id: member.id,
        accountId: member.accountId,
        isActive: member.isActive,
        balance: member.balance,
        accountName: member.accountName || '',
        accountNumber: accountInfo?.number || '',
        accountType: member.accountType || '',
      };
    });
  }, [groupMembers, accountLookup]);

  return {
    totalValue,
    accountLookup,
    accountSummaryMembers,
  };
}
