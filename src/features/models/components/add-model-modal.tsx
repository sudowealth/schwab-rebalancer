import { useQueryClient } from '@tanstack/react-query';
import { FileDown, Plus, Upload, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { type Option, VirtualizedSelect } from '~/components/ui/virtualized-select';
import { AddSleeveModal } from '~/features/sleeves/components/add-sleeve-modal';
import { createModelServerFn, getAvailableSleevesServerFn } from '~/lib/server-functions';
import { cn } from '~/lib/utils';

interface ModelMember {
  id: string;
  sleeveId: string;
  targetWeight: number;
}

type WeightMember = { sleeveId: string; targetWeight: number };

// Use function return types instead of manual interfaces
type Sleeve = Awaited<ReturnType<typeof getAvailableSleevesServerFn>>[number];

interface AddModelModalProps {
  buttonText?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onModelCreated?: () => void;
}

export function AddModelModal({
  buttonText = 'Add Model',
  size = 'default',
  variant = 'default',
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange,
  onModelCreated,
}: AddModelModalProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;
  const setIsOpen = isControlled ? externalOnOpenChange || (() => {}) : setInternalIsOpen;
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [modelName, setModelName] = useState('');
  const [description, setDescription] = useState('');
  const genId = () => Math.random().toString(36).slice(2);
  const [members, setMembers] = useState<ModelMember[]>([
    { id: genId(), sleeveId: '', targetWeight: 0 },
    { id: genId(), sleeveId: '', targetWeight: 0 },
    { id: genId(), sleeveId: '', targetWeight: 0 },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sleeves, setSleeves] = useState<Sleeve[]>([]);
  const [sleeveOptions, setSleeveOptions] = useState<Option[]>([]);
  const [csvData, setCsvData] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [showAddSleeveModal, setShowAddSleeveModal] = useState(false);
  const queryClient = useQueryClient();
  const modelNameId = `${useId()}-model-name`;
  const descriptionId = `${useId()}-description`;
  const updateExistingId = `${useId()}-update-existing`;

  // Load available sleeves when component mounts
  useEffect(() => {
    const loadSleeves = async () => {
      try {
        const sleeveList = await getAvailableSleevesServerFn();
        setSleeves(sleeveList);
        // Convert to Option format for VirtualizedSelect
        const options = [
          { value: 'create-new-sleeve', label: '+ New Sleeve' },
          ...sleeveList.map((sleeve) => ({
            value: sleeve.id,
            label: sleeve.name,
          })),
        ];
        setSleeveOptions(options);
      } catch (err) {
        console.error('Failed to load sleeves:', err);
      }
    };
    loadSleeves();
  }, []);

  const refreshSleeves = async () => {
    try {
      const sleeveList = await getAvailableSleevesServerFn();
      setSleeves(sleeveList);
      const options = [
        { value: 'create-new-sleeve', label: '+ New Sleeve' },
        ...sleeveList.map((sleeve) => ({
          value: sleeve.id,
          label: sleeve.name,
        })),
      ];
      setSleeveOptions(options);
    } catch (err) {
      console.error('Failed to refresh sleeves:', err);
    }
  };

  const resetForm = () => {
    setModelName('');
    setDescription('');
    setMembers([
      { id: genId(), sleeveId: '', targetWeight: 0 },
      { id: genId(), sleeveId: '', targetWeight: 0 },
      { id: genId(), sleeveId: '', targetWeight: 0 },
    ]);
    setCsvData('');
    setError('');
    setMode('single');
    setUpdateExisting(false);
  };

  const validateMembers = (membersToValidate: WeightMember[]) => {
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

  const handleSingleSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      if (!modelName.trim()) {
        throw new Error('Model name is required');
      }

      const membersWithSleeves = members.filter((member) => member.sleeveId.length > 0);

      if (membersWithSleeves.length === 0) {
        throw new Error('At least one sleeve must be selected');
      }

      // Validate members with sleeves (for new models, empty members are expected)
      const validationErrors = validateMembers(membersWithSleeves);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      await createModelServerFn({
        data: {
          name: modelName.trim(),
          description: description.trim() || undefined,
          members: membersWithSleeves,
        },
      });

      resetForm();
      setIsOpen(false);
      onModelCreated?.();

      // Invalidate models query to refresh the UI immediately
      queryClient.invalidateQueries({ queryKey: ['models'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const parseCsvData = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    const models: Array<{
      name: string;
      description?: string;
      members: WeightMember[];
    }> = [];

    const errors: string[] = [];
    const notFoundSleeves = new Set<string>();
    const invalidRows: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Skip header
      const line = lines[i].trim();
      if (!line) continue;

      // Try different delimiters: comma, tab, or multiple spaces
      let parts = line.split(',').map((part) => part.trim());
      if (parts.length < 3) {
        parts = line.split('\t').map((part) => part.trim());
      }
      if (parts.length < 3) {
        parts = line.split(/\s{2,}/).map((part) => part.trim());
      }
      if (parts.length < 3) {
        // Try single space as last resort
        parts = line
          .split(' ')
          .map((part) => part.trim())
          .filter((part) => part.length > 0);
      }

      if (parts.length < 3) {
        invalidRows.push(`Row ${i + 1}: Expected 3 columns, got ${parts.length}. Data: "${line}"`);
        continue;
      }

      const [modelName, sleeveName, weightStr] = parts;
      const weight = Number.parseFloat(weightStr);

      if (!modelName || !sleeveName || Number.isNaN(weight)) {
        invalidRows.push(
          `Row ${i + 1}: Missing or invalid data (model: "${modelName}", sleeve: "${sleeveName}", weight: "${weightStr}")`,
        );
        continue;
      }

      // Find sleeve ID by name
      const sleeve = sleeves.find((s) => s.name === sleeveName);
      if (!sleeve) {
        notFoundSleeves.add(sleeveName);
        continue;
      }

      // Find or create model
      let model = models.find((m) => m.name === modelName);
      if (!model) {
        model = {
          name: modelName,
          description: undefined,
          members: [],
        };
        models.push(model);
      }

      model.members.push({
        sleeveId: sleeve.id,
        targetWeight: Math.round(weight * 100), // Convert to basis points
      });
    }

    // Collect all errors
    if (notFoundSleeves.size > 0) {
      const slevesList = Array.from(notFoundSleeves)
        .map((sleeve) => `• ${sleeve}`)
        .join('\n');
      errors.push(`Sleeves not found:\n${slevesList}`);
    }
    if (invalidRows.length > 0) {
      errors.push(...invalidRows);
    }

    // If we have errors, throw them
    if (errors.length > 0) {
      throw new Error(errors.join('. '));
    }

    return models;
  };

  const handleBulkSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      if (!csvData.trim()) {
        throw new Error('CSV data is required');
      }

      const models = parseCsvData(csvData);
      if (models.length === 0) {
        throw new Error('No valid models were created. Please check your CSV format and data.');
      }

      // Validate each model
      for (const model of models) {
        const validationErrors = validateMembers(model.members);
        if (validationErrors.length > 0) {
          throw new Error(`Model "${model.name}": ${validationErrors.join(', ')}`);
        }
      }

      // Create all models
      for (const model of models) {
        await createModelServerFn({
          data: { ...model, updateExisting },
        });
      }

      resetForm();
      setIsOpen(false);
      onModelCreated?.();

      // Invalidate models query to refresh the UI immediately
      queryClient.invalidateQueries({ queryKey: ['models'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = [
      'model,sleeve,weight',
      'S&P 500 Tech,Semiconductors - 1,25.5',
      'S&P 500 Tech,Software - Application - 1,30.0',
      'S&P 500 Tech,Technology Hardware - 1,44.5',
      'Balanced Fund,Banks - Diversified - 1,20.0',
      'Balanced Fund,Healthcare Plans - 1,25.0',
      'Balanced Fund,Semiconductors - 1,25.0',
      'Balanced Fund,Consumer Finance - 1,30.0',
    ].join('\n');

    const blob = new globalThis.Blob([csvContent], { type: 'text/csv' });
    const url = globalThis.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model-template.csv';
    a.click();
    globalThis.URL.revokeObjectURL(url);
  };

  const currentTotal = members.reduce((sum, m) => sum + m.targetWeight, 0);
  const isValidTotal = currentTotal === 10000; // Require exactly 100.00%
  const totalPercentage = (currentTotal / 100).toFixed(2);

  // Check for duplicate sleeves
  const selectedSleeves = members.filter((m) => m.sleeveId).map((m) => m.sleeveId);
  const duplicateSleeves = [
    ...new Set(
      selectedSleeves.filter((sleeve, index) => selectedSleeves.indexOf(sleeve) !== index),
    ),
  ];
  const hasDuplicates = duplicateSleeves.length > 0;
  const duplicateNames = duplicateSleeves.map(
    (sleeveId) => sleeveOptions.find((opt) => opt.value === sleeveId)?.label || sleeveId,
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size={size} variant={variant}>
            <Plus className="mr-2 h-4 w-4" />
            {buttonText}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Model</DialogTitle>
          <DialogDescription>
            Create a new portfolio model with sleeve allocations.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <div className="flex space-x-2">
            <Button
              variant={mode === 'single' ? 'default' : 'outline'}
              onClick={() => setMode('single')}
              className="flex-1"
            >
              Single Model
            </Button>
            <Button
              variant={mode === 'bulk' ? 'default' : 'outline'}
              onClick={() => setMode('bulk')}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Bulk Upload
            </Button>
          </div>
        </div>

        {mode === 'single' ? (
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
                  <div key={member.id} className="flex items-center space-x-2">
                    <div className="flex-1">
                      <VirtualizedSelect
                        options={sleeveOptions}
                        value={member.sleeveId}
                        onValueChange={(value) => {
                          if (value === 'create-new-sleeve') {
                            setShowAddSleeveModal(true);
                          } else {
                            updateMember(index, 'sleeveId', value);
                          }
                        }}
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

              {!isValidTotal && members.some((m) => m.sleeveId) && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-md">
                  Weights must sum to exactly 100%. Current total: {totalPercentage}%
                </div>
              )}

              {hasDuplicates && (
                <div className="mt-2 text-sm text-orange-600 bg-orange-50 p-2 rounded-md">
                  <div>
                    The following sleeves appear multiple times: {duplicateNames.join(', ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="block text-sm font-medium">CSV Data *</div>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                <FileDown className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>
            <textarea
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder="model, sleeve, weight
S&P 500 Tech, Semiconductors - 1, 25.5"
              className="w-full h-40 p-3 border rounded-md"
            />
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
              <input
                id={updateExistingId}
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor={updateExistingId} className="text-sm font-medium cursor-pointer">
                Update existing models
              </label>
              <span className="text-xs text-gray-500">
                (When enabled, existing models with the same name will be updated)
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md whitespace-pre-line">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={mode === 'single' ? handleSingleSubmit : handleBulkSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : mode === 'single' ? 'Create Model' : 'Create Models'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Add Sleeve Modal */}
      <AddSleeveModal
        isOpen={showAddSleeveModal}
        onOpenChange={setShowAddSleeveModal}
        onSleeveCreated={() => {
          refreshSleeves();
          setShowAddSleeveModal(false);
        }}
      />
    </Dialog>
  );
}
