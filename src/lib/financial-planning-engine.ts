import { calculateTaxes, TaxBrackets, FilingStatus, DEFAULT_TAX_BRACKETS_2025, TaxCalculationDetails } from "./tax-calculations";
import { calculateRMD } from "./rmd-calculations";

export interface PlanInputs {
  filingStatus: FilingStatus;
  primaryUserAge: number;
  spouseAge?: number;
  simulationPeriod: number;
  returnRate: number; // Annual return rate as percentage
  inflationRate: number; // Annual inflation rate as percentage
  dividendRate: number; // Expected dividend rate as percentage
  
  // Account balances
  taxableBalance: number;
  taxableCostBasis: number;
  rothBalance: number;
  deferredBalance: number;
  
  // Tax configuration
  taxBrackets?: TaxBrackets;
}

export interface Goal {
  id: string;
  purpose: string;
  type: "contribution" | "fixed_withdrawal";
  amount: number;
  inflationAdjusted: boolean;
  startTiming: string; // For now, just "immediately" - can be expanded later
  durationYears: number;
  frequency: "annually" | "monthly";
  repeatPattern: string;
  occurrences: number;
  enabled: boolean; // Whether this goal is active in calculations
}

export interface YearResult {
  year: number;
  userAge: number;
  spouseAge?: number;
  
  // Starting balances
  startingTaxable: number;
  startingRoth: number;
  startingDeferred: number;
  
  // Growth (before withdrawals)
  growthTaxable: number;
  growthRoth: number;
  growthDeferred: number;
  
  // Goal-based contributions and withdrawals
  contributionsTaxable: number;
  contributionsRoth: number;
  contributionsDeferred: number;
  withdrawalsTaxable: number;
  withdrawalsRoth: number;
  withdrawalsDeferred: number;
  
  // RMDs
  rmdAmount: number;
  
  // Dividend income (for tax purposes)
  dividendIncome: number;
  
  // Capital gains realized (from taxable account withdrawals)
  capitalGainsRealized: number;
  
  // Tax calculations
  federalIncomeTax: number;
  californiaIncomeTax: number;
  federalCapitalGainsTax: number;
  californiaCapitalGainsTax: number;
  federalDividendTax: number;
  californiaDividendTax: number;
  totalTaxes: number;
  
  // Tax calculation details for modal display
  taxDetails?: TaxCalculationDetails;
  
  // Ending balances (after growth, contributions, withdrawals, taxes)
  endingTaxable: number;
  endingRoth: number;
  endingDeferred: number;
  
  // Summary
  totalPortfolioNominal: number;
  totalPortfolioReal: number; // Inflation-adjusted to year 1 dollars
}

export interface PlanResult {
  inputs: PlanInputs;
  goals: Goal[];
  yearlyResults: YearResult[];
  summary: {
    finalNominalValue: number;
    finalRealValue: number;
    totalTaxesPaid: number;
    totalContributions: number;
    totalWithdrawals: number;
  };
}

function calculateInflationAdjustedAmount(
  baseAmount: number,
  year: number,
  inflationRate: number,
  isInflationAdjusted: boolean
): number {
  if (!isInflationAdjusted) return baseAmount;
  return baseAmount * Math.pow(1 + inflationRate / 100, year - 1);
}

function calculateGoalAmounts(
  goals: Goal[],
  year: number,
  inflationRate: number
): { contributions: number; withdrawals: number } {
  let contributions = 0;
  let withdrawals = 0;
  
  for (const goal of goals) {
    // Only process enabled goals
    if (!goal.enabled) continue;
    
    // For now, simple logic: if startTiming is "immediately" and year <= durationYears
    if (goal.startTiming === "immediately" && year <= goal.durationYears) {
      let adjustedAmount = calculateInflationAdjustedAmount(
        goal.amount,
        year,
        inflationRate,
        goal.inflationAdjusted
      );
      
      // Convert monthly amounts to annual amounts
      if (goal.frequency === "monthly") {
        adjustedAmount *= 12;
      }
      
      if (goal.type === "contribution") {
        contributions += adjustedAmount;
      } else if (goal.type === "fixed_withdrawal") {
        withdrawals += adjustedAmount;
      }
    }
  }
  
  return { contributions, withdrawals };
}

function calculateAccountGrowth(balance: number, returnRate: number): number {
  return balance * (returnRate / 100);
}

function calculateDividendIncome(taxableBalance: number, dividendRate: number): number {
  return taxableBalance * (dividendRate / 100);
}

function calculateCapitalGains(
  withdrawalAmount: number,
  accountBalance: number,
  costBasis: number
): number {
  if (withdrawalAmount <= 0 || accountBalance <= 0) return 0;
  
  const proportionWithdrawn = withdrawalAmount / accountBalance;
  const costBasisProportionWithdrawn = costBasis * proportionWithdrawn;
  
  // Capital gains = withdrawal amount - cost basis portion
  return Math.max(0, withdrawalAmount - costBasisProportionWithdrawn);
}

function calculateWithdrawalStrategy(
  totalWithdrawalNeeded: number,
  taxableBalance: number,
  deferredBalance: number,
  rothBalance: number,
  userAge: number,
  rmdAmount: number
): {
  taxableWithdrawal: number;
  deferredWithdrawal: number;
  rothWithdrawal: number;
} {
  let remainingNeeded = totalWithdrawalNeeded;
  let taxableWithdrawal = 0;
  let deferredWithdrawal = rmdAmount; // Start with RMD
  let rothWithdrawal = 0;
  
  remainingNeeded -= rmdAmount;
  
  if (remainingNeeded > 0) {
    // Strategy: Taxable → Tax Deferred → Tax Exempt
    
    // First, withdraw from taxable
    const availableTaxable = Math.max(0, taxableBalance - taxableWithdrawal);
    const taxableAmount = Math.min(remainingNeeded, availableTaxable);
    taxableWithdrawal += taxableAmount;
    remainingNeeded -= taxableAmount;
    
    // Then, withdraw from tax deferred (401k)
    if (remainingNeeded > 0) {
      const availableDeferred = Math.max(0, deferredBalance - deferredWithdrawal);
      const deferredAmount = Math.min(remainingNeeded, availableDeferred);
      deferredWithdrawal += deferredAmount;
      remainingNeeded -= deferredAmount;
    }
    
    // Finally, withdraw from Roth 
    // Note: Roth contributions can be withdrawn penalty-free at any age
    // Roth earnings have 59.5 restriction, but we're simplifying by allowing all withdrawals
    if (remainingNeeded > 0) {
      const availableRoth = Math.max(0, rothBalance - rothWithdrawal);
      const rothAmount = Math.min(remainingNeeded, availableRoth);
      rothWithdrawal += rothAmount;
      remainingNeeded -= rothAmount;
    }
  }
  
  return {
    taxableWithdrawal,
    deferredWithdrawal,
    rothWithdrawal,
  };
}

export function calculateFinancialPlan(
  inputs: PlanInputs,
  goals: Goal[] = []
): PlanResult {
  const taxBrackets = inputs.taxBrackets || DEFAULT_TAX_BRACKETS_2025;
  const yearlyResults: YearResult[] = [];
  
  // Initialize account balances
  let taxableBalance = inputs.taxableBalance;
  let taxableCostBasis = inputs.taxableCostBasis;
  let rothBalance = inputs.rothBalance;
  let deferredBalance = inputs.deferredBalance;
  
  for (let year = 1; year <= inputs.simulationPeriod; year++) {
    const userAge = inputs.primaryUserAge + year - 1;
    const spouseAge = inputs.spouseAge ? inputs.spouseAge + year - 1 : undefined;
    
    // Store starting balances
    const startingTaxable = taxableBalance;
    const startingRoth = rothBalance;
    const startingDeferred = deferredBalance;
    
    // Calculate growth for the year
    const growthTaxable = calculateAccountGrowth(taxableBalance, inputs.returnRate);
    const growthRoth = calculateAccountGrowth(rothBalance, inputs.returnRate);
    const growthDeferred = calculateAccountGrowth(deferredBalance, inputs.returnRate);
    
    // Apply growth
    taxableBalance += growthTaxable;
    rothBalance += growthRoth;
    deferredBalance += growthDeferred;
    
    // Calculate RMD based on prior year-end balance (before current year growth)
    const rmdResult = calculateRMD({
      accountBalance: startingDeferred, // RMD based on Dec 31 of prior year
      ownerAge: userAge,
      spouseAge,
      filingStatus: inputs.filingStatus,
    });
    const rmdAmount = rmdResult.requiredDistribution;
    
    // Calculate goal-based contributions and withdrawals
    const goalAmounts = calculateGoalAmounts(goals, year, inputs.inflationRate);
    
    // For simplicity, assume all contributions go to taxable account
    // and all withdrawals come from the withdrawal strategy
    const contributionsTaxable = goalAmounts.contributions;
    const contributionsRoth = 0;
    const contributionsDeferred = 0;
    
    taxableBalance += contributionsTaxable;
    
    // Calculate withdrawals using strategy
    const withdrawalStrategy = calculateWithdrawalStrategy(
      goalAmounts.withdrawals,
      taxableBalance,
      deferredBalance,
      rothBalance,
      userAge,
      rmdAmount
    );
    
    const withdrawalsTaxable = withdrawalStrategy.taxableWithdrawal;
    const withdrawalsRoth = withdrawalStrategy.rothWithdrawal;
    const withdrawalsDeferred = withdrawalStrategy.deferredWithdrawal;
    
    // Apply withdrawals
    taxableBalance -= withdrawalsTaxable;
    rothBalance -= withdrawalsRoth;
    deferredBalance -= withdrawalsDeferred;
    
    // Calculate dividend income on average balance during year
    // Approximate average balance as (starting + ending) / 2, but we need ending first
    // For now, use starting balance + half of growth as approximation
    const approximateAverageBalance = startingTaxable + (growthTaxable / 2);
    const dividendIncome = calculateDividendIncome(approximateAverageBalance, inputs.dividendRate);
    
    // Calculate capital gains from taxable withdrawals
    const capitalGainsRealized = calculateCapitalGains(
      withdrawalsTaxable,
      startingTaxable + growthTaxable,
      taxableCostBasis
    );
    
    // Update cost basis for taxable account
    if (startingTaxable + growthTaxable > 0) {
      const withdrawalProportion = withdrawalsTaxable / (startingTaxable + growthTaxable);
      taxableCostBasis *= (1 - withdrawalProportion);
    }
    // Add contribution to cost basis
    taxableCostBasis += contributionsTaxable;
    
    // Calculate taxes with detailed breakdown
    const ordinaryIncome = withdrawalsDeferred; // 401k withdrawals are ordinary income
    const taxResult = calculateTaxes({
      ordinaryIncome,
      capitalGains: capitalGainsRealized,
      dividends: dividendIncome,
      filingStatus: inputs.filingStatus,
      taxBrackets,
      year: year + 2024, // Convert simulation year to calendar year
    }, true, inputs.inflationRate); // Include details for modal display
    
    // Pay taxes from taxable account
    // NOTE: This creates a slight circular dependency - taxes paid affect the account balance
    // which affects next year's dividends. For more precision, could iterate to convergence.
    taxableBalance -= taxResult.totalTaxes;
    
    // Ensure balances don't go negative
    taxableBalance = Math.max(0, taxableBalance);
    rothBalance = Math.max(0, rothBalance);
    deferredBalance = Math.max(0, deferredBalance);
    taxableCostBasis = Math.max(0, Math.min(taxableCostBasis, taxableBalance));
    
    // Calculate inflation-adjusted portfolio value
    const totalPortfolioNominal = taxableBalance + rothBalance + deferredBalance;
    const inflationFactor = Math.pow(1 + inputs.inflationRate / 100, year - 1);
    const totalPortfolioReal = totalPortfolioNominal / inflationFactor;
    
    yearlyResults.push({
      year,
      userAge,
      spouseAge,
      startingTaxable,
      startingRoth,
      startingDeferred,
      growthTaxable,
      growthRoth,
      growthDeferred,
      contributionsTaxable,
      contributionsRoth,
      contributionsDeferred,
      withdrawalsTaxable,
      withdrawalsRoth,
      withdrawalsDeferred,
      rmdAmount,
      dividendIncome,
      capitalGainsRealized,
      federalIncomeTax: taxResult.federalIncomeTax,
      californiaIncomeTax: taxResult.californiaIncomeTax,
      federalCapitalGainsTax: taxResult.federalCapitalGainsTax,
      californiaCapitalGainsTax: taxResult.californiaCapitalGainsTax,
      federalDividendTax: taxResult.federalDividendTax,
      californiaDividendTax: taxResult.californiaDividendTax,
      totalTaxes: taxResult.totalTaxes,
      taxDetails: taxResult.details,
      endingTaxable: taxableBalance,
      endingRoth: rothBalance,
      endingDeferred: deferredBalance,
      totalPortfolioNominal,
      totalPortfolioReal,
    });
  }
  
  // Calculate summary
  const finalResult = yearlyResults[yearlyResults.length - 1];
  const totalTaxesPaid = yearlyResults.reduce((sum, year) => sum + year.totalTaxes, 0);
  const totalContributions = yearlyResults.reduce((sum, year) => 
    sum + year.contributionsTaxable + year.contributionsRoth + year.contributionsDeferred, 0);
  const totalWithdrawals = yearlyResults.reduce((sum, year) => 
    sum + year.withdrawalsTaxable + year.withdrawalsRoth + year.withdrawalsDeferred, 0);
  
  return {
    inputs,
    goals,
    yearlyResults,
    summary: {
      finalNominalValue: finalResult.totalPortfolioNominal,
      finalRealValue: finalResult.totalPortfolioReal,
      totalTaxesPaid,
      totalContributions,
      totalWithdrawals,
    },
  };
}