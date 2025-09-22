import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DataFeedsErrorBoundary } from '~/components/RouteErrorBoundaries';

export const Route = createFileRoute('/data-feeds/data-feeds')({
  component: DataFeedsLayout,
  errorComponent: DataFeedsErrorBoundary,
});

function DataFeedsLayout() {
  return <Outlet />;
}
