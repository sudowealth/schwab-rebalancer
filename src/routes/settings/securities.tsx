import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { SecuritiesTable } from '../../components/dashboard/securities-table';
import { ExportButton } from '../../components/ui/export-button';
import { getIndices, getSnP500Data } from '../../lib/api';
import { exportSP500ToExcel } from '../../lib/excel-export';
import { getDashboardDataServerFn } from '../../lib/server-functions';

export const Route = createFileRoute('/settings/securities')({
  component: SecuritiesComponent,
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

function SecuritiesComponent() {
  const loaderData = Route.useLoaderData();
  const [selectedIndex, setSelectedIndex] = useState<string>('');

  const { data: securitiesData, isLoading: securitiesLoading } = useQuery({
    queryKey: ['securitiesData'],
    queryFn: getSnP500Data,
    initialData: loaderData.sp500Data,
    staleTime: 1000 * 60 * 60, // 1 hour
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

  const isLoading = securitiesLoading || indicesLoading;

  const handleIndexChange = (indexId: string) => {
    setSelectedIndex(indexId);
  };

  if (isLoading) {
    return (
      <div className="px-4 py-8">
        <div className="animate-pulse">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Securities</h1>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="h-4 bg-gray-300 rounded mb-2"></div>
            <div className="h-8 bg-gray-300 rounded"></div>
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
            <h1 className="text-2xl font-bold text-gray-900">Securities</h1>
            <p className="mt-2 text-sm text-gray-600">Browse and filter securities data</p>
          </div>
          <div className="flex space-x-2">
            {filteredSecurities && filteredSecurities.length > 0 && (
              <ExportButton
                onExport={() => exportSP500ToExcel(filteredSecurities)}
                label="Export Securities"
              />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <SecuritiesTable
            sp500Data={filteredSecurities || []}
            indices={indices || []}
            selectedIndex={selectedIndex}
            onIndexChange={handleIndexChange}
          />
        </div>
      </div>
    </div>
  );
}
