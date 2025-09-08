import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { TaxCalculationDetail } from "~/lib/tax-calculations";

export type { TaxCalculationDetail };

// Extended interface for calculation inputs that may have additional properties
interface ExtendedTaxCalculationInputs {
  ordinaryIncome: number;
  capitalGains: number;
  dividends: number;
  filingStatus: "single" | "married_filing_jointly" | "head_of_household";
  isShowingFullCalculation?: boolean;
  combinedQualifiedIncome?: number;
  combinedTotalTax?: number;
  componentShare?: number;
}

// Extended tax calculation detail with additional input properties
interface ExtendedTaxCalculationDetail extends TaxCalculationDetail {
  inputs: ExtendedTaxCalculationInputs;
}

interface TaxDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxType:
    | "federalIncome"
    | "californiaIncome"
    | "federalCapitalGains"
    | "californiaCapitalGains"
    | "federalDividend"
    | "californiaDividend"
    | null;
  year: number;
  amount: number;
  calculation: ExtendedTaxCalculationDetail | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

export function TaxDetailModal({
  open,
  onOpenChange,
  taxType,
  year,
  calculation,
}: TaxDetailModalProps) {
  if (!taxType || !calculation) {
    return null;
  }

  const taxTypeLabels = {
    federalIncome: "Federal Income Tax",
    californiaIncome: "California Income Tax",
    federalCapitalGains: "Federal Capital Gains Tax",
    californiaCapitalGains: "California Capital Gains Tax",
    federalDividend: "Federal Dividend Tax",
    californiaDividend: "California Dividend Tax",
  };

  const taxTypeDescriptions = {
    federalIncome: "Tax on ordinary income (401k withdrawals, wages, interest)",
    californiaIncome: "California state tax on all income types",
    federalCapitalGains:
      "Federal tax on capital gains from taxable account withdrawals",
    californiaCapitalGains:
      "California tax on capital gains (taxed as ordinary income)",
    federalDividend: "Federal tax on qualified dividends (preferential rates)",
    californiaDividend:
      "California tax on dividends (taxed as ordinary income)",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {taxTypeLabels[taxType]} - Year {year}
          </DialogTitle>
          <DialogDescription>{taxTypeDescriptions[taxType]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Tax Summary</CardTitle>
              {calculation.inputs.isShowingFullCalculation && (
                <CardDescription>
                  IRS calculation that determines this component's tax
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <div className="text-sm text-gray-600">
                  {calculation.inputs.isShowingFullCalculation
                    ? "Total Gross Income"
                    : "Gross Income"}
                </div>
                <div className="text-lg font-semibold">
                  {formatCurrency(calculation.income)}
                </div>
                {calculation.inputs.isShowingFullCalculation && (
                  <div className="text-xs text-gray-500">
                    {formatCurrency(calculation.inputs.componentShare ?? 0)} from
                    this component
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-600">Standard Deduction</div>
                <div className="text-lg font-semibold text-blue-600">
                  {formatCurrency(calculation.standardDeduction)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Taxable Income</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(calculation.taxableIncome)}
                </div>
                {calculation.inputs.isShowingFullCalculation && (
                  <div className="text-xs text-gray-500">
                    Used for bracket determination
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-600">
                  {calculation.inputs.isShowingFullCalculation
                    ? "Component Tax"
                    : "Total Tax"}
                </div>
                <div className="text-lg font-semibold text-red-600">
                  {formatCurrency(calculation.totalTax)}
                </div>
                {calculation.inputs.isShowingFullCalculation && (
                  <div className="text-xs text-gray-500">
                    of {formatCurrency(calculation.inputs.combinedTotalTax || 0)}{" "}
                    total
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-600">Effective Rate</div>
                <div className="text-lg font-semibold">
                  {formatPercentage(calculation.effectiveRate)}
                </div>
                {calculation.inputs.isShowingFullCalculation && (
                  <div className="text-xs text-gray-500">On this component</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Input Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Income Sources</CardTitle>
              <CardDescription>
                How this income was categorized for tax calculation
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Ordinary Income</div>
                <div className="text-base">
                  {formatCurrency(calculation.inputs.ordinaryIncome)}
                </div>
                <div className="text-xs text-gray-500">
                  401k withdrawals, wages, interest
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Capital Gains</div>
                <div className="text-base">
                  {formatCurrency(calculation.inputs.capitalGains)}
                </div>
                <div className="text-xs text-gray-500">
                  Realized gains from taxable account
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Dividends</div>
                <div className="text-base">
                  {formatCurrency(calculation.inputs.dividends)}
                </div>
                <div className="text-xs text-gray-500">
                  Dividend income from investments
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Bracket Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Tax Bracket Calculation</CardTitle>
              <CardDescription>
                {calculation.inputs.combinedQualifiedIncome
                  ? "IRS combined qualified dividends and capital gains calculation"
                  : "Progressive tax calculation by bracket"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calculation.inputs.combinedQualifiedIncome ? (
                <div className="space-y-4">
                  {/* Full Combined Calculation */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">
                      Full IRS Combined Calculation:
                    </h4>
                    <div className="space-y-2">
                      {/* We need to calculate the full brackets here */}
                      {(() => {
                        // Calculate what the full brackets would look like
                        const combinedAmount =
                          calculation.inputs.combinedQualifiedIncome;

                        // Reconstruct full brackets from proportional ones
                        const fullBrackets = calculation.brackets.map(
                          (bracket) => {
                            const componentAmount =
                              calculation.inputs.componentShare ?? 0;
                            const proportion = componentAmount / combinedAmount;
                            return {
                              ...bracket,
                              fullTaxableAmount:
                                bracket.taxableAmount / proportion,
                              fullTaxOwed: bracket.taxOwed / proportion,
                            };
                          }
                        );

                        return fullBrackets.map((bracket, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded bg-gray-50"
                          >
                            <div className="flex-1">
                              <div className="font-medium">
                                {formatCurrency(bracket.minIncome)} -{" "}
                                {bracket.maxIncome
                                  ? formatCurrency(bracket.maxIncome)
                                  : "∞"}
                              </div>
                              <div className="text-sm text-gray-600">
                                {formatPercentage(bracket.rate)} tax rate
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {formatCurrency(bracket.fullTaxableAmount)}
                              </div>
                              <div className="text-sm text-gray-600">
                                = {formatCurrency(bracket.fullTaxOwed)} tax
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                      <strong>
                        Total Combined Tax:{" "}
                        {formatCurrency(calculation.inputs.combinedTotalTax || 0)}
                      </strong>
                    </div>
                  </div>

                  {/* Allocation Breakdown */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">
                      Allocation to Components:
                    </h4>
                    <div className="space-y-2">
                      {(() => {
                        const combinedAmount =
                          calculation.inputs.combinedQualifiedIncome;
                        const capitalGains = calculation.inputs.capitalGains;
                        const dividends = calculation.inputs.dividends;
                        const totalTax = calculation.inputs.combinedTotalTax || 0;

                        const capitalGainsPercent =
                          (capitalGains / combinedAmount) * 100;
                        const dividendsPercent =
                          (dividends / combinedAmount) * 100;
                        const capitalGainsTax =
                          totalTax * (capitalGains / combinedAmount);
                        const dividendsTax =
                          totalTax * (dividends / combinedAmount);

                        return (
                          <>
                            <div className="flex items-center justify-between p-3 border rounded">
                              <div className="flex-1">
                                <div className="font-medium">Capital Gains</div>
                                <div className="text-sm text-gray-600">
                                  {formatCurrency(capitalGains)} (
                                  {capitalGainsPercent.toFixed(1)}% of total)
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-red-600">
                                  {formatCurrency(capitalGainsTax)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {capitalGainsPercent.toFixed(1)}% of total tax
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded">
                              <div className="flex-1">
                                <div className="font-medium">
                                  Qualified Dividends
                                </div>
                                <div className="text-sm text-gray-600">
                                  {formatCurrency(dividends)} (
                                  {dividendsPercent.toFixed(1)}% of total)
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-red-600">
                                  {formatCurrency(dividendsTax)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {dividendsPercent.toFixed(1)}% of total tax
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {calculation.brackets.map((bracket, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {formatCurrency(bracket.minIncome)} -{" "}
                          {bracket.maxIncome
                            ? formatCurrency(bracket.maxIncome)
                            : "∞"}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatPercentage(bracket.rate)} tax rate
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(bracket.taxableAmount)}
                        </div>
                        <div className="text-sm text-gray-600">
                          = {formatCurrency(bracket.taxOwed)} tax
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {calculation.brackets.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No tax owed - income falls below minimum taxable threshold
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
