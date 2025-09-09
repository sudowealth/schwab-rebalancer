import { createFileRoute, redirect } from '@tanstack/react-router';
import { verifyAdminAccessServerFn } from '~/lib/server-functions';

export const Route = createFileRoute('/admin/')({
  component: AdminDashboardIndex,
  loader: async () => {
    try {
      // Server-side admin verification
      const result = await verifyAdminAccessServerFn();
      return result;
    } catch (error) {
      // If not admin or not authenticated, redirect
      if (error instanceof Error) {
        if (error.message.includes('Admin access required')) {
          throw redirect({ to: '/' }); // Regular users go to dashboard
        }
        if (error.message.includes('Authentication required')) {
          throw redirect({ to: '/login', search: { reset: '' } });
        }
      }
      throw error;
    }
  },
});

function AdminDashboardIndex() {
  // Route is already protected by server-side loader
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">Administrative controls and system management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        <AdminCard
          title="User Management"
          description="Manage users and their roles"
          href="/admin/users"
        />

        <AdminCard
          title="System Statistics"
          description="View system-wide statistics"
          href="/admin/stats"
        />
      </div>
    </div>
  );
}

function AdminCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
    >
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </a>
  );
}
