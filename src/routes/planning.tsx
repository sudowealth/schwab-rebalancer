import { createFileRoute } from '@tanstack/react-router';
import { Settings, Trash2 } from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';
import { ResultsTable } from '~/components/planning/ResultsTable';
import { getDefaultTaxBrackets, TaxBracketModal } from '~/components/planning/TaxBracketModal';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useDebounce } from '~/hooks/useDebounce';
import {
  calculateFinancialPlan,
  type Goal,
  type PlanInputs,
} from '~/lib/financial-planning-engine';
import type { TaxBrackets } from '~/lib/tax-calculations';

export const Route = createFileRoute('/planning')({
  component: PlanningPage,
});

function PlanningPage() {
  const uid = useId();
  const primaryAgeId = `${uid}-primaryAge`;
  const spouseAgeId = `${uid}-spouseAge`;
  const taxableBalanceId = `${uid}-taxableBalance`;
  const taxableCostBasisId = `${uid}-taxableCostBasis`;
  const rothBalanceId = `${uid}-rothBalance`;
  const deferredBalanceId = `${uid}-deferredBalance`;
  const simulationPeriodId = `${uid}-simulationPeriod`;
  const returnRateId = `${uid}-returnRate`;
  const inflationRateId = `${uid}-inflationRate`;
  const dividendRateId = `${uid}-dividendRate`;
  const [inputs, setInputs] = useState<PlanInputs>({
    filingStatus: 'married_filing_jointly',
    primaryUserAge: 37,
    spouseAge: 37,
    simulationPeriod: 50,
    returnRate: 8.0,
    inflationRate: 2.0,
    dividendRate: 2.0,
    taxableBalance: 3400000,
    taxableCostBasis: 3400000,
    rothBalance: 150000,
    deferredBalance: 600000,
  });

  const [goals, setGoals] = useState<Goal[]>(() => [
    {
      id: `goal-default-${Date.now()}`,
      purpose: 'Monthly withdrawal for living expenses',
      type: 'fixed_withdrawal',
      amount: 15000,
      inflationAdjusted: true,
      startTiming: 'immediately',
      durationYears: 50,
      frequency: 'monthly',
      repeatPattern: 'none',
      occurrences: 1,
      enabled: true,
    },
    {
      id: `goal-default-${Date.now() + 1}`,
      purpose: 'Mortgage',
      type: 'fixed_withdrawal',
      amount: 4750,
      inflationAdjusted: false,
      startTiming: 'immediately',
      durationYears: 25,
      frequency: 'monthly',
      repeatPattern: 'none',
      occurrences: 1,
      enabled: true,
    },
  ]);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxBrackets, setTaxBrackets] = useState(() => getDefaultTaxBrackets());
  const [confirmDelete, setConfirmDelete] = useState<{
    show: boolean;
    goalId: string | null;
    goalPurpose: string;
  }>({ show: false, goalId: null, goalPurpose: '' });

  const handleInputChange = useCallback(
    (field: keyof PlanInputs, value: string | number | boolean) => {
      setInputs((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const addGoal = () => {
    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      purpose: '',
      type: 'contribution',
      amount: 10000,
      inflationAdjusted: true,
      startTiming: 'immediately',
      durationYears: 1,
      frequency: 'annually',
      repeatPattern: 'none',
      occurrences: 1,
      enabled: true,
    };
    setGoals((prev) => [...prev, newGoal]);
  };

  const removeGoal = (id: string) => {
    setGoals((prev) => prev.filter((goal) => goal.id !== id));
    setConfirmDelete({ show: false, goalId: null, goalPurpose: '' });
  };

  const handleDeleteClick = (goal: Goal) => {
    setConfirmDelete({
      show: true,
      goalId: goal.id,
      goalPurpose: goal.purpose || 'Unnamed goal',
    });
  };

  const updateGoal = useCallback(
    (id: string, field: keyof Goal, value: string | number | boolean) => {
      setGoals((prev) => prev.map((goal) => (goal.id === id ? { ...goal, [field]: value } : goal)));
    },
    [],
  );

  const handleTaxBracketsChange = useCallback((brackets: TaxBrackets) => {
    setTaxBrackets(brackets);
  }, []);

  // Debounce inputs to prevent excessive recalculations while typing
  const debouncedInputs = useDebounce(inputs, 500); // 500ms delay
  const debouncedGoals = useDebounce(goals, 500);

  // Calculate the financial plan with debounced values and tax brackets
  const planResult = useMemo(() => {
    return calculateFinancialPlan({ ...debouncedInputs, taxBrackets }, debouncedGoals);
  }, [debouncedInputs, debouncedGoals, taxBrackets]);

  const endingNominal = planResult.summary.finalNominalValue;
  const endingReal = planResult.summary.finalRealValue;

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Planning</h1>
            <p className="mt-2 text-sm text-gray-600">
              Comprehensive financial planning simulation with real-time calculations
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowTaxModal(true)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Configure Tax Brackets
          </Button>
        </div>
      </div>

      {/* Input Parameters Accordion */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="input-parameters" className="border rounded-lg bg-white">
          <AccordionTrigger className="text-lg font-semibold px-4 py-3 hover:bg-gray-50 bg-white rounded-lg">
            Input Parameters
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* User Information */}
              <Card>
                <CardHeader>
                  <CardTitle>User Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="filingStatus">Filing Status</Label>
                    <Select
                      value={inputs.filingStatus}
                      onValueChange={(value) => handleInputChange('filingStatus', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married_filing_jointly">
                          Married Filing Jointly
                        </SelectItem>
                        <SelectItem value="head_of_household">Head of Household</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={primaryAgeId}>Primary User Age</Label>
                    <Input
                      id={primaryAgeId}
                      type="number"
                      value={inputs.primaryUserAge}
                      onChange={(e) =>
                        handleInputChange('primaryUserAge', Number.parseInt(e.target.value, 10))
                      }
                    />
                  </div>
                  {inputs.filingStatus === 'married_filing_jointly' && (
                    <div>
                      <Label htmlFor={spouseAgeId}>Spouse Age</Label>
                      <Input
                        id={spouseAgeId}
                        type="number"
                        value={inputs.spouseAge || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value) {
                            handleInputChange('spouseAge', Number.parseInt(value, 10));
                          } else {
                            setInputs((prev) => ({ ...prev, spouseAge: undefined }));
                          }
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Account Balances */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Balances</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor={taxableBalanceId}>Taxable Account</Label>
                    <Input
                      id={taxableBalanceId}
                      type="number"
                      value={inputs.taxableBalance}
                      onChange={(e) =>
                        handleInputChange('taxableBalance', Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={taxableCostBasisId}>Taxable Cost Basis</Label>
                    <Input
                      id={taxableCostBasisId}
                      type="number"
                      value={inputs.taxableCostBasis}
                      onChange={(e) =>
                        handleInputChange('taxableCostBasis', Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={rothBalanceId}>Tax Exempt (Roth)</Label>
                    <Input
                      id={rothBalanceId}
                      type="number"
                      value={inputs.rothBalance}
                      onChange={(e) =>
                        handleInputChange('rothBalance', Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={deferredBalanceId}>Tax Deferred (401k)</Label>
                    <Input
                      id={deferredBalanceId}
                      type="number"
                      value={inputs.deferredBalance}
                      onChange={(e) =>
                        handleInputChange('deferredBalance', Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Investment Parameters */}
              <Card>
                <CardHeader>
                  <CardTitle>Investment Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor={simulationPeriodId}>Simulation Period (years)</Label>
                    <Input
                      id={simulationPeriodId}
                      type="number"
                      value={inputs.simulationPeriod}
                      onChange={(e) =>
                        handleInputChange('simulationPeriod', Number.parseInt(e.target.value, 10))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={returnRateId}>Return Rate (%)</Label>
                    <Input
                      id={returnRateId}
                      type="number"
                      step="0.1"
                      value={inputs.returnRate}
                      onChange={(e) =>
                        handleInputChange('returnRate', Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={inflationRateId}>Inflation Rate (%)</Label>
                    <Input
                      id={inflationRateId}
                      type="number"
                      step="0.1"
                      value={inputs.inflationRate}
                      onChange={(e) =>
                        handleInputChange('inflationRate', Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={dividendRateId}>Expected Dividend Rate (%)</Label>
                    <Input
                      id={dividendRateId}
                      type="number"
                      step="0.1"
                      value={inputs.dividendRate}
                      onChange={(e) =>
                        handleInputChange('dividendRate', Number.parseFloat(e.target.value))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Goals System - Full Width Below */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Goals & Contributions
              <Button onClick={addGoal} size="sm">
                Add Goal
              </Button>
            </CardTitle>
            <CardDescription>Manage contributions and withdrawals over time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No goals configured. Click "Add Goal" to get started.
              </p>
            ) : (
              goals.map((goal) => (
                <div
                  key={goal.id}
                  className={`p-3 border rounded-lg ${!goal.enabled ? 'opacity-50 bg-gray-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-6">
                      <Checkbox
                        id={`enabled-${goal.id}`}
                        checked={goal.enabled}
                        onCheckedChange={(checked) => updateGoal(goal.id, 'enabled', checked)}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 items-end">
                        <div>
                          <Label htmlFor={`purpose-${goal.id}`} className="text-sm">
                            Name
                          </Label>
                          <Input
                            id={`purpose-${goal.id}`}
                            placeholder="e.g., Living expenses"
                            value={goal.purpose}
                            onChange={(e) => updateGoal(goal.id, 'purpose', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`type-${goal.id}`} className="text-sm">
                            Type
                          </Label>
                          <Select
                            value={goal.type}
                            onValueChange={(value) => updateGoal(goal.id, 'type', value)}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contribution">Contribution</SelectItem>
                              <SelectItem value="fixed_withdrawal">Fixed Withdrawal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`amount-${goal.id}`} className="text-sm">
                            Amount ($)
                          </Label>
                          <Input
                            id={`amount-${goal.id}`}
                            type="number"
                            value={goal.amount}
                            onChange={(e) =>
                              updateGoal(goal.id, 'amount', Number.parseFloat(e.target.value))
                            }
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Adjust for inflation</Label>
                          <div className="flex items-center h-9">
                            <Checkbox
                              id={`inflation-${goal.id}`}
                              checked={goal.inflationAdjusted}
                              onCheckedChange={(checked) =>
                                updateGoal(goal.id, 'inflationAdjusted', checked)
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`duration-${goal.id}`} className="text-sm">
                            Duration (years)
                          </Label>
                          <Input
                            id={`duration-${goal.id}`}
                            type="number"
                            value={goal.durationYears}
                            onChange={(e) =>
                              updateGoal(
                                goal.id,
                                'durationYears',
                                Number.parseInt(e.target.value, 10),
                              )
                            }
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`frequency-${goal.id}`} className="text-sm">
                            Frequency
                          </Label>
                          <Select
                            value={goal.frequency}
                            onValueChange={(value) => updateGoal(goal.id, 'frequency', value)}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="annually">Annually</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="pt-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(goal)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ending Value (Nominal)</CardTitle>
            <CardDescription>Total portfolio value at end of simulation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              ${endingNominal.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ending Value (Real)</CardTitle>
            <CardDescription>Inflation-adjusted to today's equivalent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">${endingReal.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Year-by-Year Simulation Results</CardTitle>
          <CardDescription>
            Detailed breakdown showing portfolio evolution over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResultsTable results={planResult.yearlyResults} />
        </CardContent>
      </Card>

      {/* Tax Bracket Configuration Modal */}
      <TaxBracketModal
        open={showTaxModal}
        onOpenChange={setShowTaxModal}
        onBracketsChange={handleTaxBracketsChange}
      />

      {/* Goal Deletion Confirmation Modal */}
      <Dialog
        open={confirmDelete.show}
        onOpenChange={(open) => setConfirmDelete({ ...confirmDelete, show: open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Goal</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the goal "{confirmDelete.goalPurpose}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete({ show: false, goalId: null, goalPurpose: '' })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete.goalId && removeGoal(confirmDelete.goalId)}
            >
              Remove Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
