import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { formatCurrency } from "../../lib/utils";
import { updateManualCashServerFn, getManualCashServerFn } from "../../lib/server-functions";
import { useState, useEffect } from "react";
import { Edit, Check, X } from "lucide-react";
import { EditAccountModal } from "./edit-account-modal";

interface AccountSummaryProps {
  members: Array<{
    id: string;
    accountId: string;
    accountName: string;
    accountType: string;
    accountNumber?: string;
    balance: number;
  }>;
  selectedAccount: string | null;
  totalValue: number;
  onAccountSelect: (accountId: string) => void;
  onManualCashUpdate?: () => void;
  onAccountUpdate?: () => void;
}

const formatAccountType = (type: string): string => {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function AccountSummary({
  members,
  selectedAccount,
  totalValue: _totalValue,
  onAccountSelect,
  onManualCashUpdate,
  onAccountUpdate,
}: AccountSummaryProps) {
  const [manualCashAmounts, setManualCashAmounts] = useState<Record<string, number>>({});
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [tempAmount, setTempAmount] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<{
    id: string;
    accountId: string;
    accountName: string;
    accountType: string;
    accountNumber?: string;
  } | null>(null);

  // Load manual cash amounts for all accounts
  useEffect(() => {
    const loadManualCash = async () => {
      const amounts: Record<string, number> = {};
      for (const member of members) {
        try {
          const result = await getManualCashServerFn({ data: { accountId: member.accountId } });
          amounts[member.accountId] = result.amount;
        } catch (error) {
          console.error("Error loading manual cash:", error);
          amounts[member.accountId] = 0;
        }
      }
      setManualCashAmounts(amounts);
    };

    loadManualCash();
  }, [members]);

  const handleEditManualCash = (accountId: string) => {
    setEditingAccount(accountId);
    setTempAmount((manualCashAmounts[accountId] || 0).toString());
  };

  const handleSaveManualCash = async (accountId: string) => {
    setIsUpdating(true);
    try {
      const amount = parseFloat(tempAmount) || 0;
      await updateManualCashServerFn({ data: { accountId, amount } });
      setManualCashAmounts(prev => ({ ...prev, [accountId]: amount }));
      setEditingAccount(null);
      onManualCashUpdate?.();
    } catch (error) {
      console.error("Error updating manual cash:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingAccount(null);
    setTempAmount("");
  };

  const handleEditAccount = (accountId: string) => {
    const account = members.find(m => m.accountId === accountId);
    if (account) {
      setAccountToEdit(account);
      setEditModalOpen(true);
    }
  };

  const handleAccountUpdated = () => {
    onAccountUpdate?.();
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setAccountToEdit(null);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Summary</CardTitle>
        <CardDescription>
          Click on an account to see detailed holdings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card
              key={member.id}
              className={`cursor-pointer transition-colors ${
                selectedAccount === member.accountId
                  ? "border-primary"
                  : "hover:border-muted-foreground"
              }`}
              onClick={() => onAccountSelect(member.accountId)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">
                      {member.accountName}
                      {member.accountNumber && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({member.accountNumber})
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {formatAccountType(member.accountType)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditAccount(member.accountId);
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {formatCurrency(member.balance || 0)}
                </div>
                <div className="mt-2 pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Manual Cash:</span>
                    {editingAccount === member.accountId ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={tempAmount}
                          onChange={(e) => setTempAmount(e.target.value)}
                          className="w-20 h-6 text-xs"
                          step="0.01"
                          min="0"
                        />
                        <Button 
                          size="sm" 
                          onClick={() => handleSaveManualCash(member.accountId)}
                          disabled={isUpdating}
                          className="h-6 px-2 text-xs"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                          className="h-6 px-2 text-xs"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {formatCurrency(manualCashAmounts[member.accountId] || 0)}
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleEditManualCash(member.accountId)}
                          className="h-6 px-1 text-xs hover:bg-muted"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
      
      <EditAccountModal
        account={accountToEdit}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onClose={handleCloseEditModal}
        onAccountUpdated={handleAccountUpdated}
      />
    </Card>
  );
}
