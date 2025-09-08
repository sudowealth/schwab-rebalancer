import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/schwab")({
  component: SchwabLayout,
  beforeLoad: () => {
    // Note: Server-side auth checks would be handled in a loader if this route had one
    // Client-side auth checking is handled by child routes
  },
});

function SchwabLayout() {
  return <Outlet />;
}