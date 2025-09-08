import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { VirtualizedSelect, type Option } from "../../components/ui/virtualized-select-fixed";
import {
  updateSleeveServerFn,
  getAvailableSecuritiesServerFn,
} from "../../lib/server-functions";
import { useRouter } from "@tanstack/react-router";
import type { Sleeve } from "../../lib/schemas";

type Security = Awaited<ReturnType<typeof getAvailableSecuritiesServerFn>>[number];

interface EditSleeveModalProps {
  isOpen: boolean;
  onClose: () => void;
  sleeve: Sleeve | null;
}

export function EditSleeveModal({
  isOpen,
  onClose,
  sleeve,
}: EditSleeveModalProps) {
  const [sleeveName, setSleeveName] = useState("");
  const [members, setMembers] = useState<Array<{ ticker: string; rank: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [securities, setSecurities] = useState<Security[]>([]);
  const [securityOptions, setSecurityOptions] = useState<Option[]>([]);
  const router = useRouter();

  // Load available securities when component mounts
  useEffect(() => {
    const loadSecurities = async () => {
      try {
        const securityList = await getAvailableSecuritiesServerFn();
        setSecurities(securityList);
        // Convert to Option format for VirtualizedSelect
        const options = securityList.map((security) => ({
          value: security.ticker,
          label: `${security.ticker} - ${security.name}`,
        }));
        setSecurityOptions(options);
      } catch (err) {
        console.error("Failed to load securities:", err);
      }
    };
    loadSecurities();
  }, []);

  // Load sleeve data when sleeve prop changes
  useEffect(() => {
    if (sleeve) {
      setSleeveName(sleeve.name);
      setMembers(
        sleeve.members.map((member) => ({
          ticker: member.ticker,
          rank: member.rank,
        })),
      );
      setError("");
    }
  }, [sleeve]);

  const resetForm = () => {
    setSleeveName("");
    setMembers([]);
    setError("");
  };

  const validateMembers = (membersToValidate: Array<{ ticker: string; rank: number }>) => {
    const errors: string[] = [];

    if (membersToValidate.length === 0) {
      errors.push("At least one member is required");
    }

    const ranks = membersToValidate.map((m) => m.rank);
    const uniqueRanks = [...new Set(ranks)];
    if (ranks.length !== uniqueRanks.length) {
      errors.push("All members must have unique ranks");
    }

    const tickers = membersToValidate
      .map((m) => m.ticker.toUpperCase())
      .filter((t) => t.length > 0);
    const uniqueTickers = [...new Set(tickers)];
    if (tickers.length !== uniqueTickers.length) {
      errors.push("All members must have unique tickers");
    }

    const validTickers = new Set(securities.map((s) => s.ticker));
    const invalidTickers = tickers.filter(
      (ticker) => !validTickers.has(ticker),
    );
    if (invalidTickers.length > 0) {
      errors.push(`Invalid tickers: ${invalidTickers.join(", ")}`);
    }

    return errors;
  };

  const handleSubmit = async () => {
    if (!sleeve) {
      setError("No sleeve selected for editing");
      return;
    }

    if (!sleeveName.trim()) {
      setError("Sleeve name is required");
      return;
    }

    const validMembers = members.filter((m) => m.ticker.trim().length > 0);
    const errors = validateMembers(validMembers);

    if (errors.length > 0) {
      setError(errors.join(". "));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await updateSleeveServerFn({
        data: {
          sleeveId: sleeve.id,
          name: sleeveName.trim(),
          members: validMembers.map((m) => ({
            ticker: m.ticker.toUpperCase().trim(),
            rank: m.rank,
          })),
        },
      });

      onClose();
      resetForm();
      router.invalidate(); // Refresh the data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sleeve");
    } finally {
      setIsLoading(false);
    }
  };

  const updateMember = (
    index: number,
    field: "ticker" | "rank",
    value: string | number,
  ) => {
    const newMembers = [...members];
    if (field === "ticker") {
      newMembers[index][field] = String(value).toUpperCase();
    } else {
      newMembers[index][field] = Number(value);
    }
    setMembers(newMembers);
  };

  const addMember = () => {
    const maxRank = Math.max(...members.map((m) => m.rank), 0);
    setMembers([...members, { ticker: "", rank: maxRank + 1 }]);
  };

  const removeMember = (index: number) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!sleeve) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sleeve</DialogTitle>
          <DialogDescription>
            Update the sleeve name and member securities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sleeve Name
            </label>
            <Input
              value={sleeveName}
              onChange={(e) => setSleeveName(e.target.value)}
              placeholder="Enter sleeve name"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Members (by rank)
              </label>
              <Button onClick={addMember} size="sm" variant="outline">
                <Plus className="h-3 w-3 mr-1" />
                Add Member
              </Button>
            </div>

            <div className="space-y-2">
              {members.map((member, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-16">
                    <Input
                      type="number"
                      value={member.rank}
                      onChange={(e) =>
                        updateMember(index, "rank", e.target.value)
                      }
                      placeholder="Rank"
                      min="1"
                    />
                  </div>
                  <div className="flex-1">
                    <VirtualizedSelect
                      options={securityOptions}
                      value={member.ticker}
                      onValueChange={(value) =>
                        updateMember(index, "ticker", value)
                      }
                      placeholder="Select a ticker..."
                      searchPlaceholder="Search tickers..."
                      emptyMessage="No ticker found."
                    />
                  </div>
                  {members.length > 1 && (
                    <Button
                      onClick={() => removeMember(index)}
                      variant="outline"
                      className="h-10 w-10 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Updating..." : "Update Sleeve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
