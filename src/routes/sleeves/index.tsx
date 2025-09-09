import { createFileRoute, redirect } from '@tanstack/react-router';
import { BarChart3, FileText, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AddSleeveModal } from '../../components/sleeves/add-sleeve-modal';
import { DeleteSleeveModal } from '../../components/sleeves/delete-sleeve-modal';
import { EditSleeveModal } from '../../components/sleeves/edit-sleeve-modal';
import { Button } from '../../components/ui/button';
import type { Sleeve } from '../../lib/schemas';
import { getDashboardDataServerFn } from '../../lib/server-functions';

export const Route = createFileRoute('/sleeves/')({
  component: SleevesComponent,
  loader: async () => {
    try {
      // Server function handles authentication
      const data = await getDashboardDataServerFn();
      return data;
    } catch (error) {
      // If authentication error, redirect to login
      if (error instanceof Error && error.message.includes('Authentication required')) {
        throw redirect({ to: '/login', search: { reset: '' } });
      }
      // Re-throw other errors
      throw error;
    }
  },
});

function SleevesComponent() {
  const loaderData = Route.useLoaderData();
  const sleeves = loaderData.sleeves;

  // Server-side auth check in loader handles authentication

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSleeve, setSelectedSleeve] = useState<Sleeve | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // Use data from loader for Security Details modal
  const sp500Data = loaderData.sp500Data;
  const positions = loaderData.positions;
  const transactions = loaderData.transactions;

  const handleEditSleeve = (sleeve: Sleeve) => {
    setSelectedSleeve(sleeve);
    setEditModalOpen(true);
  };

  const handleDeleteSleeve = (sleeve: Sleeve) => {
    setSelectedSleeve(sleeve);
    setDeleteModalOpen(true);
  };

  const closeModals = () => {
    setEditModalOpen(false);
    setDeleteModalOpen(false);
    setSelectedSleeve(null);
  };

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sleeves</h1>
            <p className="mt-2 text-sm text-gray-600">Manage your model sleeves</p>
          </div>
          <AddSleeveModal />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sleeves.map((sleeve) => (
          <div
            key={sleeve.id}
            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow relative"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  className="text-lg font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors text-left"
                  onClick={() => handleEditSleeve(sleeve)}
                >
                  {sleeve.name}
                </button>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteSleeve(sleeve)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Sleeve Members */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Members (by rank):</h4>
                {sleeve.members
                  ?.sort((a, b) => a.rank - b.rank)
                  .map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-medium">
                          {member.rank}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTicker(member.ticker);
                            setShowSecurityModal(true);
                          }}
                          className={`text-blue-600 hover:text-blue-800 hover:underline font-medium ${
                            !member.isActive ? 'opacity-50 line-through' : ''
                          }`}
                        >
                          {member.ticker}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {sleeves.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No sleeves found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by seeding demo data.</p>
        </div>
      )}
      {/* Edit Modal */}
      <EditSleeveModal isOpen={editModalOpen} onClose={closeModals} sleeve={selectedSleeve} />
      {/* Delete Modal */}
      <DeleteSleeveModal isOpen={deleteModalOpen} onClose={closeModals} sleeve={selectedSleeve} />
      {/* Security Details Modal */}
      {showSecurityModal &&
        selectedTicker &&
        (() => {
          // Find security details from various sources
          const sp500Stock = sp500Data?.find((s) => s.ticker === selectedTicker);
          const position = positions?.find((p) => p.ticker === selectedTicker);
          const recentTransactions = transactions
            ?.filter((t) => t.ticker === selectedTicker)
            ?.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
            ?.slice(0, 5);

          return (
            <button
              type="button"
              className="fixed inset-0 bg-gray-600/50 overflow-y-auto h-full w-full z-50 text-left"
              aria-label="Close security details"
              onClick={() => setShowSecurityModal(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowSecurityModal(false);
                }
              }}
            >
              <div
                className="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="mt-3">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">
                    {selectedTicker} - Security Details
                  </h3>

                  <div className="text-left space-y-4">
                    {/* Company Information */}
                    {sp500Stock && (
                      <div className="p-3 bg-blue-50 rounded-md">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">
                          Company Information
                        </h4>
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
                            <span className="text-blue-900 font-medium">
                              ${sp500Stock.price?.toFixed(2) || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600">Market Cap:</span>
                            <span className="text-blue-900">{sp500Stock.marketCap || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600">P/E Ratio:</span>
                            <span className="text-blue-900">
                              {sp500Stock.peRatio?.toFixed(2) || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600">Industry:</span>
                            <span className="text-blue-900">{sp500Stock.industry || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-600">Sector:</span>
                            <span className="text-blue-900">{sp500Stock.sector || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Current Position */}
                    {position && (
                      <div className="p-3 bg-green-50 rounded-md">
                        <h4 className="text-sm font-medium text-green-900 mb-2">
                          Current Position
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-green-600">Shares:</span>
                            <span className="text-green-900 font-medium">
                              {position.qty != null
                                ? position.qty.toLocaleString(undefined, {
                                    maximumFractionDigits: 3,
                                  })
                                : '0'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-600">Current Price:</span>
                            <span className="text-green-900">
                              ${position.currentPrice?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-600">Cost Basis:</span>
                            <span className="text-green-900">
                              ${position.costBasis?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-600">Market Value:</span>
                            <span className="text-green-900 font-medium">
                              ${position.marketValue?.toLocaleString() || '0'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span
                              className={`${parseFloat(position.dollarGainLoss?.replace(/[$,-]/g, '') || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {parseFloat(position.dollarGainLoss?.replace(/[$,-]/g, '') || '0') >=
                              0
                                ? 'Gain:'
                                : 'Loss:'}
                            </span>
                            <span
                              className={`font-medium ${
                                parseFloat(position.dollarGainLoss?.replace(/[$,-]/g, '') || '0') >=
                                0
                                  ? 'text-green-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {position.dollarGainLoss || '$0.00'} (
                              {position.percentGainLoss || '0.00%'})
                            </span>
                          </div>
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
                                  {(transaction.qty || 0).toLocaleString()} @ $
                                  {(transaction.price || 0).toFixed(2)}
                                </div>
                                <div className="text-xs">
                                  <span className="text-gray-900">
                                    $
                                    {(
                                      (transaction.qty || 0) * (transaction.price || 0)
                                    ).toLocaleString('en-US', {
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
                                        {Math.abs(transaction.realizedGainLoss).toLocaleString(
                                          'en-US',
                                          {
                                            minimumFractionDigits: 2,
                                          },
                                        )}{' '}
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
                      (!recentTransactions || recentTransactions.length === 0) && (
                        <div className="text-center py-4 text-gray-500">
                          No additional information available for {selectedTicker}
                        </div>
                      )}
                  </div>

                  <div className="items-center px-4 py-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowSecurityModal(false)}
                      className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </button>
          );
        })()}
    </div>
  );
}
