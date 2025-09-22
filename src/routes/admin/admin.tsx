import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AdminErrorBoundary } from '~/components/RouteErrorBoundaries';
import { adminGuard } from '~/lib/route-guards';

export const Route = createFileRoute('/admin/admin')({
  component: AdminDashboard,
  errorComponent: AdminErrorBoundary,
  beforeLoad: adminGuard,
});

function AdminDashboard() {
  // Route is already protected by server-side loader
  return <Outlet />;
}
