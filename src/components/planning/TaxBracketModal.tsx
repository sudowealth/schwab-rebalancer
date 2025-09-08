import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Checkbox } from "~/components/ui/checkbox";
import { TaxBrackets, StandardDeductions } from "~/lib/tax-calculations";

interface TaxBracket {
  id: string;
  bracketType: "federal_income" | "federal_capital_gains" | "california_income";
  filingStatus: "single" | "married_filing_jointly" | "head_of_household";
  minIncome: number;
  maxIncome: number | null;
  rate: number;
  year: number;
}

interface TaxBracketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBracketsChange?: (brackets: TaxBrackets) => void;
}

const defaultFederalIncomeBrackets2025: Omit<TaxBracket, "id">[] = [
  // Single
  {
    bracketType: "federal_income",
    filingStatus: "single",
    minIncome: 0,
    maxIncome: 11925,
    rate: 10,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "single",
    minIncome: 11926,
    maxIncome: 48350,
    rate: 12,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "single",
    minIncome: 48351,
    maxIncome: 103350,
    rate: 22,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "single",
    minIncome: 103351,
    maxIncome: 197300,
    rate: 24,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "single",
    minIncome: 197301,
    maxIncome: 250525,
    rate: 32,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "single",
    minIncome: 250526,
    maxIncome: 626350,
    rate: 35,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "single",
    minIncome: 626351,
    maxIncome: null,
    rate: 37,
    year: 2025,
  },

  // Married Filing Jointly
  {
    bracketType: "federal_income",
    filingStatus: "married_filing_jointly",
    minIncome: 0,
    maxIncome: 23850,
    rate: 10,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "married_filing_jointly",
    minIncome: 23851,
    maxIncome: 96700,
    rate: 12,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "married_filing_jointly",
    minIncome: 96701,
    maxIncome: 206700,
    rate: 22,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "married_filing_jointly",
    minIncome: 206701,
    maxIncome: 394600,
    rate: 24,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "married_filing_jointly",
    minIncome: 394601,
    maxIncome: 501050,
    rate: 32,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "married_filing_jointly",
    minIncome: 501051,
    maxIncome: 751600,
    rate: 35,
    year: 2025,
  },
  {
    bracketType: "federal_income",
    filingStatus: "married_filing_jointly",
    minIncome: 751601,
    maxIncome: null,
    rate: 37,
    year: 2025,
  },
];

const defaultFederalCapitalGainsBrackets2025: Omit<TaxBracket, "id">[] = [
  // Single
  {
    bracketType: "federal_capital_gains",
    filingStatus: "single",
    minIncome: 0,
    maxIncome: 48350,
    rate: 0,
    year: 2025,
  },
  {
    bracketType: "federal_capital_gains",
    filingStatus: "single",
    minIncome: 48351,
    maxIncome: 533400,
    rate: 15,
    year: 2025,
  },
  {
    bracketType: "federal_capital_gains",
    filingStatus: "single",
    minIncome: 533401,
    maxIncome: null,
    rate: 20,
    year: 2025,
  },

  // Married Filing Jointly
  {
    bracketType: "federal_capital_gains",
    filingStatus: "married_filing_jointly",
    minIncome: 0,
    maxIncome: 96700,
    rate: 0,
    year: 2025,
  },
  {
    bracketType: "federal_capital_gains",
    filingStatus: "married_filing_jointly",
    minIncome: 96701,
    maxIncome: 600050,
    rate: 15,
    year: 2025,
  },
  {
    bracketType: "federal_capital_gains",
    filingStatus: "married_filing_jointly",
    minIncome: 600051,
    maxIncome: null,
    rate: 20,
    year: 2025,
  },
];

const defaultStandardDeductions2025: StandardDeductions = {
  federal: {
    single: 15750,
    married_filing_jointly: 31500,
    head_of_household: 23625,
  },
  california: {
    single: 5202,
    married_filing_jointly: 10404,
    head_of_household: 10404,
  },
  year: 2025,
  inflationAdjusted: true,
};

const defaultCaliforniaIncomeBrackets2025: Omit<TaxBracket, "id">[] = [
  // Single
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 0,
    maxIncome: 10756,
    rate: 1,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 10757,
    maxIncome: 25499,
    rate: 2,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 25500,
    maxIncome: 40245,
    rate: 4,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 40246,
    maxIncome: 55866,
    rate: 6,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 55867,
    maxIncome: 70606,
    rate: 8,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 70607,
    maxIncome: 360659,
    rate: 9.3,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 360660,
    maxIncome: 432787,
    rate: 10.3,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 432788,
    maxIncome: 721314,
    rate: 11.3,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 721315,
    maxIncome: 1000000,
    rate: 12.3,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "single",
    minIncome: 1000001,
    maxIncome: null,
    rate: 13.3,
    year: 2025,
  },

  // Married Filing Jointly
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 0,
    maxIncome: 21512,
    rate: 1,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 21513,
    maxIncome: 50998,
    rate: 2,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 50999,
    maxIncome: 80490,
    rate: 4,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 80491,
    maxIncome: 111732,
    rate: 6,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 111733,
    maxIncome: 141212,
    rate: 8,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 141213,
    maxIncome: 721318,
    rate: 9.3,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 721319,
    maxIncome: 865574,
    rate: 10.3,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 865575,
    maxIncome: 1442628,
    rate: 11.3,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 1442629,
    maxIncome: 2000000,
    rate: 12.3,
    year: 2025,
  },
  {
    bracketType: "california_income",
    filingStatus: "married_filing_jointly",
    minIncome: 2000001,
    maxIncome: null,
    rate: 13.3,
    year: 2025,
  },
];

// Helper function to convert tax brackets to the format expected by the financial planning engine
export function convertBracketsToTaxBrackets(
  brackets: TaxBracket[],
  standardDeductions?: StandardDeductions
): TaxBrackets {
  const result: TaxBrackets = {
    federal_income: {
      single: [],
      married_filing_jointly: [],
      head_of_household: [],
    },
    federal_capital_gains: {
      single: [],
      married_filing_jointly: [],
      head_of_household: [],
    },
    california_income: {
      single: [],
      married_filing_jointly: [],
      head_of_household: [],
    },
  };

  brackets.forEach((bracket) => {
    const bracketData = {
      minIncome: bracket.minIncome,
      maxIncome: bracket.maxIncome,
      rate: bracket.rate,
    };

    if (bracket.bracketType === "federal_income") {
      result.federal_income[bracket.filingStatus].push(bracketData);
    } else if (bracket.bracketType === "federal_capital_gains") {
      result.federal_capital_gains[bracket.filingStatus].push(bracketData);
    } else if (bracket.bracketType === "california_income") {
      result.california_income[bracket.filingStatus].push(bracketData);
    }
  });

  // Sort brackets by minIncome
  (Object.keys(result) as Array<keyof TaxBrackets>).forEach((bracketType) => {
    if (bracketType !== 'standardDeductions') {
      const bracketData = result[bracketType];
      (Object.keys(bracketData) as Array<keyof typeof bracketData>).forEach((filingStatus) => {
        bracketData[filingStatus].sort(
          (a, b) => a.minIncome - b.minIncome
        );
      });
    }
  });

  // Add standard deductions if provided
  if (standardDeductions) {
    result.standardDeductions = standardDeductions;
  }

  return result;
}

// Get default tax brackets in the format expected by the financial planning engine
export function getDefaultTaxBrackets(): TaxBrackets {
  const allBrackets = [
    ...defaultFederalIncomeBrackets2025,
    ...defaultFederalCapitalGainsBrackets2025,
    ...defaultCaliforniaIncomeBrackets2025,
  ];
  return convertBracketsToTaxBrackets(
    allBrackets as TaxBracket[],
    defaultStandardDeductions2025
  );
}

export function TaxBracketModal({
  open,
  onOpenChange,
  onBracketsChange,
}: TaxBracketModalProps) {
  const [brackets, setBrackets] = useState<TaxBracket[]>(() => {
    // Initialize with default brackets on component mount
    const allBrackets = [
      ...defaultFederalIncomeBrackets2025,
      ...defaultFederalCapitalGainsBrackets2025,
      ...defaultCaliforniaIncomeBrackets2025,
    ].map((bracket, index) => ({
      ...bracket,
      id: `bracket-${index}`,
    }));
    return allBrackets;
  });
  const [standardDeductions, setStandardDeductions] =
    useState<StandardDeductions>(defaultStandardDeductions2025);
  const [activeTab, setActiveTab] = useState("standard_deductions");

  const initializeDefaults = () => {
    const allBrackets = [
      ...defaultFederalIncomeBrackets2025,
      ...defaultFederalCapitalGainsBrackets2025,
      ...defaultCaliforniaIncomeBrackets2025,
    ].map((bracket, index) => ({
      ...bracket,
      id: `bracket-${index}`,
    }));
    setBrackets(allBrackets);
    setStandardDeductions(defaultStandardDeductions2025);
  };

  const addBracket = (bracketType: string) => {
    const newBracket: TaxBracket = {
      id: `bracket-${Date.now()}`,
      bracketType: bracketType as
        | "federal_income"
        | "federal_capital_gains"
        | "california_income",
      filingStatus: "single",
      minIncome: 0,
      maxIncome: null,
      rate: 0,
      year: 2025,
    };
    setBrackets((prev) => [...prev, newBracket]);
  };

  const updateBracket = (
    id: string,
    field: keyof TaxBracket,
    value: string | number | null
  ) => {
    setBrackets((prev) =>
      prev.map((bracket) =>
        bracket.id === id ? { ...bracket, [field]: value } : bracket
      )
    );
  };

  const removeBracket = (id: string) => {
    setBrackets((prev) => prev.filter((bracket) => bracket.id !== id));
  };

  const saveBrackets = () => {
    // Save to database (TODO)
    console.log("Saving tax brackets:", brackets);
    console.log("Saving standard deductions:", standardDeductions);

    // Notify parent component of the bracket changes
    if (onBracketsChange) {
      onBracketsChange(
        convertBracketsToTaxBrackets(brackets, standardDeductions)
      );
    }

    onOpenChange(false);
  };

  const getBracketsForTypeAndStatus = (type: string, status: string) => {
    return brackets
      .filter(
        (bracket) =>
          bracket.bracketType === type && bracket.filingStatus === status
      )
      .sort((a, b) => a.minIncome - b.minIncome);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Tax Brackets</DialogTitle>
          <DialogDescription>
            Manage federal and California tax brackets for different filing
            statuses. These rates are used for all tax calculations in the
            financial planning simulation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {brackets.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No Tax Brackets Configured</CardTitle>
                <CardDescription>
                  Load the default 2025 tax brackets to get started.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={initializeDefaults}>
                  Load Default 2025 Tax Brackets
                </Button>
              </CardContent>
            </Card>
          )}

          {brackets.length > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="standard_deductions">
                  Standard Deductions
                </TabsTrigger>
                <TabsTrigger value="federal_income">
                  Federal Income Tax
                </TabsTrigger>
                <TabsTrigger value="federal_capital_gains">
                  Federal Capital Gains
                </TabsTrigger>
                <TabsTrigger value="california_income">
                  California Income Tax
                </TabsTrigger>
              </TabsList>

              <TabsContent value="standard_deductions" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Standard Deductions</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="inflation-adjusted"
                      checked={standardDeductions.inflationAdjusted}
                      onCheckedChange={(checked) =>
                        setStandardDeductions((prev) => ({
                          ...prev,
                          inflationAdjusted: !!checked,
                        }))
                      }
                    />
                    <Label htmlFor="inflation-adjusted">
                      Adjust for inflation over time
                    </Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Federal Standard Deductions */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Federal Standard Deductions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label htmlFor="federal-single">Single</Label>
                          <Input
                            id="federal-single"
                            type="number"
                            value={standardDeductions.federal.single}
                            onChange={(e) =>
                              setStandardDeductions((prev) => ({
                                ...prev,
                                federal: {
                                  ...prev.federal,
                                  single: parseFloat(e.target.value),
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="federal-married">
                            Married Filing Jointly
                          </Label>
                          <Input
                            id="federal-married"
                            type="number"
                            value={
                              standardDeductions.federal.married_filing_jointly
                            }
                            onChange={(e) =>
                              setStandardDeductions((prev) => ({
                                ...prev,
                                federal: {
                                  ...prev.federal,
                                  married_filing_jointly: parseFloat(
                                    e.target.value
                                  ),
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="federal-head">
                            Head of Household
                          </Label>
                          <Input
                            id="federal-head"
                            type="number"
                            value={standardDeductions.federal.head_of_household}
                            onChange={(e) =>
                              setStandardDeductions((prev) => ({
                                ...prev,
                                federal: {
                                  ...prev.federal,
                                  head_of_household: parseFloat(e.target.value),
                                },
                              }))
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* California Standard Deductions */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          California Standard Deductions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label htmlFor="california-single">Single</Label>
                          <Input
                            id="california-single"
                            type="number"
                            value={standardDeductions.california.single}
                            onChange={(e) =>
                              setStandardDeductions((prev) => ({
                                ...prev,
                                california: {
                                  ...prev.california,
                                  single: parseFloat(e.target.value),
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="california-married">
                            Married Filing Jointly
                          </Label>
                          <Input
                            id="california-married"
                            type="number"
                            value={
                              standardDeductions.california
                                .married_filing_jointly
                            }
                            onChange={(e) =>
                              setStandardDeductions((prev) => ({
                                ...prev,
                                california: {
                                  ...prev.california,
                                  married_filing_jointly: parseFloat(
                                    e.target.value
                                  ),
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="california-head">
                            Head of Household
                          </Label>
                          <Input
                            id="california-head"
                            type="number"
                            value={
                              standardDeductions.california.head_of_household
                            }
                            onChange={(e) =>
                              setStandardDeductions((prev) => ({
                                ...prev,
                                california: {
                                  ...prev.california,
                                  head_of_household: parseFloat(e.target.value),
                                },
                              }))
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="federal_income" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    Federal Income Tax Brackets
                  </h3>
                  <Button
                    onClick={() => addBracket("federal_income")}
                    size="sm"
                  >
                    Add Bracket
                  </Button>
                </div>

                {["single", "married_filing_jointly", "head_of_household"].map(
                  (status) => (
                    <Card key={status}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {status
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {getBracketsForTypeAndStatus(
                            "federal_income",
                            status
                          ).map((bracket) => (
                            <div
                              key={bracket.id}
                              className="flex items-center gap-2 p-2 border rounded"
                            >
                              <Input
                                type="number"
                                placeholder="Min Income"
                                value={bracket.minIncome}
                                onChange={(e) =>
                                  updateBracket(
                                    bracket.id,
                                    "minIncome",
                                    parseFloat(e.target.value)
                                  )
                                }
                                className="w-32"
                              />
                              <span>to</span>
                              <Input
                                type="number"
                                placeholder="Max Income (empty for top bracket)"
                                value={bracket.maxIncome || ""}
                                onChange={(e) =>
                                  updateBracket(
                                    bracket.id,
                                    "maxIncome",
                                    e.target.value
                                      ? parseFloat(e.target.value)
                                      : null
                                  )
                                }
                                className="w-40"
                              />
                              <span>at</span>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Rate %"
                                value={bracket.rate}
                                onChange={(e) =>
                                  updateBracket(
                                    bracket.id,
                                    "rate",
                                    parseFloat(e.target.value)
                                  )
                                }
                                className="w-20"
                              />
                              <span>%</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeBracket(bracket.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </TabsContent>

              <TabsContent value="federal_capital_gains" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    Federal Capital Gains Tax Brackets
                  </h3>
                  <Button
                    onClick={() => addBracket("federal_capital_gains")}
                    size="sm"
                  >
                    Add Bracket
                  </Button>
                </div>

                {["single", "married_filing_jointly", "head_of_household"].map(
                  (status) => (
                    <Card key={status}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {status
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {getBracketsForTypeAndStatus(
                            "federal_capital_gains",
                            status
                          ).map((bracket) => (
                            <div
                              key={bracket.id}
                              className="flex items-center gap-2 p-2 border rounded"
                            >
                              <Input
                                type="number"
                                placeholder="Min Income"
                                value={bracket.minIncome}
                                onChange={(e) =>
                                  updateBracket(
                                    bracket.id,
                                    "minIncome",
                                    parseFloat(e.target.value)
                                  )
                                }
                                className="w-32"
                              />
                              <span>to</span>
                              <Input
                                type="number"
                                placeholder="Max Income (empty for top bracket)"
                                value={bracket.maxIncome || ""}
                                onChange={(e) =>
                                  updateBracket(
                                    bracket.id,
                                    "maxIncome",
                                    e.target.value
                                      ? parseFloat(e.target.value)
                                      : null
                                  )
                                }
                                className="w-40"
                              />
                              <span>at</span>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Rate %"
                                value={bracket.rate}
                                onChange={(e) =>
                                  updateBracket(
                                    bracket.id,
                                    "rate",
                                    parseFloat(e.target.value)
                                  )
                                }
                                className="w-20"
                              />
                              <span>%</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeBracket(bracket.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </TabsContent>

              <TabsContent value="california_income" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    California Income Tax Brackets
                  </h3>
                  <Button
                    onClick={() => addBracket("california_income")}
                    size="sm"
                  >
                    Add Bracket
                  </Button>
                </div>

                {["single", "married_filing_jointly", "head_of_household"].map(
                  (status) => (
                    <Card key={status}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {status
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {getBracketsForTypeAndStatus(
                            "california_income",
                            status
                          ).map((bracket) => (
                            <div
                              key={bracket.id}
                              className="flex items-center gap-2 p-2 border rounded"
                            >
                              <Input
                                type="number"
                                placeholder="Min Income"
                                value={bracket.minIncome}
                                onChange={(e) =>
                                  updateBracket(
                                    bracket.id,
                                    "minIncome",
                                    parseFloat(e.target.value)
                                  )
                                }
                                className="w-32"
                              />
                              <span>to</span>
                              <Input
                                type="number"
                                placeholder="Max Income (empty for top bracket)"
                                value={bracket.maxIncome || ""}
                                onChange={(e) =>
                                  updateBracket(
                                    bracket.id,
                                    "maxIncome",
                                    e.target.value
                                      ? parseFloat(e.target.value)
                                      : null
                                  )
                                }
                                className="w-40"
                              />
                              <span>at</span>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Rate %"
                                value={bracket.rate}
                                onChange={(e) =>
                                  updateBracket(
                                    bracket.id,
                                    "rate",
                                    parseFloat(e.target.value)
                                  )
                                }
                                className="w-20"
                              />
                              <span>%</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeBracket(bracket.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={saveBrackets}>Save Tax Brackets</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
