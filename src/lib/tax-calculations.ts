export interface TaxBracket {
  minIncome: number;
  maxIncome: number | null;
  rate: number;
}

export interface StandardDeductions {
  federal: {
    single: number;
    married_filing_jointly: number;
    head_of_household: number;
  };
  california: {
    single: number;
    married_filing_jointly: number;
    head_of_household: number;
  };
  year: number;
  inflationAdjusted: boolean;
}

export interface TaxBrackets {
  federal_income: {
    single: TaxBracket[];
    married_filing_jointly: TaxBracket[];
    head_of_household: TaxBracket[];
  };
  federal_capital_gains: {
    single: TaxBracket[];
    married_filing_jointly: TaxBracket[];
    head_of_household: TaxBracket[];
  };
  california_income: {
    single: TaxBracket[];
    married_filing_jointly: TaxBracket[];
    head_of_household: TaxBracket[];
  };
  standardDeductions?: StandardDeductions;
}

export type FilingStatus = 'single' | 'married_filing_jointly' | 'head_of_household';

export interface TaxCalculationInput {
  ordinaryIncome: number;
  capitalGains: number;
  dividends: number;
  filingStatus: FilingStatus;
  taxBrackets: TaxBrackets;
  year?: number; // For inflation-adjusted standard deductions
}

export interface TaxCalculationResult {
  federalIncomeTax: number;
  californiaIncomeTax: number;
  federalCapitalGainsTax: number;
  californiaCapitalGainsTax: number;
  federalDividendTax: number;
  californiaDividendTax: number;
  totalTaxes: number;
  details?: TaxCalculationDetails;
}

export interface TaxCalculationDetails {
  federalIncome: TaxCalculationDetail;
  californiaIncome: TaxCalculationDetail;
  federalCapitalGains: TaxCalculationDetail;
  californiaCapitalGains: TaxCalculationDetail;
  federalDividend: TaxCalculationDetail;
  californiaDividend: TaxCalculationDetail;
}

export interface TaxCalculationDetail {
  taxType: string;
  income: number;
  standardDeduction: number;
  taxableIncome: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  brackets: Array<{
    minIncome: number;
    maxIncome: number | null;
    rate: number;
    taxableAmount: number;
    taxOwed: number;
  }>;
  inputs: {
    ordinaryIncome: number;
    capitalGains: number;
    dividends: number;
    filingStatus: FilingStatus;
  };
}

function calculateProgressiveTax(income: number, brackets: TaxBracket[]): number {
  // Sort brackets by minimum income to ensure proper order
  const sortedBrackets = [...brackets].sort((a, b) => a.minIncome - b.minIncome);

  let tax = 0;
  let previousMax = 0;

  for (const bracket of sortedBrackets) {
    if (income <= bracket.minIncome) break;

    const bracketStart = Math.max(bracket.minIncome, previousMax);
    const bracketEnd = bracket.maxIncome ?? income;
    const taxableInBracket = Math.min(income, bracketEnd) - bracketStart;

    if (taxableInBracket > 0) {
      tax += taxableInBracket * (bracket.rate / 100);
    }

    previousMax = bracketEnd;
    if (bracket.maxIncome && income <= bracket.maxIncome) break;
  }

  return tax;
}

// Calculate qualified dividends and capital gains tax using IRS Qualified Dividends and Capital Gain Tax Worksheet
// This implements the correct IRS methodology where qualified dividends and long-term capital gains
// are treated as a single "special-rate" bucket and taxed together based on total taxable income
function calculateQualifiedDividendsAndCapitalGainsTax(
  totalTaxableIncome: number,
  qualifiedDividendsAndCapitalGains: number,
  capitalGainsBrackets: TaxBracket[],
): number {
  if (qualifiedDividendsAndCapitalGains <= 0) return 0;

  // Sort brackets by minimum income
  const sortedBrackets = [...capitalGainsBrackets].sort((a, b) => a.minIncome - b.minIncome);

  let tax = 0;
  let remainingAmount = qualifiedDividendsAndCapitalGains;

  for (const bracket of sortedBrackets) {
    if (remainingAmount <= 0) break;

    const bracketStart = bracket.minIncome;
    const bracketEnd = bracket.maxIncome ?? Number.POSITIVE_INFINITY;

    // Check if total taxable income reaches this bracket
    if (totalTaxableIncome > bracketStart) {
      // The amount of qualified dividends/capital gains that gets this rate
      // is the overlap between the bracket and the portion of total income that consists of qualified dividends/capital gains
      const maxIncomeInBracket = Math.min(totalTaxableIncome, bracketEnd);
      const minIncomeInBracket = Math.max(
        bracketStart,
        totalTaxableIncome - qualifiedDividendsAndCapitalGains,
      );
      const qualifiedIncomeInBracket = Math.max(0, maxIncomeInBracket - minIncomeInBracket);

      if (qualifiedIncomeInBracket > 0) {
        const amountAtThisRate = Math.min(remainingAmount, qualifiedIncomeInBracket);
        tax += amountAtThisRate * (bracket.rate / 100);
        remainingAmount -= amountAtThisRate;
      }
    }
  }

  return tax;
}

// Calculate qualified dividends and capital gains tax with details for modal display
function calculateQualifiedDividendsAndCapitalGainsTaxWithDetails(
  totalTaxableIncome: number,
  qualifiedDividendsAndCapitalGains: number,
  brackets: TaxBracket[],
  taxType: string,
  inputs: {
    ordinaryIncome: number;
    capitalGains: number;
    dividends: number;
    filingStatus: FilingStatus;
    displayAmount?: number;
    isPartOfCombined?: boolean;
    federalStandardDeduction?: number;
  },
): TaxCalculationDetail {
  const sortedBrackets = [...brackets].sort((a, b) => a.minIncome - b.minIncome);

  let tax = 0;
  let remainingAmount = qualifiedDividendsAndCapitalGains;
  const bracketDetails: Array<{
    minIncome: number;
    maxIncome: number | null;
    rate: number;
    taxableAmount: number;
    taxOwed: number;
  }> = [];

  for (const bracket of sortedBrackets) {
    if (remainingAmount <= 0) break;

    const bracketStart = bracket.minIncome;
    const bracketEnd = bracket.maxIncome ?? Number.POSITIVE_INFINITY;

    // Check if total taxable income reaches this bracket
    if (totalTaxableIncome > bracketStart) {
      // The amount of qualified dividends/capital gains that gets this rate
      const maxIncomeInBracket = Math.min(totalTaxableIncome, bracketEnd);
      const minIncomeInBracket = Math.max(
        bracketStart,
        totalTaxableIncome - qualifiedDividendsAndCapitalGains,
      );
      const qualifiedIncomeInBracket = Math.max(0, maxIncomeInBracket - minIncomeInBracket);

      if (qualifiedIncomeInBracket > 0) {
        const amountAtThisRate = Math.min(remainingAmount, qualifiedIncomeInBracket);
        const taxOwed = amountAtThisRate * (bracket.rate / 100);
        tax += taxOwed;

        bracketDetails.push({
          minIncome: bracket.minIncome,
          maxIncome: bracket.maxIncome,
          rate: bracket.rate,
          taxableAmount: amountAtThisRate,
          taxOwed: taxOwed,
        });

        remainingAmount -= amountAtThisRate;
      }
    }
  }

  // If this is part of a combined calculation, calculate proportional values for display
  const displayAmount = inputs.displayAmount || qualifiedDividendsAndCapitalGains;
  const isPartOfCombined = inputs.isPartOfCombined || false;

  let displayTax = tax;
  let displayEffectiveRate =
    qualifiedDividendsAndCapitalGains > 0 ? (tax / qualifiedDividendsAndCapitalGains) * 100 : 0;
  let displayBracketDetails = bracketDetails;

  if (isPartOfCombined && qualifiedDividendsAndCapitalGains > 0) {
    const proportion = displayAmount / qualifiedDividendsAndCapitalGains;
    displayTax = tax * proportion;
    displayEffectiveRate = displayAmount > 0 ? (displayTax / displayAmount) * 100 : 0;

    // Scale bracket details proportionally
    displayBracketDetails = bracketDetails.map((bracket) => ({
      ...bracket,
      taxableAmount: bracket.taxableAmount * proportion,
      taxOwed: bracket.taxOwed * proportion,
    }));
  }

  const marginalRate = calculateMarginalTaxRate(totalTaxableIncome, brackets);

  return {
    taxType: isPartOfCombined ? `${taxType}` : taxType,
    income: isPartOfCombined
      ? qualifiedDividendsAndCapitalGains + inputs.ordinaryIncome
      : displayAmount,
    standardDeduction: isPartOfCombined ? inputs.federalStandardDeduction || 0 : 0,
    taxableIncome: isPartOfCombined ? totalTaxableIncome : displayAmount,
    totalTax: displayTax,
    effectiveRate: displayEffectiveRate,
    marginalRate,
    brackets: displayBracketDetails,
    inputs: {
      ...inputs,
      // Show the combined context in inputs
      ...(isPartOfCombined && {
        combinedQualifiedIncome: qualifiedDividendsAndCapitalGains,
        totalTaxableIncome: totalTaxableIncome,
        combinedTotalTax: tax,
        componentShare: displayAmount,
        isShowingFullCalculation: true,
      }),
    },
  };
}

function calculateProgressiveTaxWithDetails(
  income: number,
  brackets: TaxBracket[],
  taxType: string,
  inputs: {
    ordinaryIncome: number;
    capitalGains: number;
    dividends: number;
    filingStatus: FilingStatus;
  },
  standardDeduction = 0,
): TaxCalculationDetail {
  // Apply standard deduction
  const taxableIncome = Math.max(0, income - standardDeduction);

  // Sort brackets by minimum income to ensure proper order
  const sortedBrackets = [...brackets].sort((a, b) => a.minIncome - b.minIncome);

  let tax = 0;
  let previousMax = 0;
  const bracketDetails: Array<{
    minIncome: number;
    maxIncome: number | null;
    rate: number;
    taxableAmount: number;
    taxOwed: number;
  }> = [];

  for (const bracket of sortedBrackets) {
    if (taxableIncome <= bracket.minIncome) break;

    const bracketStart = Math.max(bracket.minIncome, previousMax);
    const bracketEnd = bracket.maxIncome ?? taxableIncome;
    const taxableInBracket = Math.min(taxableIncome, bracketEnd) - bracketStart;

    if (taxableInBracket > 0) {
      const taxOwed = taxableInBracket * (bracket.rate / 100);
      tax += taxOwed;

      bracketDetails.push({
        minIncome: bracket.minIncome,
        maxIncome: bracket.maxIncome,
        rate: bracket.rate,
        taxableAmount: taxableInBracket,
        taxOwed: taxOwed,
      });
    }

    previousMax = bracketEnd;
    if (bracket.maxIncome && taxableIncome <= bracket.maxIncome) break;
  }

  const effectiveRate = income > 0 ? (tax / income) * 100 : 0;
  const marginalRate = calculateMarginalTaxRate(taxableIncome, brackets);

  return {
    taxType,
    income,
    standardDeduction,
    taxableIncome,
    totalTax: tax,
    effectiveRate,
    marginalRate,
    brackets: bracketDetails,
    inputs,
  };
}

export function calculateTaxes(
  input: TaxCalculationInput,
  includeDetails = false,
  inflationRate = 2.0,
): TaxCalculationResult {
  const { ordinaryIncome, capitalGains, dividends, filingStatus, taxBrackets, year = 2025 } = input;

  // Get standard deductions (with inflation adjustment if applicable)
  const standardDeductions = taxBrackets.standardDeductions || DEFAULT_STANDARD_DEDUCTIONS_2025;
  const federalStandardDeduction = getStandardDeduction(
    filingStatus,
    standardDeductions,
    year,
    inflationRate,
    'federal',
  );
  const californiaStandardDeduction = getStandardDeduction(
    filingStatus,
    standardDeductions,
    year,
    inflationRate,
    'california',
  );

  // Total income and total taxable income calculations
  const totalIncome = ordinaryIncome + capitalGains + dividends;
  const federalTotalTaxableIncome = Math.max(0, totalIncome - federalStandardDeduction);
  const californiaTotalTaxableIncome = Math.max(0, totalIncome - californiaStandardDeduction);

  const inputDetails = { ordinaryIncome, capitalGains, dividends, filingStatus };

  // Federal Income Tax (on ordinary income only, with standard deduction applied to total income)
  const federalOrdinaryTaxableIncome = Math.max(0, ordinaryIncome - federalStandardDeduction);
  const federalIncomeTax = calculateProgressiveTax(
    federalOrdinaryTaxableIncome,
    taxBrackets.federal_income[filingStatus],
  );

  // California Income Tax (on all income with standard deduction)
  const californiaIncomeTax = calculateProgressiveTax(
    californiaTotalTaxableIncome,
    taxBrackets.california_income[filingStatus],
  );

  // Federal Qualified Dividends and Capital Gains Tax using IRS worksheet methodology
  // Treat qualified dividends and capital gains as a single special-rate bucket
  const qualifiedDividendsAndCapitalGains = capitalGains + dividends;
  const federalQualifiedTax = calculateQualifiedDividendsAndCapitalGainsTax(
    federalTotalTaxableIncome,
    qualifiedDividendsAndCapitalGains,
    taxBrackets.federal_capital_gains[filingStatus],
  );

  // Split the federal qualified tax proportionally between capital gains and dividends for display
  const totalQualified = qualifiedDividendsAndCapitalGains;
  const federalCapitalGainsTax =
    totalQualified > 0 ? (federalQualifiedTax * capitalGains) / totalQualified : 0;
  const federalDividendTax =
    totalQualified > 0 ? (federalQualifiedTax * dividends) / totalQualified : 0;

  // California Capital Gains and Dividend Tax (included in CA income tax calculation above, so $0 here)
  const californiaCapitalGainsTax = 0;
  const californiaDividendTax = 0;

  const totalTaxes =
    federalIncomeTax +
    californiaIncomeTax +
    federalCapitalGainsTax +
    californiaCapitalGainsTax +
    federalDividendTax +
    californiaDividendTax;

  let details: TaxCalculationDetails | undefined;

  if (includeDetails) {
    details = {
      federalIncome: calculateProgressiveTaxWithDetails(
        ordinaryIncome,
        taxBrackets.federal_income[filingStatus],
        'Federal Income Tax',
        inputDetails,
        federalStandardDeduction,
      ),
      californiaIncome: calculateProgressiveTaxWithDetails(
        totalIncome,
        taxBrackets.california_income[filingStatus],
        'California Income Tax',
        inputDetails,
        californiaStandardDeduction,
      ),
      federalCapitalGains: calculateQualifiedDividendsAndCapitalGainsTaxWithDetails(
        federalTotalTaxableIncome,
        qualifiedDividendsAndCapitalGains,
        taxBrackets.federal_capital_gains[filingStatus],
        'Federal Capital Gains Tax',
        {
          ...inputDetails,
          displayAmount: capitalGains,
          isPartOfCombined: true,
          federalStandardDeduction,
        },
      ),
      californiaCapitalGains: calculateProgressiveTaxWithDetails(
        0, // California capital gains included in income tax
        taxBrackets.california_income[filingStatus],
        'California Capital Gains Tax',
        inputDetails,
        0,
      ),
      federalDividend: calculateQualifiedDividendsAndCapitalGainsTaxWithDetails(
        federalTotalTaxableIncome,
        qualifiedDividendsAndCapitalGains,
        taxBrackets.federal_capital_gains[filingStatus],
        'Federal Dividend Tax',
        {
          ...inputDetails,
          displayAmount: dividends,
          isPartOfCombined: true,
          federalStandardDeduction,
        },
      ),
      californiaDividend: calculateProgressiveTaxWithDetails(
        0, // California dividends included in income tax
        taxBrackets.california_income[filingStatus],
        'California Dividend Tax',
        inputDetails,
        0,
      ),
    };
  }

  return {
    federalIncomeTax,
    californiaIncomeTax,
    federalCapitalGainsTax,
    californiaCapitalGainsTax,
    federalDividendTax,
    californiaDividendTax,
    totalTaxes,
    details,
  };
}

// Default 2025 standard deductions (IRS projected values)
const DEFAULT_STANDARD_DEDUCTIONS_2025: StandardDeductions = {
  federal: {
    single: 15750, // 2025 updated values
    married_filing_jointly: 31500, // 2025 updated values
    head_of_household: 23625, // 2025 updated values
  },
  california: {
    single: 5202, // 2024 CA amounts
    married_filing_jointly: 10404,
    head_of_household: 10404,
  },
  year: 2025,
  inflationAdjusted: true,
};

function calculateInflationAdjustedStandardDeduction(
  baseAmount: number,
  baseYear: number,
  currentYear: number,
  inflationRate: number,
  isInflationAdjusted: boolean,
): number {
  if (!isInflationAdjusted || currentYear <= baseYear) return baseAmount;
  const yearsDiff = currentYear - baseYear;
  return Math.round(baseAmount * (1 + inflationRate / 100) ** yearsDiff);
}

function getStandardDeduction(
  filingStatus: FilingStatus,
  standardDeductions: StandardDeductions,
  year = 2025,
  inflationRate = 2.0,
  taxType: 'federal' | 'california' = 'federal',
): number {
  const baseAmount = standardDeductions[taxType][filingStatus];
  return calculateInflationAdjustedStandardDeduction(
    baseAmount,
    standardDeductions.year,
    year,
    inflationRate,
    standardDeductions.inflationAdjusted,
  );
}

// Default 2025 tax brackets
export const DEFAULT_TAX_BRACKETS_2025: TaxBrackets = {
  federal_income: {
    single: [
      { minIncome: 0, maxIncome: 11925, rate: 10 },
      { minIncome: 11926, maxIncome: 48350, rate: 12 },
      { minIncome: 48351, maxIncome: 103350, rate: 22 },
      { minIncome: 103351, maxIncome: 197300, rate: 24 },
      { minIncome: 197301, maxIncome: 250525, rate: 32 },
      { minIncome: 250526, maxIncome: 626350, rate: 35 },
      { minIncome: 626351, maxIncome: null, rate: 37 },
    ],
    married_filing_jointly: [
      { minIncome: 0, maxIncome: 23850, rate: 10 },
      { minIncome: 23851, maxIncome: 96700, rate: 12 },
      { minIncome: 96701, maxIncome: 206700, rate: 22 },
      { minIncome: 206701, maxIncome: 394600, rate: 24 },
      { minIncome: 394601, maxIncome: 501050, rate: 32 },
      { minIncome: 501051, maxIncome: 751600, rate: 35 },
      { minIncome: 751601, maxIncome: null, rate: 37 },
    ],
    head_of_household: [
      { minIncome: 0, maxIncome: 17000, rate: 10 },
      { minIncome: 17001, maxIncome: 64850, rate: 12 },
      { minIncome: 64851, maxIncome: 103350, rate: 22 },
      { minIncome: 103351, maxIncome: 197300, rate: 24 },
      { minIncome: 197301, maxIncome: 250525, rate: 32 },
      { minIncome: 250526, maxIncome: 626350, rate: 35 },
      { minIncome: 626351, maxIncome: null, rate: 37 },
    ],
  },
  federal_capital_gains: {
    single: [
      { minIncome: 0, maxIncome: 48350, rate: 0 },
      { minIncome: 48351, maxIncome: 533400, rate: 15 },
      { minIncome: 533401, maxIncome: null, rate: 20 },
    ],
    married_filing_jointly: [
      { minIncome: 0, maxIncome: 96700, rate: 0 },
      { minIncome: 96701, maxIncome: 600050, rate: 15 },
      { minIncome: 600051, maxIncome: null, rate: 20 },
    ],
    head_of_household: [
      { minIncome: 0, maxIncome: 64700, rate: 0 },
      { minIncome: 64701, maxIncome: 566700, rate: 15 },
      { minIncome: 566701, maxIncome: null, rate: 20 },
    ],
  },
  california_income: {
    single: [
      { minIncome: 0, maxIncome: 10756, rate: 1 },
      { minIncome: 10757, maxIncome: 25499, rate: 2 },
      { minIncome: 25500, maxIncome: 40245, rate: 4 },
      { minIncome: 40246, maxIncome: 55866, rate: 6 },
      { minIncome: 55867, maxIncome: 70606, rate: 8 },
      { minIncome: 70607, maxIncome: 360659, rate: 9.3 },
      { minIncome: 360660, maxIncome: 432787, rate: 10.3 },
      { minIncome: 432788, maxIncome: 721314, rate: 11.3 },
      { minIncome: 721315, maxIncome: 1000000, rate: 12.3 },
      { minIncome: 1000001, maxIncome: null, rate: 13.3 },
    ],
    married_filing_jointly: [
      { minIncome: 0, maxIncome: 21512, rate: 1 },
      { minIncome: 21513, maxIncome: 50998, rate: 2 },
      { minIncome: 50999, maxIncome: 80490, rate: 4 },
      { minIncome: 80491, maxIncome: 111732, rate: 6 },
      { minIncome: 111733, maxIncome: 141212, rate: 8 },
      { minIncome: 141213, maxIncome: 721318, rate: 9.3 },
      { minIncome: 721319, maxIncome: 865574, rate: 10.3 },
      { minIncome: 865575, maxIncome: 1442628, rate: 11.3 },
      { minIncome: 1442629, maxIncome: 2000000, rate: 12.3 },
      { minIncome: 2000001, maxIncome: null, rate: 13.3 },
    ],
    head_of_household: [
      { minIncome: 0, maxIncome: 21537, rate: 1 },
      { minIncome: 21538, maxIncome: 50998, rate: 2 },
      { minIncome: 50999, maxIncome: 65496, rate: 4 },
      { minIncome: 65497, maxIncome: 80995, rate: 6 },
      { minIncome: 80996, maxIncome: 101220, rate: 8 },
      { minIncome: 101221, maxIncome: 515303, rate: 9.3 },
      { minIncome: 515304, maxIncome: 618365, rate: 10.3 },
      { minIncome: 618366, maxIncome: 1030609, rate: 11.3 },
      { minIncome: 1030610, maxIncome: 1500000, rate: 12.3 },
      { minIncome: 1500001, maxIncome: null, rate: 13.3 },
    ],
  },
  standardDeductions: DEFAULT_STANDARD_DEDUCTIONS_2025,
};

// Removed: calculateEffectiveTaxRate - was unused and never called

// Utility function to calculate marginal tax rate
function calculateMarginalTaxRate(income: number, brackets: TaxBracket[]): number {
  const sortedBrackets = [...brackets].sort((a, b) => a.minIncome - b.minIncome);

  for (const bracket of sortedBrackets) {
    if (
      income >= bracket.minIncome &&
      (bracket.maxIncome === null || income <= bracket.maxIncome)
    ) {
      return bracket.rate;
    }
  }

  return 0;
}
