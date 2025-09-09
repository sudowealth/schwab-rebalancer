import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DashboardMetrics } from '../components/dashboard/dashboard-metrics';
import { PositionsTable } from '../components/dashboard/positions-table';
import { SecurityModal } from '../components/dashboard/security-modal';
import { SleeveModal } from '../components/dashboard/sleeve-modal';
import { SP500Table } from '../components/dashboard/sp500-table';
import { TradesTable } from '../components/dashboard/trades-table';
import { TransactionsTable } from '../components/dashboard/transactions-table';
import { Button } from '../components/ui/button';
import { ExportButton } from '../components/ui/export-button';
import { useToast } from '../components/ui/toast';
import {
  getIndices,
  getPortfolioMetrics,
  getPositions,
  getProposedTrades,
  getSnP500Data,
  getTransactions,
} from '../lib/api';
import { useSession } from '../lib/auth-client';
import {
  exportPositionsToExcel,
  exportSP500ToExcel,
  exportTradestoExcel,
  exportTransactionsToExcel,
} from '../lib/excel-export';
import {
  getDashboardDataServerFn,
  getSleevesServerFn,
  seedDemoDataServerFn,
} from '../lib/server-functions';

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
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<
    'positions' | 'transactions' | 'trades' | 'securities'
  >('trades');
  const [isClient, setIsClient] = useState(false);

  // Prevent hydration mismatches for user-specific content
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Note: Server-side auth check in loader ensures user is authenticated
  // No client-side redirect needed

  const [selectedSleeve, setSelectedSleeve] = useState<string | null>(null);
  const [showSleeveModal, setShowSleeveModal] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<string>('');

  const seedMutation = useMutation({
    mutationFn: seedDemoDataServerFn,
    onSuccess: async () => {
      // Show success toast
      showToast('Demo portfolio seeded successfully!', 'success');

      // Clear all cache and force fresh data fetch
      queryClient.clear();

      // Wait a moment for database changes to propagate
      setTimeout(() => {
        window.location.reload();
      }, 500);
    },
    onError: (error) => {
      console.error('❌ Seeding failed:', error);
      showToast('Failed to seed demo portfolio', 'error');
    },
  });

  const handleSeedData = () => {
    seedMutation.mutate(undefined);
  };

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

  const { data: securitiesData, isLoading: securitiesLoading } = useQuery({
    queryKey: ['securitiesData'],
    queryFn: getSnP500Data,
    initialData: loaderData.sp500Data,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const { data: proposedTrades, isLoading: tradesLoading } = useQuery({
    queryKey: ['proposedTrades'],
    queryFn: getProposedTrades,
    initialData: loaderData.proposedTrades,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: sleeves, isLoading: sleevesLoading } = useQuery({
    queryKey: ['sleeves'],
    queryFn: getSleevesServerFn,
    initialData: loaderData.sleeves,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: indices, isLoading: indicesLoading } = useQuery({
    queryKey: ['indices'],
    queryFn: getIndices,
    initialData: loaderData.indices,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Client-side filtering of securities data
  const filteredSecurities = useMemo(() => {
    if (!securitiesData || securitiesData.length === 0) return [];
    if (!selectedIndex) return securitiesData;

    // Get index members from loader data
    const indexMembers = loaderData.indexMembers || [];

    // Filter securities based on index membership
    const membersInIndex = indexMembers
      .filter((member) => member.indexId === selectedIndex)
      .map((member) => member.securityId);

    return securitiesData.filter((security) => membersInIndex.includes(security.ticker));
  }, [securitiesData, selectedIndex, loaderData.indexMembers]);

  const isLoading =
    positionsLoading ||
    metricsLoading ||
    transactionsLoading ||
    securitiesLoading ||
    tradesLoading ||
    sleevesLoading ||
    indicesLoading;

  const handleTickerClick = (ticker: string) => {
    setSelectedTicker(ticker);
    setShowSecurityModal(true);
  };

  const handleSleeveClick = (sleeveId: string) => {
    setSelectedSleeve(sleeveId);
    setShowSleeveModal(true);
  };

  const handleIndexChange = (indexId: string) => {
    setSelectedIndex(indexId);
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
              Welcome back,{' '}
              {isClient ? session?.user?.name || session?.user?.email || 'User' : 'User'}
            </h1>
            <p className="mt-2 text-sm text-gray-600">Tax-loss harvesting portfolio overview</p>
          </div>
          <Button onClick={handleSeedData} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Seeding...
              </>
            ) : (
              'Seed Demo Portfolio'
            )}
          </Button>
        </div>
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
                {activeTab === 'trades' && proposedTrades && proposedTrades.length > 0 && (
                  <ExportButton
                    onExport={() =>
                      exportTradestoExcel(
                        proposedTrades.map((trade) => ({
                          ...trade,
                          action: trade.type as 'BUY' | 'SELL',
                        })),
                      )
                    }
                    label="Export Trades"
                  />
                )}
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
                {activeTab === 'securities' &&
                  filteredSecurities &&
                  filteredSecurities.length > 0 && (
                    <ExportButton
                      onExport={() => exportSP500ToExcel(filteredSecurities)}
                      label="Export Securities"
                    />
                  )}
              </div>
            </div>
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('trades')}
                  className={`shrink-0 py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                    activeTab === 'trades'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">Trades</span>
                  <span className="sm:hidden">Trades</span>
                  <span className="ml-1">({proposedTrades?.length || 0})</span>
                </button>
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
                <button
                  type="button"
                  onClick={() => setActiveTab('securities')}
                  className={`shrink-0 py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm ${
                    activeTab === 'securities'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="hidden sm:inline">Securities</span>
                  <span className="sm:hidden">Securities</span>
                  <span className="ml-1">({filteredSecurities?.length || 0})</span>
                </button>
              </nav>
            </div>
          </div>

          {activeTab === 'trades' && (
            <TradesTable
              trades={proposedTrades || []}
              onTickerClick={handleTickerClick}
              onSleeveClick={handleSleeveClick}
            />
          )}

          {activeTab === 'positions' && (
            <PositionsTable
              positions={positions || []}
              proposedTrades={proposedTrades}
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

          {activeTab === 'securities' && (
            <SP500Table
              sp500Data={filteredSecurities || []}
              indices={indices || []}
              selectedIndex={selectedIndex}
              onIndexChange={handleIndexChange}
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
        sp500Data={securitiesData}
        positions={positions}
        transactions={transactions}
        proposedTrades={proposedTrades}
      />
    </div>
  );
}
