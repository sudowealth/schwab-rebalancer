import { useSession } from '~/lib/auth-client';

export type UserRole = 'user' | 'admin';

// Removed: User interface - was unused internal type

export function useAuth() {
  const { data: session, isPending, error } = useSession();

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: ((session.user as { role?: string }).role as UserRole) || 'user',
        emailVerified: session.user.emailVerified,
      }
    : null;

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isPending,
    error,
  };
}
