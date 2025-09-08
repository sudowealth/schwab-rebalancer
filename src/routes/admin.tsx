import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { verifyAdminAccessServerFn } from "~/lib/server-functions";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
  loader: async () => {
    try {
      // Server-side admin verification
      const result = await verifyAdminAccessServerFn();
      return result;
    } catch (error) {
      // If not admin or not authenticated, redirect
      if (error instanceof Error) {
        if (error.message.includes("Admin access required")) {
          throw redirect({ to: "/" }); // Regular users go to dashboard
        }
        if (error.message.includes("Authentication required")) {
          throw redirect({ to: "/login", search: { reset: "" } });
        }
      }
      throw error;
    }
  },
});

function AdminDashboard() {
  // Route is already protected by server-side loader
  return <Outlet />;
}

