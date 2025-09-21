import { createFileRoute, Outlet } from '@tanstack/react-router';
import { adminGuard } from '~/lib/route-guards';

export const Route = createFileRoute('/admin')({
  component: AdminDashboard,
  beforeLoad: adminGuard,
});

function AdminDashboard() {
  // Route is already protected by server-side loader
  return <Outlet />;
}
