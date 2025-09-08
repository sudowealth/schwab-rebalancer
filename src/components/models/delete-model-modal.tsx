import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { deleteModelServerFn } from "../../lib/server-functions";
import { useRouter } from "@tanstack/react-router";
import type { Model } from "../../lib/schemas";

interface DeleteModelModalProps {
  model: Model | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export function DeleteModelModal({
  model,
  open,
  onOpenChange,
  onClose,
}: DeleteModelModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleDelete = async () => {
    if (!model) {
      setError("No model selected for deletion");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await deleteModelServerFn({
        data: {
          modelId: model.id,
        },
      });

      onClose();
      router.invalidate(); // Refresh the data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete model");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    onClose();
  };

  if (!model) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            Delete Model
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the model "{model.name}"?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> This action cannot be undone. The model and all its
              member allocations will be permanently deleted.
            </p>
          </div>

          {model.members.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800 mb-2">
                <strong>This model contains {model.members.length} members:</strong>
              </p>
              <ul className="text-xs text-blue-700 space-y-1">
                {model.members.slice(0, 5).map((member) => (
                  <li key={member.id} className="flex justify-between">
                    <span>{member.sleeveName || member.sleeveId}</span>
                    <span>{(member.targetWeight / 100).toFixed(1)}%</span>
                  </li>
                ))}
                {model.members.length > 5 && (
                  <li className="text-blue-600">
                    ... and {model.members.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete Model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}