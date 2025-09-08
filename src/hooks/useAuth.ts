import { useSession } from "~/lib/auth-client";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  emailVerified?: boolean;
}

export function useAuth() {
  const { data: session, isPending, error } = useSession();

  const user = session?.user ? {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: (session.user as { role?: string }).role as UserRole || "user",
    emailVerified: session.user.emailVerified,
  } : null;

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isPending,
    error,
  };
}

export function useRequireAuth() {
  const { user, isPending } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !user) {
      router.navigate({ to: "/login", search: { reset: "" } });
    }
  }, [user, isPending, router]);

  return { user, isPending };
}

export function useRequireAdmin() {
  const { user, isAdmin, isPending } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isPending) {
      if (!user) {
        router.navigate({ to: "/login", search: { reset: "" } });
      } else if (!isAdmin) {
        router.navigate({ to: "/" }); // Redirect to dashboard if not admin
      }
    }
  }, [user, isAdmin, isPending, router]);

  return { user, isPending, isAdmin };
}