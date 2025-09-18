type AuthModule = typeof import('./auth.server');

let authClient: AuthModule['auth'] | undefined;

async function resolveAuth(): Promise<AuthModule['auth']> {
  if (!import.meta.env.SSR) {
    throw new Error('Secure auth utilities must run on the server');
  }

  if (!authClient) {
    const mod: AuthModule = await import('./auth.server');
    authClient = mod.auth;
  }

  return authClient;
}
import { ForbiddenError, UnauthorizedError } from './errors';

// Error classes are now in errors.ts to avoid importing from this server-only file

export interface AuthContext {
  userId: string;
  email: string;
  role?: string;
}

export async function requireAuth(headers: Headers): Promise<AuthContext> {
  try {
    const auth = await resolveAuth();
    const session = await auth.api.getSession({
      headers: headers,
    });

    if (!session?.user?.id) {
      throw new UnauthorizedError('Authentication required');
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      role: (session.user as { role?: string }).role || 'user',
    };
  } catch {
    throw new UnauthorizedError('Authentication required');
  }
}

export async function requireAdmin(headers: Headers): Promise<AuthContext> {
  const authContext = await requireAuth(headers);
  if (authContext.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  return authContext;
}
