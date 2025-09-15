// Required Minimum Distribution (RMD) calculations
// Based on IRS Uniform Lifetime Table (Publication 590-B)

interface RMDTableEntry {
  age: number;
  distributionPeriod: number;
}

// IRS Uniform Lifetime Table for 2024 and later
// This table is used for most account owners whose spouse is not the sole beneficiary
// or whose spouse is not more than 10 years younger
const UNIFORM_LIFETIME_TABLE: RMDTableEntry[] = [
  { age: 73, distributionPeriod: 26.5 },
  { age: 74, distributionPeriod: 25.5 },
  { age: 75, distributionPeriod: 24.6 },
  { age: 76, distributionPeriod: 23.7 },
  { age: 77, distributionPeriod: 22.9 },
  { age: 78, distributionPeriod: 22.0 },
  { age: 79, distributionPeriod: 21.1 },
  { age: 80, distributionPeriod: 20.2 },
  { age: 81, distributionPeriod: 19.4 },
  { age: 82, distributionPeriod: 18.5 },
  { age: 83, distributionPeriod: 17.7 },
  { age: 84, distributionPeriod: 16.8 },
  { age: 85, distributionPeriod: 16.0 },
  { age: 86, distributionPeriod: 15.2 },
  { age: 87, distributionPeriod: 14.4 },
  { age: 88, distributionPeriod: 13.7 },
  { age: 89, distributionPeriod: 12.9 },
  { age: 90, distributionPeriod: 12.2 },
  { age: 91, distributionPeriod: 11.5 },
  { age: 92, distributionPeriod: 10.8 },
  { age: 93, distributionPeriod: 10.1 },
  { age: 94, distributionPeriod: 9.5 },
  { age: 95, distributionPeriod: 8.9 },
  { age: 96, distributionPeriod: 8.4 },
  { age: 97, distributionPeriod: 7.8 },
  { age: 98, distributionPeriod: 7.3 },
  { age: 99, distributionPeriod: 6.8 },
  { age: 100, distributionPeriod: 6.4 },
  { age: 101, distributionPeriod: 6.0 },
  { age: 102, distributionPeriod: 5.6 },
  { age: 103, distributionPeriod: 5.2 },
  { age: 104, distributionPeriod: 4.9 },
  { age: 105, distributionPeriod: 4.6 },
  { age: 106, distributionPeriod: 4.3 },
  { age: 107, distributionPeriod: 4.1 },
  { age: 108, distributionPeriod: 3.9 },
  { age: 109, distributionPeriod: 3.7 },
  { age: 110, distributionPeriod: 3.5 },
  { age: 111, distributionPeriod: 3.4 },
  { age: 112, distributionPeriod: 3.3 },
  { age: 113, distributionPeriod: 3.1 },
  { age: 114, distributionPeriod: 3.0 },
  { age: 115, distributionPeriod: 2.9 },
  { age: 116, distributionPeriod: 2.8 },
  { age: 117, distributionPeriod: 2.7 },
  { age: 118, distributionPeriod: 2.5 },
  { age: 119, distributionPeriod: 2.3 },
  { age: 120, distributionPeriod: 2.0 },
];

// Joint Life and Last Survivor Table - used when spouse is sole beneficiary
// and is more than 10 years younger than account owner
// For simplicity, we'll use a subset of common age differences
const JOINT_LIFE_TABLE: { [ageDifference: number]: RMDTableEntry[] } = {
  11: [
    { age: 73, distributionPeriod: 28.2 },
    { age: 74, distributionPeriod: 27.2 },
    { age: 75, distributionPeriod: 26.3 },
    { age: 76, distributionPeriod: 25.3 },
    { age: 77, distributionPeriod: 24.4 },
    { age: 78, distributionPeriod: 23.5 },
    { age: 79, distributionPeriod: 22.5 },
    { age: 80, distributionPeriod: 21.6 },
    // ... more entries would be added for production use
  ],
  15: [
    { age: 73, distributionPeriod: 30.6 },
    { age: 74, distributionPeriod: 29.6 },
    { age: 75, distributionPeriod: 28.7 },
    { age: 76, distributionPeriod: 27.7 },
    { age: 77, distributionPeriod: 26.8 },
    { age: 78, distributionPeriod: 25.8 },
    { age: 79, distributionPeriod: 24.9 },
    { age: 80, distributionPeriod: 24.0 },
    // ... more entries would be added for production use
  ],
  20: [
    { age: 73, distributionPeriod: 33.2 },
    { age: 74, distributionPeriod: 32.2 },
    { age: 75, distributionPeriod: 31.3 },
    { age: 76, distributionPeriod: 30.3 },
    { age: 77, distributionPeriod: 29.4 },
    { age: 78, distributionPeriod: 28.4 },
    { age: 79, distributionPeriod: 27.5 },
    { age: 80, distributionPeriod: 26.5 },
    // ... more entries would be added for production use
  ],
};

export interface RMDCalculationInput {
  accountBalance: number; // Account balance as of December 31 of prior year
  ownerAge: number; // Age on December 31 of current year
  spouseAge?: number; // Age of spouse on December 31 of current year (if married)
  filingStatus: 'single' | 'married_filing_jointly' | 'head_of_household';
}

export interface RMDCalculationResult {
  requiredDistribution: number;
  distributionPeriod: number;
  table: 'uniform_lifetime' | 'joint_life';
  isRMDRequired: boolean;
  notes?: string;
}

function getDistributionPeriod(age: number, table: RMDTableEntry[]): number {
  // Find the entry for the given age
  const entry = table.find((e) => e.age === age);
  if (entry) {
    return entry.distributionPeriod;
  }

  // If exact age not found, use the last entry (for ages beyond the table)
  if (age > table[table.length - 1].age) {
    return table[table.length - 1].distributionPeriod;
  }

  // If age is below the minimum age in table, no RMD required
  return 0;
}

export function calculateRMD(input: RMDCalculationInput): RMDCalculationResult {
  const { accountBalance, ownerAge, spouseAge, filingStatus } = input;

  // RMDs start at age 73 (as of 2023)
  if (ownerAge < 73) {
    return {
      requiredDistribution: 0,
      distributionPeriod: 0,
      table: 'uniform_lifetime',
      isRMDRequired: false,
      notes: 'RMDs not required until age 73',
    };
  }

  // Determine which table to use
  let table: RMDTableEntry[];
  let tableType: 'uniform_lifetime' | 'joint_life' = 'uniform_lifetime';

  if (filingStatus === 'married_filing_jointly' && spouseAge !== undefined) {
    const ageDifference = ownerAge - spouseAge;

    // Use Joint Life table if spouse is sole beneficiary and more than 10 years younger
    if (ageDifference > 10) {
      // For simplicity, we'll use predefined age differences
      // In production, this would calculate the exact distribution period
      if (ageDifference >= 20) {
        table = JOINT_LIFE_TABLE[20] || UNIFORM_LIFETIME_TABLE;
      } else if (ageDifference >= 15) {
        table = JOINT_LIFE_TABLE[15] || UNIFORM_LIFETIME_TABLE;
      } else if (ageDifference >= 11) {
        table = JOINT_LIFE_TABLE[11] || UNIFORM_LIFETIME_TABLE;
      } else {
        table = UNIFORM_LIFETIME_TABLE;
      }

      if (table !== UNIFORM_LIFETIME_TABLE) {
        tableType = 'joint_life';
      }
    } else {
      table = UNIFORM_LIFETIME_TABLE;
    }
  } else {
    table = UNIFORM_LIFETIME_TABLE;
  }

  const distributionPeriod = getDistributionPeriod(ownerAge, table);

  if (distributionPeriod === 0) {
    return {
      requiredDistribution: 0,
      distributionPeriod: 0,
      table: tableType,
      isRMDRequired: false,
      notes: 'Age not found in distribution table',
    };
  }

  const requiredDistribution = accountBalance / distributionPeriod;

  return {
    requiredDistribution,
    distributionPeriod,
    table: tableType,
    isRMDRequired: true,
    notes: `Using ${tableType === 'joint_life' ? 'Joint Life' : 'Uniform Lifetime'} table`,
  };
}

// Utility function to calculate RMD for multiple years
export function calculateRMDSchedule(
  initialBalance: number,
  startingAge: number,
  years: number,
  spouseAge?: number,
  filingStatus: 'single' | 'married_filing_jointly' | 'head_of_household' = 'single',
  growthRate = 0.07, // 7% default growth rate
): Array<{
  year: number;
  age: number;
  accountBalance: number;
  rmdResult: RMDCalculationResult;
  endingBalance: number;
}> {
  const schedule = [];
  let currentBalance = initialBalance;

  for (let year = 0; year < years; year++) {
    const currentAge = startingAge + year;
    const currentSpouseAge = spouseAge ? spouseAge + year : undefined;

    // Calculate RMD based on beginning of year balance
    const rmdResult = calculateRMD({
      accountBalance: currentBalance,
      ownerAge: currentAge,
      spouseAge: currentSpouseAge,
      filingStatus,
    });

    // Apply growth and subtract RMD
    const growthAmount = currentBalance * growthRate;
    const endingBalance = currentBalance + growthAmount - rmdResult.requiredDistribution;

    schedule.push({
      year: year + 1,
      age: currentAge,
      accountBalance: currentBalance,
      rmdResult,
      endingBalance: Math.max(0, endingBalance), // Can't go negative
    });

    currentBalance = Math.max(0, endingBalance);
  }

  return schedule;
}

// Utility function to estimate total RMDs over a period
export function estimateTotalRMDs(
  initialBalance: number,
  startingAge: number,
  endingAge: number,
  spouseAge?: number,
  filingStatus: 'single' | 'married_filing_jointly' | 'head_of_household' = 'single',
  growthRate = 0.07,
): number {
  const years = endingAge - startingAge + 1;
  const schedule = calculateRMDSchedule(
    initialBalance,
    startingAge,
    years,
    spouseAge,
    filingStatus,
    growthRate,
  );

  return schedule.reduce((total, entry) => total + entry.rmdResult.requiredDistribution, 0);
}

// Utility to check if RMDs apply in a given year
export function isRMDYear(age: number): boolean {
  return age >= 73;
}

// Utility to get the current RMD age (73 as of 2023)
export function getCurrentRMDAge(): number {
  return 73;
}
