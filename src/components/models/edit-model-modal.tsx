import { useRouter } from '@tanstack/react-router';
import { Plus, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { type Option, VirtualizedSelect } from '../../components/ui/virtualized-select-fixed';
import type { Model } from '../../lib/schemas';
import { getAvailableSleevesServerFn, updateModelServerFn } from '../../lib/server-functions';
import { cn } from '../../lib/utils';

// Use function return types instead of manual interfaces
type Sleeve = Awaited<ReturnType<typeof getAvailableSleevesServerFn>>[number];

interface ModelMember {
  id: string;
  sleeveId: string;
  targetWeight: number;
}

interface EditModelModalProps {
  model: Model | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export function EditModelModal({ model, open, onOpenChange, onClose }: EditModelModalProps) {
  const [modelName, setModelName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<ModelMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setSleeves] = useState<Sleeve[]>([]);
  const [sleeveOptions, setSleeveOptions] = useState<Option[]>([]);
  const router = useRouter();

  // Load available sleeves when component mounts
  useEffect(() => {
    const loadSleeves = async () => {
      try {
        const sleeveList = await getAvailableSleevesServerFn();
        setSleeves(sleeveList);
        // Convert to Option format for VirtualizedSelect
        const options = sleeveList.map((sleeve) => ({
          value: sleeve.id,
          label: sleeve.name,
        }));
        setSleeveOptions(options);
      } catch (err) {
        console.error('Failed to load sleeves:', err);
      }
    };
    loadSleeves();
  }, []);

  // Load model data when model prop changes
  useEffect(() => {
    if (model) {
      setModelName(model.name);
      setDescription(model.description || '');
      setMembers(
        model.members.map((member) => ({
          id: member.id,
          sleeveId: member.sleeveId,
          targetWeight: member.targetWeight,
        })),
      );
      setError('');
    }
  }, [model]);

  const resetForm = () => {
    setModelName('');
    setDescription('');
    setMembers([]);
    setError('');
  };

  const validateMembers = (membersToValidate: ModelMember[]) => {
    const errors: string[] = [];

    if (membersToValidate.length === 0) {
      errors.push('At least one member is required');
    }

    const sleeveIds = membersToValidate.map((m) => m.sleeveId).filter((id) => id.length > 0);
    const uniqueSleeveIds = [...new Set(sleeveIds)];
    if (sleeveIds.length !== uniqueSleeveIds.length) {
      errors.push('All members must have unique sleeves');
    }

    const totalWeight = membersToValidate.reduce((sum, member) => sum + member.targetWeight, 0);
    if (Math.abs(totalWeight - 10000) > 1) {
      // Allow for tiny floating-point rounding errors
      errors.push(`Target weights must sum to 100%, currently ${(totalWeight / 100).toFixed(2)}%`);
    }

    membersToValidate.forEach((member, index) => {
      if (member.targetWeight < 0 || member.targetWeight > 10000) {
        errors.push(`Member ${index + 1}: Weight must be between 0% and 100%`);
      }
    });

    return errors;
  };

  const genId = () => Math.random().toString(36).slice(2);

  const addMember = () => {
    const nextWeight = Math.max(0, 10000 - members.reduce((sum, m) => sum + m.targetWeight, 0));
    setMembers([...members, { id: genId(), sleeveId: '', targetWeight: nextWeight }]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof ModelMember, value: string | number) => {
    const updatedMembers = [...members];
    if (field === 'targetWeight') {
      // Convert percentage to basis points
      const percentage = Number.parseFloat(value as string);
      updatedMembers[index][field] = Number.isNaN(percentage) ? 0 : Math.round(percentage * 100);
    } else {
      updatedMembers[index][field] = value as string;
    }
    setMembers(updatedMembers);
  };

  const distributeEqually = () => {
    const validMembers = members.filter((m) => m.sleeveId.length > 0);
    if (validMembers.length === 0) return;

    const weightPerMember = Math.floor(10000 / validMembers.length);
    const remainder = 10000 % validMembers.length;

    const updatedMembers = members.map((member, _index) => {
      if (member.sleeveId.length === 0) {
        return { ...member, targetWeight: 0 };
      }
      const validIndex = validMembers.findIndex((vm) => vm.sleeveId === member.sleeveId);
      return {
        ...member,
        targetWeight: weightPerMember + (validIndex < remainder ? 1 : 0),
      };
    });

    setMembers(updatedMembers);
  };

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      if (!model) {
        throw new Error('No model selected');
      }

      if (!modelName.trim()) {
        throw new Error('Model name is required');
      }

      const membersWithSleeves = members.filter((member) => member.sleeveId.length > 0);

      if (membersWithSleeves.length === 0) {
        throw new Error('At least one sleeve must be selected');
      }

      // Validate ALL members (including those without sleeves selected)
      // This ensures the total weight validation is consistent with the UI display
      const validationErrors = validateMembers(members);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      await updateModelServerFn({
        data: {
          modelId: model.id,
          name: modelName.trim(),
          description: description.trim() || undefined,
          members: membersWithSleeves,
        },
      });

      resetForm();
      onClose();
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const currentTotal = members.reduce((sum, m) => sum + m.targetWeight, 0);
  const isValidTotal = currentTotal === 10000; // Require exactly 100.00%
  const totalPercentage = (currentTotal / 100).toFixed(2);

  // Check for duplicate sleeves
  // const selectedSleeves = members
  //   .filter((m) => m.sleeveId)
  //   .map((m) => m.sleeveId);
  // const duplicateSleeves = [
  //   ...new Set(
  //     selectedSleeves.filter(
  //       (sleeve, index) => selectedSleeves.indexOf(sleeve) !== index
  //     )
  //   ),
  // ];
  // const hasDuplicates = duplicateSleeves.length > 0;
  // const duplicateNames = duplicateSleeves.map(
  //   (sleeveId) =>
  //     sleeveOptions.find((opt) => opt.value === sleeveId)?.label || sleeveId
  // );

  const modelNameId = `${useId()}-model-name`;
  const descriptionId = `${useId()}-description`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Model</DialogTitle>
          <DialogDescription>
            Update the model name, description, and sleeve allocations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor={modelNameId} className="block text-sm font-medium mb-2">
              Model Name *
            </label>
            <Input
              id={modelNameId}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Enter model name"
            />
          </div>

          <div>
            <label htmlFor={descriptionId} className="block text-sm font-medium mb-2">
              Description
            </label>
            <Input
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description (optional)"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="block text-sm font-medium">Model Members *</div>
              <div className="flex space-x-2">
                <Button type="button" variant="outline" size="sm" onClick={distributeEqually}>
                  Distribute Equally
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addMember}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {members.map((member, index) => (
                <div key={member.id || `member-${index}`} className="flex items-center space-x-2">
                  <div className="flex-1">
                    <VirtualizedSelect
                      options={sleeveOptions}
                      value={member.sleeveId}
                      onValueChange={(value) => updateMember(index, 'sleeveId', value)}
                      placeholder="Select sleeve"
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={member.targetWeight / 100}
                      onChange={(e) => updateMember(index, 'targetWeight', e.target.value)}
                      placeholder="Weight %"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMember(index)}
                    disabled={members.length <= 1}
                    className="h-10 w-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center space-x-2">
              <div className="flex-1" />
              <div
                className={cn(
                  'text-base font-medium w-24',
                  isValidTotal ? 'text-green-600' : 'text-red-600',
                )}
              >
                {totalPercentage}%
              </div>
              <div className="w-8" />
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Model'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
