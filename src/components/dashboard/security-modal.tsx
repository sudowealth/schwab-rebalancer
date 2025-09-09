import { BarChart3 } from 'lucide-react';
import type { Position, SP500Stock, Trade, Transaction } from '../../lib/schemas';
import { formatQuantity } from '../../lib/utils';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string | null;
  sp500Data?: SP500Stock[];
  positions?: Position[];
  transactions?: Transaction[];
  proposedTrades?: Trade[];
}

export function SecurityModal({
  isOpen,
  onClose,
  ticker,
  sp500Data,
  positions,
  transactions,
  proposedTrades,
}: SecurityModalProps) {
  if (!isOpen || !ticker) return null;

  const sp500Stock = sp500Data?.find((s) => s.ticker === ticker);
  const position = positions?.find((p) => p.ticker === ticker);
  const recentTransactions = transactions
    ?.filter((t) => t.ticker === ticker)
    ?.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
    ?.slice(0, 5);
  const proposedTrade = proposedTrades?.find((t) => t.ticker === ticker);

  return (
    <button
      type="button"
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 text-left"
      aria-label="Close security details"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div
        className="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white"
        role="dialog"
        aria-modal="true"
        aria-label="Security details"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="mt-3">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">
            {ticker} - Security Details
          </h3>

          <div className="text-left space-y-4">
            {/* Company Information */}
            {sp500Stock && (
              <div className="p-3 bg-blue-50 rounded-md">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Company Information</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">Company:</span>
                    <span className="text-blue-900 font-medium">
                      <a
                        href={`https://finance.yahoo.com/quote/${sp500Stock.ticker}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        {sp500Stock.name}
                      </a>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Price:</span>
                    <span className="text-blue-900">${sp500Stock.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Market Cap:</span>
                    <span className="text-blue-900">{sp500Stock.marketCap}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">P/E Ratio:</span>
                    <span className="text-blue-900">
                      {sp500Stock.peRatio ? sp500Stock.peRatio.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Industry:</span>
                    <span className="text-blue-900">{sp500Stock.industry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Sector:</span>
                    <span className="text-blue-900">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {sp500Stock.sector}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Current Position */}
            {position && (
              <div className="p-3 bg-green-50 rounded-md">
                <h4 className="text-sm font-medium text-green-900 mb-2">Current Position</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-600">Sleeve:</span>
                    <span className="text-green-900 font-medium">{position.sleeveName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Quantity:</span>
                    <span className="text-green-900">{formatQuantity(position.qty)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Current Price:</span>
                    <span className="text-green-900">${position.currentPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Cost Basis:</span>
                    <span className="text-green-900">${position.costBasis.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Market Value:</span>
                    <span className="text-green-900 font-medium">{position.marketValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Gain/Loss:</span>
                    <span
                      className={`font-medium ${
                        position.dollarGainLoss.startsWith('-') ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {position.dollarGainLoss} ({position.percentGainLoss})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-600">Days Held:</span>
                    <span className="text-green-900">{position.daysHeld}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Proposed Trade */}
            {proposedTrade && (
              <div
                className={`p-3 rounded-md ${
                  proposedTrade.canExecute ? 'bg-yellow-50' : 'bg-red-50'
                }`}
              >
                <h4
                  className={`text-sm font-medium mb-2 ${
                    proposedTrade.canExecute ? 'text-yellow-900' : 'text-red-900'
                  }`}
                >
                  Proposed Trade
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className={proposedTrade.canExecute ? 'text-yellow-600' : 'text-red-600'}>
                      Type:
                    </span>
                    <span
                      className={`font-medium ${
                        proposedTrade.canExecute ? 'text-yellow-900' : 'text-red-900'
                      }`}
                    >
                      {proposedTrade.type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={proposedTrade.canExecute ? 'text-yellow-600' : 'text-red-600'}>
                      Quantity:
                    </span>
                    <span className={proposedTrade.canExecute ? 'text-yellow-900' : 'text-red-900'}>
                      {proposedTrade.qty.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={proposedTrade.canExecute ? 'text-yellow-600' : 'text-red-600'}>
                      Est. Value:
                    </span>
                    <span className={proposedTrade.canExecute ? 'text-yellow-900' : 'text-red-900'}>
                      $
                      {proposedTrade.estimatedValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={proposedTrade.canExecute ? 'text-yellow-600' : 'text-red-600'}>
                      Reason:
                    </span>
                    <span className={proposedTrade.canExecute ? 'text-yellow-900' : 'text-red-900'}>
                      {proposedTrade.reason}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={proposedTrade.canExecute ? 'text-yellow-600' : 'text-red-600'}>
                      Status:
                    </span>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        proposedTrade.canExecute
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {proposedTrade.canExecute ? 'Ready' : 'Blocked'}
                    </span>
                  </div>
                  {!proposedTrade.canExecute && proposedTrade.blockingReason && (
                    <div className="flex justify-between">
                      <span className="text-red-600">Reason:</span>
                      <span className="text-red-900 text-xs">{proposedTrade.blockingReason}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            {recentTransactions && recentTransactions.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Recent Transactions (Last 5)
                </h4>
                <div className="space-y-2">
                  {recentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex justify-between items-center text-xs p-2 bg-white rounded border"
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                            transaction.type === 'SELL'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {transaction.type}
                        </span>
                        <span className="text-gray-600">
                          {new Date(transaction.executedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatQuantity(transaction.qty)} @ ${transaction.price.toFixed(2)}
                        </div>
                        <div className="text-xs">
                          <span className="text-gray-900">
                            $
                            {(transaction.qty * transaction.price).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          {transaction.type === 'SELL' &&
                            transaction.realizedGainLoss !== undefined &&
                            transaction.realizedGainLoss !== 0 && (
                              <span
                                className={`ml-2 ${
                                  transaction.realizedGainLoss >= 0
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}
                              >
                                ({transaction.realizedGainLoss >= 0 ? '' : '-'}$
                                {Math.abs(transaction.realizedGainLoss).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                {transaction.isLongTerm === true ? 'LT' : 'ST'})
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No data message */}
            {!sp500Stock &&
              !position &&
              !proposedTrade &&
              (!recentTransactions || recentTransactions.length === 0) && (
                <div className="p-3 bg-gray-50 rounded-md text-center">
                  <p className="text-sm text-gray-500">
                    No detailed information available for this security.
                  </p>
                </div>
              )}
          </div>

          <div className="items-center px-4 py-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}
