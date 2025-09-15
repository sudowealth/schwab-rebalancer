import { useMemo, useState } from 'react';
import type { YearResult } from '~/lib/financial-planning-engine';
import { type TaxCalculationDetail, TaxDetailModal } from './TaxDetailModal';

interface ResultsTableProps {
  results: YearResult[];
}

function formatCurrency(amount: number): string {
  // For large amounts, use abbreviated format for better readability
  if (Math.abs(amount) >= 1000000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ResultsTable({ results }: ResultsTableProps) {
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [selectedTax, setSelectedTax] = useState<{
    type:
      | 'federalIncome'
      | 'californiaIncome'
      | 'federalCapitalGains'
      | 'californiaCapitalGains'
      | 'federalDividend'
      | 'californiaDividend'
      | null;
    year: number;
    amount: number;
    calculation: TaxCalculationDetail | null;
  }>({ type: null, year: 0, amount: 0, calculation: null });

  const handleTaxClick = (
    taxType:
      | 'federalIncome'
      | 'californiaIncome'
      | 'federalCapitalGains'
      | 'californiaCapitalGains'
      | 'federalDividend'
      | 'californiaDividend',
    yearIndex: number,
  ) => {
    const yearData = results[yearIndex];
    if (!yearData) return;
    const taxDetails = yearData.taxDetails;
    if (!taxDetails) return;

    let calculation: TaxCalculationDetail | null = null;
    let amount = 0;

    switch (taxType) {
      case 'federalIncome':
        calculation = taxDetails.federalIncome;
        amount = yearData.federalIncomeTax;
        break;
      case 'californiaIncome':
        calculation = taxDetails.californiaIncome;
        amount = yearData.californiaIncomeTax;
        break;
      case 'federalCapitalGains':
        calculation = taxDetails.federalCapitalGains;
        amount = yearData.federalCapitalGainsTax;
        break;
      case 'californiaCapitalGains':
        calculation = taxDetails.californiaCapitalGains;
        amount = yearData.californiaCapitalGainsTax;
        break;
      case 'federalDividend':
        calculation = taxDetails.federalDividend;
        amount = yearData.federalDividendTax;
        break;
      case 'californiaDividend':
        calculation = taxDetails.californiaDividend;
        amount = yearData.californiaDividendTax;
        break;
    }

    setSelectedTax({
      type: taxType,
      year: yearData.year,
      amount,
      calculation,
    });
    setTaxModalOpen(true);
  };

  const tableData = useMemo(() => {
    return results.map((year) => ({
      year: year.year,
      age: year.userAge,
      federalIncomeTax: year.federalIncomeTax,
      californiaIncomeTax: year.californiaIncomeTax,
      federalCapitalGainsTax: year.federalCapitalGainsTax,
      californiaCapitalGainsTax: year.californiaCapitalGainsTax,
      federalDividendTax: year.federalDividendTax,
      californiaDividendTax: year.californiaDividendTax,
      taxDetails: year.taxDetails,
      startingBalances: {
        taxable: year.startingTaxable,
        roth: year.startingRoth,
        deferred: year.startingDeferred,
        total: year.startingTaxable + year.startingRoth + year.startingDeferred,
      },
      growth: {
        taxable: year.growthTaxable,
        roth: year.growthRoth,
        deferred: year.growthDeferred,
        total: year.growthTaxable + year.growthRoth + year.growthDeferred,
      },
      contributions: {
        taxable: year.contributionsTaxable,
        roth: year.contributionsRoth,
        deferred: year.contributionsDeferred,
        total: year.contributionsTaxable + year.contributionsRoth + year.contributionsDeferred,
      },
      withdrawals: {
        taxable: year.withdrawalsTaxable,
        roth: year.withdrawalsRoth,
        deferred: year.withdrawalsDeferred,
        total: year.withdrawalsTaxable + year.withdrawalsRoth + year.withdrawalsDeferred,
      },
      taxes: {
        federalIncome: year.federalIncomeTax,
        californiaIncome: year.californiaIncomeTax,
        federalCapitalGains: year.federalCapitalGainsTax,
        californiaCapitalGains: year.californiaCapitalGainsTax,
        federalDividend: year.federalDividendTax,
        californiaDividend: year.californiaDividendTax,
        total: year.totalTaxes,
      },
      endingBalances: {
        taxable: year.endingTaxable,
        roth: year.endingRoth,
        deferred: year.endingDeferred,
        total: year.totalPortfolioNominal,
        totalReal: year.totalPortfolioReal,
      },
      rmdAmount: year.rmdAmount,
      dividendIncome: year.dividendIncome,
      capitalGains: year.capitalGainsRealized,
    }));
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No results to display. Adjust your inputs to see the financial projection.
      </div>
    );
  }

  return (
    <div className="relative w-full border border-gray-200 rounded-lg overflow-hidden">
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full border-collapse min-w-[2000px]">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold bg-gray-50">
                Year
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold bg-gray-50">
                Age
              </th>

              {/* Starting Balances */}
              <th
                className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold bg-blue-50"
                colSpan={4}
              >
                Starting Balances
              </th>

              {/* Growth */}
              <th
                className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold bg-green-50"
                colSpan={4}
              >
                Growth
              </th>

              {/* Contributions */}
              <th
                className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold bg-emerald-50"
                colSpan={4}
              >
                Contributions
              </th>

              {/* Withdrawals */}
              <th
                className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold bg-amber-50"
                colSpan={4}
              >
                Withdrawals
              </th>

              {/* Income Items */}
              <th
                className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold bg-purple-50"
                colSpan={3}
              >
                Income
              </th>

              {/* Taxes */}
              <th
                className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold bg-red-50"
                colSpan={5}
              >
                Taxes Paid
              </th>

              {/* Ending Balances */}
              <th
                className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold bg-gray-50"
                colSpan={5}
              >
                Ending Balances
              </th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-1 py-1 bg-gray-50" />
              <th className="border border-gray-300 px-1 py-1 bg-gray-50" />

              {/* Starting Balances Sub-headers */}
              <th className="border border-gray-300 px-2 py-1 text-xs bg-blue-50">Taxable</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-blue-50">Roth</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-blue-50">401k</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-blue-50">Total</th>

              {/* Growth Sub-headers */}
              <th className="border border-gray-300 px-2 py-1 text-xs bg-green-50">Taxable</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-green-50">Roth</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-green-50">401k</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-green-50">Total</th>

              {/* Contributions Sub-headers */}
              <th className="border border-gray-300 px-2 py-1 text-xs bg-emerald-50">Taxable</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-emerald-50">Roth</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-emerald-50">401k</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-emerald-50">Total</th>

              {/* Withdrawals Sub-headers */}
              <th className="border border-gray-300 px-2 py-1 text-xs bg-amber-50">Taxable</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-amber-50">Roth</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-amber-50">401k/RMD</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-amber-50">Total</th>

              {/* Income Sub-headers */}
              <th className="border border-gray-300 px-2 py-1 text-xs bg-purple-50">Dividends</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-purple-50">Cap Gains</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-purple-50">RMD</th>

              {/* Tax Sub-headers */}
              <th className="border border-gray-300 px-2 py-1 text-xs bg-red-50">Fed Income</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-red-50">California</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-red-50">Fed Cap Gains</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-red-50">Fed Dividend</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-semibold bg-red-50">
                Total
              </th>

              {/* Ending Balances Sub-headers */}
              <th className="border border-gray-300 px-2 py-1 text-xs bg-gray-50">Taxable</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-gray-50">Roth</th>
              <th className="border border-gray-300 px-2 py-1 text-xs bg-gray-50">401k</th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-semibold bg-gray-50">
                Total (Nominal)
              </th>
              <th className="border border-gray-300 px-2 py-1 text-xs font-semibold bg-gray-50">
                Total (Real)
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={row.year} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-300 px-3 py-2 text-sm font-medium">{row.year}</td>
                <td className="border border-gray-300 px-3 py-2 text-sm">{row.age}</td>

                {/* Starting Balances */}
                <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                  {formatCurrency(row.startingBalances.taxable)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                  {formatCurrency(row.startingBalances.roth)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                  {formatCurrency(row.startingBalances.deferred)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right font-medium">
                  {formatCurrency(row.startingBalances.total)}
                </td>

                {/* Growth */}
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-green-700">
                  {formatCurrency(row.growth.taxable)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-green-700">
                  {formatCurrency(row.growth.roth)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-green-700">
                  {formatCurrency(row.growth.deferred)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right font-medium text-green-700">
                  {formatCurrency(row.growth.total)}
                </td>

                {/* Contributions */}
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-emerald-700">
                  {formatCurrency(row.contributions.taxable)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-emerald-700">
                  {formatCurrency(row.contributions.roth)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-emerald-700">
                  {formatCurrency(row.contributions.deferred)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right font-medium text-emerald-700">
                  {formatCurrency(row.contributions.total)}
                </td>

                {/* Withdrawals */}
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-amber-700">
                  {formatCurrency(row.withdrawals.taxable)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-amber-700">
                  {formatCurrency(row.withdrawals.roth)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-amber-700">
                  {formatCurrency(row.withdrawals.deferred)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right font-medium text-amber-700">
                  {formatCurrency(row.withdrawals.total)}
                </td>

                {/* Income */}
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-purple-700">
                  {formatCurrency(row.dividendIncome)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-purple-700">
                  {formatCurrency(row.capitalGains)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-purple-700">
                  {formatCurrency(row.rmdAmount)}
                </td>

                {/* Taxes */}
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-red-700">
                  <button
                    type="button"
                    className="w-full text-right hover:bg-red-50"
                    onClick={() => handleTaxClick('federalIncome', index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTaxClick('federalIncome', index);
                      }
                    }}
                    title="Click to see calculation details"
                  >
                    {formatCurrency(row.taxes.federalIncome)}
                  </button>
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-red-700">
                  <button
                    type="button"
                    className="w-full text-right hover:bg-red-50"
                    onClick={() => handleTaxClick('californiaIncome', index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTaxClick('californiaIncome', index);
                      }
                    }}
                    title="Click to see calculation details"
                  >
                    {formatCurrency(row.taxes.californiaIncome)}
                  </button>
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-red-700">
                  <button
                    type="button"
                    className="w-full text-right hover:bg-red-50"
                    onClick={() => handleTaxClick('federalCapitalGains', index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTaxClick('federalCapitalGains', index);
                      }
                    }}
                    title="Click to see calculation details"
                  >
                    {formatCurrency(row.taxes.federalCapitalGains)}
                  </button>
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right text-red-700">
                  <button
                    type="button"
                    className="w-full text-right hover:bg-red-50"
                    onClick={() => handleTaxClick('federalDividend', index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTaxClick('federalDividend', index);
                      }
                    }}
                    title="Click to see calculation details"
                  >
                    {formatCurrency(row.taxes.federalDividend)}
                  </button>
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right font-medium text-red-700">
                  {formatCurrency(row.taxes.total)}
                </td>

                {/* Ending Balances */}
                <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                  {formatCurrency(row.endingBalances.taxable)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                  {formatCurrency(row.endingBalances.roth)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right">
                  {formatCurrency(row.endingBalances.deferred)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right font-bold">
                  {formatCurrency(row.endingBalances.total)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-xs text-right font-bold text-blue-700">
                  {formatCurrency(row.endingBalances.totalReal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax Detail Modal */}
      <TaxDetailModal
        open={taxModalOpen}
        onOpenChange={setTaxModalOpen}
        taxType={selectedTax.type}
        year={selectedTax.year}
        amount={selectedTax.amount}
        calculation={selectedTax.calculation}
      />
    </div>
  );
}
