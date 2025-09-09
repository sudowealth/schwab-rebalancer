import { useRouter } from '@tanstack/react-router';
import { FileDown, Plus, Upload, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { type Option, VirtualizedSelect } from '../../components/ui/virtualized-select-fixed';
import { createSleeveServerFn, getAvailableSecuritiesServerFn } from '../../lib/server-functions';

// Use function return type instead of manual type
type Security = Awaited<ReturnType<typeof getAvailableSecuritiesServerFn>>[number];

export function AddSleeveModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [sleeveName, setSleeveName] = useState('');
  const [members, setMembers] = useState<Array<{ ticker: string; rank: number }>>([
    { ticker: '', rank: 1 },
    { ticker: '', rank: 2 },
    { ticker: '', rank: 3 },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [securities, setSecurities] = useState<Security[]>([]);
  const [securityOptions, setSecurityOptions] = useState<Option[]>([]);
  const [csvData, setCsvData] = useState('');
  const router = useRouter();
  const sleeveNameId = useId();
  const csvDataId = useId();
  const uploadCsvId = useId();

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
        console.error('Failed to load securities:', err);
      }
    };
    loadSecurities();
  }, []);

  const resetForm = () => {
    setSleeveName('');
    setMembers([
      { ticker: '', rank: 1 },
      { ticker: '', rank: 2 },
      { ticker: '', rank: 3 },
    ]);
    setCsvData('');
    setError('');
    setMode('single');
  };

  const validateMembers = (membersToValidate: Array<{ ticker: string; rank: number }>) => {
    const errors: string[] = [];

    if (membersToValidate.length === 0) {
      errors.push('At least one member is required');
    }

    const ranks = membersToValidate.map((m) => m.rank);
    const uniqueRanks = [...new Set(ranks)];
    if (ranks.length !== uniqueRanks.length) {
      errors.push('All members must have unique ranks');
    }

    const tickers = membersToValidate
      .map((m) => m.ticker.toUpperCase())
      .filter((t) => t.length > 0);
    const uniqueTickers = [...new Set(tickers)];
    if (tickers.length !== uniqueTickers.length) {
      errors.push('All members must have unique tickers');
    }

    const validTickers = new Set(securities.map((s) => s.ticker));
    const invalidTickers = tickers.filter((ticker) => !validTickers.has(ticker));
    if (invalidTickers.length > 0) {
      errors.push(`Invalid tickers: ${invalidTickers.join(', ')}`);
    }

    return errors;
  };

  const handleSubmitSingle = async () => {
    if (!sleeveName.trim()) {
      setError('Sleeve name is required');
      return;
    }

    const validMembers = members.filter((m) => m.ticker.trim().length > 0);
    const errors = validateMembers(validMembers);

    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await createSleeveServerFn({
        data: {
          name: sleeveName.trim(),
          members: validMembers.map((m) => ({
            ticker: m.ticker.toUpperCase().trim(),
            rank: m.rank,
          })),
        },
      });

      setIsOpen(false);
      resetForm();
      router.invalidate(); // Refresh the data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sleeve');
    } finally {
      setIsLoading(false);
    }
  };

  const parseCsvData = (
    csvText: string,
  ): Array<{ name: string; members: Array<{ ticker: string; rank: number }> }> => {
    const lines = csvText.trim().split('\n');
    const sleeveMap = new Map<string, Array<{ ticker: string; rank: number }>>();

    for (let i = 1; i < lines.length; i++) {
      // Skip header
      // Split by comma, tab, or multiple spaces
      const parts = lines[i].split(/[,\t]+|\s{2,}/).map((p) => p.trim());
      if (parts.length >= 3) {
        // Handle sleeve names that may contain spaces
        const rankStr = parts[parts.length - 1];
        const ticker = parts[parts.length - 2];
        const sleeve = parts.slice(0, parts.length - 2).join(' ');
        const rank = parseInt(rankStr, 10);

        if (sleeve && ticker && !Number.isNaN(rank)) {
          if (!sleeveMap.has(sleeve)) {
            sleeveMap.set(sleeve, []);
          }
          sleeveMap.get(sleeve)?.push({
            ticker: ticker.toUpperCase(),
            rank: rank,
          });
        }
      }
    }

    // Convert map to array and sort members by rank
    const sleeves: Array<{ name: string; members: Array<{ ticker: string; rank: number }> }> = [];
    for (const [name, members] of sleeveMap.entries()) {
      sleeves.push({
        name,
        members: members.sort((a, b) => a.rank - b.rank),
      });
    }

    return sleeves;
  };

  const handleSubmitBulk = async () => {
    if (!csvData.trim()) {
      setError('CSV data is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const sleevesToCreate = parseCsvData(csvData);

      if (sleevesToCreate.length === 0) {
        setError('No valid sleeves found in CSV data');
        return;
      }

      let successCount = 0;
      const errors: string[] = [];

      for (const sleeve of sleevesToCreate) {
        try {
          const validationErrors = validateMembers(sleeve.members);
          if (validationErrors.length > 0) {
            errors.push(`${sleeve.name}: ${validationErrors.join(', ')}`);
            continue;
          }

          await createSleeveServerFn({
            data: {
              name: sleeve.name,
              members: sleeve.members,
            },
          });
          successCount++;
        } catch (err) {
          errors.push(`${sleeve.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        setError(`Created ${successCount} sleeves. Errors: ${errors.join('; ')}`);
      } else {
        setIsOpen(false);
        resetForm();
        router.invalidate(); // Refresh the data
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process CSV data');
    } finally {
      setIsLoading(false);
    }
  };

  const updateMember = (index: number, field: 'ticker' | 'rank', value: string | number) => {
    const newMembers = [...members];
    if (field === 'ticker') {
      newMembers[index][field] = String(value).toUpperCase();
    } else {
      newMembers[index][field] = Number(value);
    }
    setMembers(newMembers);
  };

  const addMember = () => {
    const maxRank = Math.max(...members.map((m) => m.rank), 0);
    setMembers([...members, { ticker: '', rank: maxRank + 1 }]);
  };

  const removeMember = (index: number) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const downloadTemplate = () => {
    const csvContent =
      'sleeve,ticker,rank\nSample Sleeve,AAPL,1\nSample Sleeve,MSFT,2\nSample Sleeve,GOOGL,3\nAnother Sleeve,SPY,1\nAnother Sleeve,VOO,2\n';
    const blob = new globalThis.Blob([csvContent], { type: 'text/csv' });
    const url = globalThis.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sleeve_template.csv';
    a.click();
    globalThis.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Sleeve
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Sleeve</DialogTitle>
          <DialogDescription>
            Create a new sleeve with ranked member securities for tax-loss harvesting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode selector */}
          <div className="flex space-x-2">
            <Button
              variant={mode === 'single' ? 'default' : 'outline'}
              onClick={() => setMode('single')}
              size="sm"
            >
              Single Sleeve
            </Button>
            <Button
              variant={mode === 'bulk' ? 'default' : 'outline'}
              onClick={() => setMode('bulk')}
              size="sm"
            >
              <Upload className="h-4 w-4 mr-1" />
              Bulk Upload
            </Button>
          </div>

          {mode === 'single' ? (
            <>
              {/* Single sleeve form */}
              <div>
                <label
                  htmlFor={sleeveNameId}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Sleeve Name
                </label>
                <Input
                  id={sleeveNameId}
                  value={sleeveName}
                  onChange={(e) => setSleeveName(e.target.value)}
                  placeholder="Enter sleeve name"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="block text-sm font-medium text-gray-700">Members (by rank)</div>
                  <Button onClick={addMember} size="sm" variant="outline">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Member
                  </Button>
                </div>

                <div className="space-y-2">
                  {members.map((member, index) => (
                    <div
                      key={`${member.rank}-${member.ticker || 'empty'}`}
                      className="flex items-center space-x-2"
                    >
                      <div className="w-16">
                        <Input
                          type="number"
                          value={member.rank}
                          onChange={(e) => updateMember(index, 'rank', e.target.value)}
                          placeholder="Rank"
                          min="1"
                        />
                      </div>
                      <div className="flex-1">
                        <VirtualizedSelect
                          options={securityOptions}
                          value={member.ticker}
                          onValueChange={(value) => updateMember(index, 'ticker', value)}
                          placeholder="Select a ticker..."
                          searchPlaceholder="Search tickers..."
                          emptyMessage="No ticker found."
                        />
                      </div>
                      {members.length > 1 && (
                        <Button
                          type="button"
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
            </>
          ) : (
            <>
              {/* Bulk upload form */}
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
                  Format: sleeve,ticker,rank (one ticker per row)
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
            </>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
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
