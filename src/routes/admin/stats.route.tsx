import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Activity,
  BarChart3,
  CreditCard,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { AdminErrorBoundary } from '~/components/RouteErrorBoundaries';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { getSystemStatsServerFn } from '~/lib/server-functions';

export const Route = createFileRoute('/admin/stats')({
  component: SystemStats,
  errorComponent: AdminErrorBoundary,
  loader: async () => {
    // Pre-load stats data
    const stats = await getSystemStatsServerFn();
    return stats;
  },
});

function SystemStats() {
  // Get initial data from loader
  const loaderData = Route.useLoaderData();

  const {
    data: stats,
    isPending: statsPending,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => getSystemStatsServerFn(),
    initialData: loaderData, // Use loader data as initial data
  });

  if (statsPending) {
    return <div>Loading...</div>;
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.users || 0,
      icon: Users,
      description: 'Registered users in the system',
    },
    {
      title: 'Accounts',
      value: stats?.accounts || 0,
      icon: CreditCard,
      description: 'Trading accounts across all users',
    },
    {
      title: 'Sleeves',
      value: stats?.sleeves || 0,
      icon: Package,
      description: 'Security sleeves created',
    },
    {
      title: 'Models',
      value: stats?.models || 0,
      icon: TrendingUp,
      description: 'Portfolio models defined',
    },
    {
      title: 'Holdings',
      value: stats?.holdings || 0,
      icon: DollarSign,
      description: 'Individual security positions',
    },
    {
      title: 'Transactions',
      value: stats?.transactions || 0,
      icon: Activity,
      description: 'Total transactions recorded',
    },
    {
      title: 'Rebalancing Groups',
      value: stats?.rebalancingGroups || 0,
      icon: BarChart3,
      description: 'Active rebalancing groups',
    },
    {
      title: 'Trade Orders',
      value: stats?.orders || 0,
      icon: ShoppingCart,
      description: 'Orders placed through the system',
    },
  ];

  return (
    <ErrorBoundaryWrapper
      title="System Statistics Error"
      description="Failed to load system statistics. This might be due to a temporary data issue."
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Statistics</h1>
            <p className="mt-2 text-sm text-gray-600">
              Overview of system usage and performance metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline">
              Refresh
            </Button>
            <Button onClick={() => window.history.back()}>Back to Admin</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Last updated: {new Date().toLocaleString()}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Average accounts per user:</strong>{' '}
                    {stats?.users ? (stats.accounts / stats.users).toFixed(1) : '0'}
                  </div>
                  <div>
                    <strong>Average sleeves per user:</strong>{' '}
                    {stats?.users ? (stats.sleeves / stats.users).toFixed(1) : '0'}
                  </div>
                  <div>
                    <strong>Average models per user:</strong>{' '}
                    {stats?.users ? (stats.models / stats.users).toFixed(1) : '0'}
                  </div>
                  <div>
                    <strong>Average holdings per account:</strong>{' '}
                    {stats?.accounts ? (stats.holdings / stats.accounts).toFixed(1) : '0'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundaryWrapper>
  );
}
