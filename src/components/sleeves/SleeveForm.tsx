import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { VirtualizedSelect } from '../ui/virtualized-select-fixed';

interface SleeveFormProps {
  sleeveName: string;
  setSleeveName: (value: string) => void;
  targetSecurity: string;
  setTargetSecurity: (value: string) => void;
  alternateSecurities: Array<{ ticker: string; rank: number }>;
  legacySecurities: Array<{ ticker: string; rank: number }>;
  addAlternateSecurity: () => void;
  updateAlternateSecurity: (
    index: number,
    field: 'ticker' | 'rank',
    value: string | number,
  ) => void;
  removeAlternateSecurity: (index: number) => void;
  addLegacySecurity: () => void;
  updateLegacySecurity: (index: number, field: 'ticker' | 'rank', value: string | number) => void;
  removeLegacySecurity: (index: number) => void;
  error: string;
  getFilteredSecurityOptions: (
    excludeCategory?: 'target' | 'alternate' | 'legacy',
  ) => Array<{ value: string; label: string }>;
}

export function SleeveForm({
  sleeveName,
  setSleeveName,
  targetSecurity,
  setTargetSecurity,
  alternateSecurities,
  legacySecurities,
  addAlternateSecurity,
  updateAlternateSecurity,
  removeAlternateSecurity,
  addLegacySecurity,
  updateLegacySecurity,
  removeLegacySecurity,
  error,
  getFilteredSecurityOptions,
}: SleeveFormProps) {
  const sleeveNameId = useId();

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={sleeveNameId} className="block text-sm font-medium text-gray-700 mb-1">
          Sleeve Name
        </label>
        <Input
          id={sleeveNameId}
          value={sleeveName}
          onChange={(e) => setSleeveName(e.target.value)}
          placeholder="Enter sleeve name"
        />
      </div>

      {/* Target Security Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-900">Target Security</h4>
        <p className="text-xs text-gray-600 mb-2">The security you want to target for purchases.</p>
        <VirtualizedSelect
          options={getFilteredSecurityOptions('target')}
          value={targetSecurity}
          onValueChange={(value) => setTargetSecurity(value)}
          placeholder="Select target security..."
          searchPlaceholder="Search securities..."
          emptyMessage="No security found."
        />
      </div>

      {/* Alternate Securities Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-900">Alternate Securities</h4>
        <p className="text-xs text-gray-600 mb-2">
          Securities to purchase when the target security is restricted from purchase (ex. tax-loss
          harvesting).
        </p>
        <div className="space-y-2">
          {alternateSecurities.map((security, index) => (
            <div
              key={`alt-${security.ticker}-${security.rank}`}
              className="flex items-center space-x-2"
            >
              <div className="w-16">
                <Input
                  type="number"
                  value={security.rank}
                  onChange={(e) => {
                    updateAlternateSecurity(index, 'rank', Number(e.target.value));
                  }}
                  placeholder="Rank"
                  min="2"
                />
              </div>
              <div className="flex-1">
                <VirtualizedSelect
                  options={getFilteredSecurityOptions('alternate')}
                  value={security.ticker}
                  onValueChange={(value) => {
                    updateAlternateSecurity(index, 'ticker', value);
                  }}
                  placeholder="Select alternate security..."
                  searchPlaceholder="Search securities..."
                  emptyMessage="No security found."
                />
              </div>
              <Button
                type="button"
                onClick={() => removeAlternateSecurity(index)}
                variant="link"
                className="h-10 w-10 p-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button onClick={addAlternateSecurity} size="sm" variant="outline">
            <Plus className="h-3 w-3 mr-1" />
            Add Alternate Security
          </Button>
        </div>
      </div>

      {/* Legacy Securities Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-900">Legacy Securities</h4>
        <p className="text-xs text-gray-600 mb-2">
          Securities to include in the sleeve when they're restricted from sale (ex. capital gains
          restriction).
        </p>
        <div className="space-y-2">
          {legacySecurities.map((security, index) => (
            <div
              key={`legacy-${security.ticker}-${security.rank}`}
              className="flex items-center space-x-2"
            >
              <div className="w-16">
                <Input
                  type="number"
                  value={security.rank}
                  onChange={(e) => {
                    updateLegacySecurity(index, 'rank', Number(e.target.value));
                  }}
                  placeholder="Rank"
                  min="2"
                />
              </div>
              <div className="flex-1">
                <VirtualizedSelect
                  options={getFilteredSecurityOptions('legacy')}
                  value={security.ticker}
                  onValueChange={(value) => {
                    updateLegacySecurity(index, 'ticker', value);
                  }}
                  placeholder="Select legacy security..."
                  searchPlaceholder="Search securities..."
                  emptyMessage="No security found."
                />
              </div>
              <Button
                type="button"
                onClick={() => removeLegacySecurity(index)}
                variant="link"
                className="h-10 w-10 p-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button onClick={addLegacySecurity} size="sm" variant="outline">
            <Plus className="h-3 w-3 mr-1" />
            Add Legacy Security
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
