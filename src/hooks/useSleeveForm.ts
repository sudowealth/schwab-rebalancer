import { useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Option } from '../components/ui/virtualized-select';
import type { Sleeve } from '../lib/schemas';
import { getAvailableSecuritiesServerFn } from '../lib/server-functions';

type Security = Awaited<ReturnType<typeof getAvailableSecuritiesServerFn>>[number];

export interface SleeveFormData {
  sleeveName: string;
  targetSecurity: string;
  alternateSecurities: Array<{ ticker: string; rank: number }>;
  legacySecurities: Array<{ ticker: string; rank: number }>;
}

export interface UseSleeveFormOptions {
  initialData?: Sleeve | null;
  onSubmit?: (data: SleeveFormData) => Promise<void>;
}

export function useSleeveForm(options: UseSleeveFormOptions = {}) {
  const { initialData, onSubmit } = options;
  const router = useRouter();

  const [sleeveName, setSleeveName] = useState('');
  const [targetSecurity, setTargetSecurity] = useState<string>('');
  const [alternateSecurities, setAlternateSecurities] = useState<
    Array<{ ticker: string; rank: number }>
  >([]);
  const [legacySecurities, setLegacySecurities] = useState<Array<{ ticker: string; rank: number }>>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [securities, setSecurities] = useState<Security[]>([]);
  const [securityOptions, setSecurityOptions] = useState<Option[]>([]);

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

  // Load sleeve data when initialData prop changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setSleeveName(initialData.name);

      // Separate members into target, alternate, and legacy
      const targetMember = initialData.members.find((member) => member.rank === 1);
      const alternateMembers = initialData.members.filter(
        (member) => member.rank > 1 && !member.isLegacy,
      );
      const legacyMembers = initialData.members.filter((member) => member.isLegacy);

      setTargetSecurity(targetMember?.ticker || '');
      setAlternateSecurities(
        alternateMembers.map((member) => ({
          ticker: member.ticker,
          rank: member.rank,
        })),
      );
      setLegacySecurities(
        legacyMembers.map((member) => ({
          ticker: member.ticker,
          rank: member.rank,
        })),
      );
      setError('');
    }
  }, [initialData]);

  const resetForm = () => {
    setSleeveName('');
    setTargetSecurity('');
    setAlternateSecurities([]);
    setLegacySecurities([]);
    setError('');
  };

  // Helper function to combine all securities into members format for validation
  const combineSecuritiesToMembers = (
    target: string,
    alternates: Array<{ ticker: string; rank: number }>,
    legacies: Array<{ ticker: string; rank: number }>,
  ): Array<{ ticker: string; rank: number; isLegacy: boolean }> => {
    const members: Array<{ ticker: string; rank: number; isLegacy: boolean }> = [];

    // Add target security (rank 1, not legacy)
    if (target.trim()) {
      members.push({ ticker: target.trim(), rank: 1, isLegacy: false });
    }

    // Add alternate securities (not legacy)
    alternates.forEach((alt) => {
      if (alt.ticker.trim()) {
        members.push({ ticker: alt.ticker.trim(), rank: alt.rank, isLegacy: false });
      }
    });

    // Add legacy securities (legacy)
    legacies.forEach((leg) => {
      if (leg.ticker.trim()) {
        members.push({ ticker: leg.ticker.trim(), rank: leg.rank, isLegacy: true });
      }
    });

    return members;
  };

  const validateSecurities = () => {
    const errors: string[] = [];

    // Check if target security is provided
    if (!targetSecurity.trim()) {
      errors.push('Target security is required');
    }

    // Combine all securities for validation
    const allMembers = combineSecuritiesToMembers(
      targetSecurity,
      alternateSecurities,
      legacySecurities,
    );

    if (allMembers.length === 0) {
      errors.push('At least one member is required');
    }

    // Check for unique ranks
    const ranks = allMembers.map((m) => m.rank);
    const uniqueRanks = [...new Set(ranks)];
    if (ranks.length !== uniqueRanks.length) {
      errors.push('All members must have unique ranks');
    }

    // Check for valid tickers
    const validTickers = new Set(securities.map((s) => s.ticker));
    const tickers = allMembers.map((m) => m.ticker.toUpperCase());
    const invalidTickers = tickers.filter((ticker) => !validTickers.has(ticker));
    if (invalidTickers.length > 0) {
      errors.push(`Invalid tickers: ${invalidTickers.join(', ')}`);
      return errors; // Return early if there are invalid tickers
    }

    // Check for cross-category duplicates
    const targetTicker = targetSecurity.trim().toUpperCase();

    // Check if target appears in alternate securities
    const duplicateInAlternate = alternateSecurities.find(
      (alt) => alt.ticker.trim().toUpperCase() === targetTicker,
    );
    if (duplicateInAlternate) {
      errors.push(
        `Target security "${targetSecurity.toUpperCase()}" cannot also be an alternate security`,
      );
    }

    // Check if target appears in legacy securities
    const duplicateInLegacy = legacySecurities.find(
      (leg) => leg.ticker.trim().toUpperCase() === targetTicker,
    );
    if (duplicateInLegacy) {
      errors.push(
        `Target security "${targetSecurity.toUpperCase()}" cannot also be a legacy security`,
      );
    }

    // Check for duplicates between alternate and legacy securities
    for (const alt of alternateSecurities) {
      const altTicker = alt.ticker.trim().toUpperCase();
      if (!altTicker) continue;

      const duplicateInLegacy = legacySecurities.find(
        (leg) => leg.ticker.trim().toUpperCase() === altTicker,
      );
      if (duplicateInLegacy) {
        errors.push(
          `Security "${alt.ticker.toUpperCase()}" cannot be both an alternate and legacy security`,
        );
      }
    }

    // Check for unique tickers (after cross-category validation)
    const uniqueTickers = [...new Set(tickers)];
    if (tickers.length !== uniqueTickers.length) {
      // Find the specific duplicates
      const tickerCount = new Map<string, number>();
      tickers.forEach((ticker) => {
        tickerCount.set(ticker, (tickerCount.get(ticker) || 0) + 1);
      });
      const duplicates = Array.from(tickerCount.entries())
        .filter(([, count]) => count > 1)
        .map(([ticker]) => ticker);
      errors.push(`Security "${duplicates.join(', ')}" appears in multiple categories`);
    }

    return errors;
  };

  const handleSubmit = async () => {
    if (!sleeveName.trim()) {
      setError('Sleeve name is required');
      return;
    }

    const errors = validateSecurities();
    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const formData: SleeveFormData = {
        sleeveName: sleeveName.trim(),
        targetSecurity,
        alternateSecurities,
        legacySecurities,
      };

      if (onSubmit) {
        await onSubmit(formData);
      }

      router.invalidate(); // Refresh the data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sleeve');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions for managing alternate and legacy securities
  const addAlternateSecurity = () => {
    const maxRank = Math.max(...alternateSecurities.map((m) => m.rank), 1);
    setAlternateSecurities([...alternateSecurities, { ticker: '', rank: maxRank + 1 }]);
  };

  const updateAlternateSecurity = (
    index: number,
    field: 'ticker' | 'rank',
    value: string | number,
  ) => {
    const newSecurities = [...alternateSecurities];
    if (field === 'ticker') {
      newSecurities[index][field] = String(value).toUpperCase();
    } else if (field === 'rank') {
      newSecurities[index][field] = Number(value);
    }
    setAlternateSecurities(newSecurities);
  };

  const removeAlternateSecurity = (index: number) => {
    setAlternateSecurities(alternateSecurities.filter((_, i) => i !== index));
  };

  const addLegacySecurity = () => {
    const maxRank = Math.max(
      ...alternateSecurities.map((m) => m.rank),
      ...legacySecurities.map((m) => m.rank),
      1,
    );
    setLegacySecurities([...legacySecurities, { ticker: '', rank: maxRank + 1 }]);
  };

  const updateLegacySecurity = (
    index: number,
    field: 'ticker' | 'rank',
    value: string | number,
  ) => {
    const newSecurities = [...legacySecurities];
    if (field === 'ticker') {
      newSecurities[index][field] = String(value).toUpperCase();
    } else if (field === 'rank') {
      newSecurities[index][field] = Number(value);
    }
    setLegacySecurities(newSecurities);
  };

  const removeLegacySecurity = (index: number) => {
    setLegacySecurities(legacySecurities.filter((_, i) => i !== index));
  };

  // Helper functions to check for duplicates
  const isSecurityInUse = (ticker: string, excludeCategory?: 'target' | 'alternate' | 'legacy') => {
    const upperTicker = ticker.trim().toUpperCase();
    if (!upperTicker) return false;

    if (excludeCategory !== 'target' && targetSecurity.trim().toUpperCase() === upperTicker) {
      return 'target';
    }

    if (excludeCategory !== 'alternate') {
      const inAlternate = alternateSecurities.some(
        (alt) => alt.ticker.trim().toUpperCase() === upperTicker,
      );
      if (inAlternate) return 'alternate';
    }

    if (excludeCategory !== 'legacy') {
      const inLegacy = legacySecurities.some(
        (leg) => leg.ticker.trim().toUpperCase() === upperTicker,
      );
      if (inLegacy) return 'legacy';
    }

    return false;
  };

  const getFilteredSecurityOptions = (excludeCategory?: 'target' | 'alternate' | 'legacy') => {
    return securityOptions.filter((option) => {
      const inUse = isSecurityInUse(option.value, excludeCategory);
      return !inUse;
    });
  };

  return {
    // State
    sleeveName,
    setSleeveName,
    targetSecurity,
    setTargetSecurity,
    alternateSecurities,
    legacySecurities,
    isLoading,
    error,
    securities,
    securityOptions,

    // Actions
    resetForm,
    handleSubmit,
    validateSecurities,
    combineSecuritiesToMembers,

    // Alternate securities management
    addAlternateSecurity,
    updateAlternateSecurity,
    removeAlternateSecurity,

    // Legacy securities management
    addLegacySecurity,
    updateLegacySecurity,
    removeLegacySecurity,

    // Helper functions for duplicate prevention
    isSecurityInUse,
    getFilteredSecurityOptions,
  };
}
