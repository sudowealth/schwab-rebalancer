import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/data-feeds')({
  component: DataFeedsLayout,
});

function DataFeedsLayout() {
  return <Outlet />;
}
