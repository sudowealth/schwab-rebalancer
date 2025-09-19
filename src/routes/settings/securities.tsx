import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { SecuritiesTable } from '../../components/dashboard/securities-table';
import { ExportButton } from '../../components/ui/export-button';
import { exportSP500ToExcel } from '../../lib/excel-export';
import { getDashboardDataServerFn, getSecuritiesDataServerFn } from '../../lib/server-functions';

// Extended security data type that includes optional properties
interface ExtendedSecurityData {
  ticker: string;
  name: string;
  price: number;
  sector?: string;
  industry?: string;
  marketCap?: string;
  peRatio?: number;
}

export const Route = createFileRoute('/settings/securities')({
  component: SecuritiesComponent,
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
    try {
      // Load dashboard data for authentication and base data
      const dashboardData = await getDashboardDataServerFn();

      // For securities page, we also need filtered securities data
      // Initially load without filters to get all data
      const securitiesData = await getSecuritiesDataServerFn({
        data: {},
      });

      return {
        ...dashboardData,
        securities: securitiesData.securities,
        indices: securitiesData.indices,
        indexMembers: securitiesData.indexMembers,
      };
    } catch (error) {
      // If authentication error, redirect to login
      if (error instanceof Error && error.message.includes('Authentication required')) {
        throw redirect({ to: '/login', search: { reset: '', redirect: '/settings/securities' } });
      }
      // Re-throw other errors
      throw error;
    }
  },
});

function SecuritiesComponent() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Use filtered data from server with reactive updates and pagination
  const { data: filteredData, isLoading } = useQuery({
    queryKey: [
      'securitiesData',
      search.index,
      search.search,
      search.page,
      search.pageSize,
      search.sortBy,
      search.sortOrder,
    ],
    queryFn: () =>
      getSecuritiesDataServerFn({
        data: {
          indexId: search.index || undefined,
          search: search.search || undefined,
          page: search.page,
          pageSize: search.pageSize,
          sortBy: search.sortBy,
          sortOrder: search.sortOrder,
        },
      }),
    initialData: {
      securities: loaderData.securities || [],
      indices: loaderData.indices || [],
      indexMembers: loaderData.indexMembers || [],
      pagination: {
        page: 1,
        pageSize: 100,
        total: loaderData.securities?.length || 0,
        totalPages: Math.ceil((loaderData.securities?.length || 0) / 100),
      },
    },
    select: (data) => ({
      ...data,
      // Use server-provided pagination data
      pagination: data.pagination || {
        page: 1,
        pageSize: 100,
        total: data.securities?.length || 0,
        totalPages: Math.ceil((data.securities?.length || 0) / 100),
      },
    }),
    staleTime: 1000 * 60 * 5, // 5 minutes (reduced from 1 hour for better responsiveness)
  });

  const securitiesData = filteredData?.securities || [];
  const indices = filteredData?.indices || [];

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
            {securitiesData && securitiesData.length > 0 && (
              <ExportButton
                onExport={() =>
                  exportSP500ToExcel(
                    securitiesData.map((s) => ({
                      ...(s as ExtendedSecurityData),
                      marketCap: (s as ExtendedSecurityData).marketCap || 'N/A',
                      industry: s.industry || 'Unknown',
                      sector: s.sector || 'Unknown',
                      peRatio: (s as ExtendedSecurityData).peRatio,
                    })),
                  )
                }
                label="Export Securities"
              />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <SecuritiesTable
            sp500Data={securitiesData.map((s) => ({
              ...(s as ExtendedSecurityData),
              marketCap: (s as ExtendedSecurityData).marketCap || 'N/A',
              industry: s.industry || 'Unknown',
              sector: s.sector || 'Unknown',
              peRatio: (s as ExtendedSecurityData).peRatio,
            }))}
            indices={indices}
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
