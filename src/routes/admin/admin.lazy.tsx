import { createLazyFileRoute } from '@tanstack/react-router';

// Admin layout route - lazy loaded
export const Route = createLazyFileRoute('/admin/admin')({
  component: () => import('./admin'),
});
