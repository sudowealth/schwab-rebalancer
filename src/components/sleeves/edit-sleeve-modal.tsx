import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useSleeveForm } from '~/hooks/useSleeveForm';
import type { Sleeve } from '~/lib/schemas';
import { updateSleeveServerFn } from '~/lib/server-functions';
import { SleeveForm } from './SleeveForm';

interface EditSleeveModalProps {
  isOpen: boolean;
  onClose: () => void;
  sleeve: Sleeve | null;
}

export function EditSleeveModal({ isOpen, onClose, sleeve }: EditSleeveModalProps) {
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
    initialData: sleeve,
    onSubmit: async (formData) => {
      if (!sleeve) {
        throw new Error('No sleeve selected for editing');
      }

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

      await updateSleeveServerFn({
        data: {
          sleeveId: sleeve.id,
          name: formData.sleeveName.trim(),
          members: members.map((m) => ({
            ticker: m.ticker.toUpperCase(),
            rank: m.rank,
            isLegacy: m.isLegacy,
          })),
        },
      });

      onClose();
      resetForm();
    },
  });

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
          <DialogDescription>Update the sleeve name and member securities.</DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Sleeve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
