import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { DashboardMetrics } from '../components/dashboard/dashboard-metrics';
import { PositionsTable } from '../components/dashboard/positions-table';
import { SchwabConnectionSection } from '../components/dashboard/schwab-connection-section';
import { SecurityModal } from '../components/dashboard/security-modal';
import { SleeveModal } from '../components/dashboard/sleeve-modal';
import { TransactionsTable } from '../components/dashboard/transactions-table';
import { ExportButton } from '../components/ui/export-button';
import { getPortfolioMetrics, getPositions, getTransactions } from '../lib/api';
import { useSession } from '../lib/auth-client';
import { exportPositionsToExcel, exportTransactionsToExcel } from '../lib/excel-export';
import { getDashboardDataServerFn, getSleevesServerFn } from '../lib/server-functions';

export const Route = createFileRoute('/')({
  component: DashboardComponent,
  loader: async ({ context: _context }) => {
    try {
      // Try to load dashboard data (will fail if not authenticated)
      return await getDashboardDataServerFn();
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

function DashboardComponent() {
  const { data: session } = useSession();
  const loaderData = Route.useLoaderData();
  const [activeTab, setActiveTab] = useState<'positions' | 'transactions'>('positions');

  // Use server-loaded user data as fallback/initial data
  const userData = loaderData.user || session?.user;

  // Note: Server-side auth check in loader ensures user is authenticated
  // No client-side redirect needed

  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null);
  const [showSleeveModal, setShowSleeveModal] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  const { data: positions, isLoading: positionsLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
    initialData: loaderData.positions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: getPortfolioMetrics,
    initialData: loaderData.metrics,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: getTransactions,
    initialData: loaderData.transactions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: sleeves, isLoading: sleevesLoading } = useQuery({
    queryKey: ['sleeves'],
    queryFn: getSleevesServerFn,
    initialData: loaderData.sleeves,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isLoading = positionsLoading || metricsLoading || transactionsLoading || sleevesLoading;

  const handleTickerClick = (ticker: string) => {
    setSelectedTicker(ticker);
    setShowSecurityModal(true);
  };

  const handleSleeveClick = (sleeveId: string) => {
    setSelectedSleeve(sleeveId);
    setShowSleeveModal(true);
  };

  if (isLoading) {
    return (
      <div className="px-4 py-8">
        <div className="animate-pulse">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-8 bg-gray-300 rounded"></div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-8 bg-gray-300 rounded"></div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-8 bg-gray-300 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {userData?.name || userData?.email || 'User'}
            </h1>
            <p className="mt-2 text-sm text-gray-600">Portfolio overview</p>
          </div>
        </div>
      </div>

      {/* Schwab Connection Section - only shows when not connected */}
      <div className="mb-8">
        <SchwabConnectionSection initialCredentialsStatus={loaderData.schwabCredentialsStatus} />
      </div>

      <DashboardMetrics metrics={metrics} />

      {/* Positions and Transactions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Positions & Transactions
              </h3>
              <div className="flex space-x-2">
                {activeTab === 'positions' && positions && positions.length > 0 && (
                  <ExportButton
                    onExport={() => exportPositionsToExcel(positions)}
                    label="Export Positions"
                  />
                )}
                {activeTab === 'transactions' && transactions && transactions.length > 0 && (
                  <ExportButton
                    onExport={() => exportTransactionsToExcel(transactions)}
                    label="Export Transactions"
                  />
                )}
              </div>
            </div>
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('positions')}
                  className={`shrink-0 py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                    activeTab === 'positions'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">Positions</span>
                  <span className="sm:hidden">Positions</span>
                  <span className="ml-1">({positions?.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  className={`shrink-0 py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                    activeTab === 'transactions'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">Transactions</span>
                  <span className="sm:hidden">Txns</span>
                  <span className="ml-1">({transactions?.length || 0})</span>
                </button>
              </nav>
            </div>
          </div>

          {activeTab === 'positions' && (
            <PositionsTable
              positions={positions || []}
              onTickerClick={handleTickerClick}
              onSleeveClick={handleSleeveClick}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsTable
              transactions={transactions || []}
              onTickerClick={handleTickerClick}
              onSleeveClick={handleSleeveClick}
            />
          )}
        </div>
      </div>

      <SleeveModal
        isOpen={showSleeveModal}
        onClose={() => setShowSleeveModal(false)}
        sleeve={selectedSleeve ? sleeves?.find((s) => s.id === selectedSleeve) || null : null}
      />

      <SecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        ticker={selectedTicker}
        sp500Data={[]}
        positions={positions}
        transactions={transactions}
      />
    </div>
  );
}
