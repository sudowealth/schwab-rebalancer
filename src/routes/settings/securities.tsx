import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { SettingsErrorBoundary } from '~/components/RouteErrorBoundaries';
import { ExportButton } from '~/components/ui/export-button';
import { SecuritiesTable } from '~/features/dashboard/components/securities-table';
import { getIndices, getSnP500Data } from '~/lib/api';
import { useExcelExport } from '~/lib/excel-export';
import { authGuard } from '~/lib/route-guards';
import { getDashboardDataServerFn } from '~/lib/server-functions';

export const Route = createFileRoute('/settings/securities')({
  component: SecuritiesComponent,
  errorComponent: SettingsErrorBoundary,
  beforeLoad: authGuard,
  validateSearch: (search) => ({
    page:
      typeof search.page === 'string'
        ? Number.parseInt(search.page, 10) || 1
        : (search.page as number) || 1,
    pageSize:
      typeof search.pageSize === 'string'
        ? Number.parseInt(search.pageSize, 10) || 100
        : (search.pageSize as number) || 100,
    sortBy: (search.sortBy as string) || 'ticker',
    sortOrder: ((search.sortOrder as string) === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
    search: typeof search.search === 'string' ? search.search : '',
    index: typeof search.index === 'string' ? search.index : '',
  }),
  loader: async ({ context: _context }) => {
    return await getDashboardDataServerFn();
  },
});

function SecuritiesComponent() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

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

  // Lazy-loaded Excel export function
  const { exportSP500ToExcel } = useExcelExport();

  // Client-side filtering of securities data
  const filteredSecurities = useMemo(() => {
    if (!securitiesData || securitiesData.length === 0) return [];
    if (!search.index) return securitiesData;

    // Get index members from loader data
    const indexMembers = loaderData.indexMembers || [];

    // Filter securities based on index membership
    const membersInIndex = indexMembers
      .filter((member) => member.indexId === search.index)
      .map((member) => member.securityId);

    return securitiesData.filter((security) => membersInIndex.includes(security.ticker));
  }, [securitiesData, search.index, loaderData.indexMembers]);

  const isLoading = securitiesLoading || indicesLoading;

  const handleIndexChange = (indexId: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        index: indexId === 'all' ? '' : indexId,
        page: 1, // Reset to first page when changing index
      }),
    });
  };

  if (isLoading) {
    return (
      <div className="px-4 py-8">
        <div className="animate-pulse">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Securities</h1>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="h-4 bg-gray-300 rounded mb-2" />
            <div className="h-8 bg-gray-300 rounded" />
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
                onExport={async () => exportSP500ToExcel(filteredSecurities)}
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
            selectedIndex={search.index}
            onIndexChange={handleIndexChange}
            searchParams={search}
            navigate={navigate}
          />
        </div>
      </div>
    </div>
  );
}
