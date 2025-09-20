import { FileDown, Plus, Upload } from 'lucide-react';
import { useId, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useSleeveForm } from '~/hooks/useSleeveForm';
import { createSleeveServerFn } from '~/lib/server-functions';
import { SleeveForm } from './SleeveForm';

interface AddSleeveModalProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSleeveCreated?: () => void;
}

export function AddSleeveModal({
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange,
  onSleeveCreated,
}: AddSleeveModalProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;
  const setIsOpen = isControlled ? externalOnOpenChange || (() => {}) : setInternalIsOpen;
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [csvData, setCsvData] = useState('');
  const csvDataId = useId();
  const uploadCsvId = useId();

  const {
    sleeveName,
    setSleeveName,
    targetSecurity,
    setTargetSecurity,
    alternateSecurities,
    legacySecurities,
    isLoading,
    error,
    resetForm,
    handleSubmit,
    addAlternateSecurity,
    updateAlternateSecurity,
    removeAlternateSecurity,
    addLegacySecurity,
    updateLegacySecurity,
    removeLegacySecurity,
    getFilteredSecurityOptions,
  } = useSleeveForm({
    onSubmit: async (formData) => {
      // Combine all securities into members format for submission
      const members = [
        // Add target security (rank 1, not legacy)
        ...(formData.targetSecurity.trim()
          ? [{ ticker: formData.targetSecurity.trim(), rank: 1, isLegacy: false }]
          : []),
        // Add alternate securities (not legacy)
        ...formData.alternateSecurities.map((alt) => ({
          ticker: alt.ticker.trim(),
          rank: alt.rank,
          isLegacy: false,
        })),
        // Add legacy securities (legacy)
        ...formData.legacySecurities.map((leg) => ({
          ticker: leg.ticker.trim(),
          rank: leg.rank,
          isLegacy: true,
        })),
      ].filter((m) => m.ticker.length > 0);

      await createSleeveServerFn({
        data: {
          name: formData.sleeveName.trim(),
          members: members.map((m) => ({
            ticker: m.ticker.toUpperCase(),
            rank: m.rank,
            isLegacy: m.isLegacy,
          })),
        },
      });

      setIsOpen(false);
      resetForm();
      onSleeveCreated?.();
    },
  });

  const downloadTemplate = () => {
    const csvContent =
      'sleeve,ticker,rank,type\nSample Sleeve,AAPL,1,target\nSample Sleeve,MSFT,2,alternate\nSample Sleeve,GOOGL,3,alternate\nSample Sleeve,TSLA,4,legacy\nAnother Sleeve,SPY,1,target\nAnother Sleeve,VOO,2,alternate\n';
    const blob = new globalThis.Blob([csvContent], { type: 'text/csv' });
    const url = globalThis.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sleeve_template.csv';
    a.click();
    globalThis.URL.revokeObjectURL(url);
  };

  const handleSubmitSingle = async () => {
    await handleSubmit();
  };

  const handleSubmitBulk = async () => {
    // Bulk upload functionality - keeping the existing logic for now
    // This could be enhanced later
    setCsvData('Bulk upload is temporarily disabled. Please use the Single Sleeve tab for now.');
    return;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button onClick={() => setIsOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Sleeve
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Sleeve</DialogTitle>
          <DialogDescription>
            Create a sleeve with a target security, alternative securities for tax-loss harvesting,
            and legacy securities with embedded tax losses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'bulk')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="w-full">
                Single Sleeve
              </TabsTrigger>
              <TabsTrigger value="bulk" className="w-full">
                <Upload className="h-4 w-4 mr-1" />
                Bulk Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <SleeveForm
                sleeveName={sleeveName}
                setSleeveName={setSleeveName}
                targetSecurity={targetSecurity}
                setTargetSecurity={setTargetSecurity}
                alternateSecurities={alternateSecurities}
                legacySecurities={legacySecurities}
                addAlternateSecurity={addAlternateSecurity}
                updateAlternateSecurity={updateAlternateSecurity}
                removeAlternateSecurity={removeAlternateSecurity}
                addLegacySecurity={addLegacySecurity}
                updateLegacySecurity={updateLegacySecurity}
                removeLegacySecurity={removeLegacySecurity}
                error={error}
                getFilteredSecurityOptions={getFilteredSecurityOptions}
              />
            </TabsContent>

            <TabsContent value="bulk">
              {/* Bulk upload form */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor={csvDataId} className="block text-sm font-medium text-gray-700">
                      CSV Data
                    </label>
                    <Button onClick={downloadTemplate} size="sm" variant="outline">
                      <FileDown className="h-3 w-3 mr-1" />
                      Download Template
                    </Button>
                  </div>
                  <textarea
                    id={csvDataId}
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    placeholder="Paste CSV data here or upload a file..."
                    className="w-full h-32 p-3 border border-gray-200 rounded-md text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format: sleeve,ticker,rank,type (one ticker per row)
                    <br />
                    Type can be: target, alternate, or legacy
                  </p>
                </div>

                <div>
                  <label
                    htmlFor={uploadCsvId}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Or upload CSV file
                  </label>
                  <input
                    id={uploadCsvId}
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new globalThis.FileReader();
                        reader.onload = (event) => {
                          setCsvData(event.target?.result as string);
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={mode === 'single' ? handleSubmitSingle : handleSubmitBulk}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : mode === 'single' ? 'Create Sleeve' : 'Create Sleeves'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
