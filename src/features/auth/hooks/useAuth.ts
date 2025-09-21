import { useSession } from '~/features/auth/auth-client';

export type UserRole = 'user' | 'admin';

export function useAuth() {
  const { data: session, isPending, error } = useSession();

  const user = session?.user
    ? {
        ...session.user,
        role: (session.user as { role?: UserRole }).role || 'user',
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
