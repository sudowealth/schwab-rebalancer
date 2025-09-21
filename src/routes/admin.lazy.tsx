import { createLazyFileRoute, lazyRouteComponent } from '@tanstack/react-router';

// Admin index route - lazy loaded
export const Route = createLazyFileRoute('/admin')({
  component: lazyRouteComponent(() => import('./admin/index.route')),
});

// Admin users route - lazy loaded
export const AdminUsersRoute = createLazyFileRoute('/admin/users')({
  component: lazyRouteComponent(() => import('./admin/users.route')),
});

// Admin stats route - lazy loaded
export const AdminStatsRoute = createLazyFileRoute('/admin/stats')({
  component: lazyRouteComponent(() => import('./admin/stats.route')),
});
