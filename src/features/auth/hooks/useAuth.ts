import { useMemo } from 'react';
import { useSession } from '~/features/auth/auth-client';

export type UserRole = 'user' | 'admin';

export function useAuth() {
  const { data: session, isPending, error } = useSession();

  const user = useMemo(() => {
    return session?.user
      ? {
          ...session.user,
          role: (session.user as { role?: UserRole }).role || 'user',
        }
      : null;
  }, [session?.user]);

  const authState = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
      isPending,
      error,
    }),
    [user, isPending, error],
  );

  return authState;
}
