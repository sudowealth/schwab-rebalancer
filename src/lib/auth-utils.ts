type AuthModule = typeof import('./auth.server');

// Type definitions for user roles
export type UserRole = 'user' | 'admin';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
}

export interface AuthResult {
  user: AuthenticatedUser;
}

let getWebRequestFn: (() => Request | undefined) | undefined;
let authClient: AuthModule['auth'] | undefined;

async function resolveRequest(): Promise<Request | undefined> {
  if (!import.meta.env.SSR) {
    throw new Error('Authentication utilities must run on the server');
  }

  if (!getWebRequestFn) {
    const mod = await import('@tanstack/react-start/server');
    getWebRequestFn = mod.getWebRequest;
  }

  return getWebRequestFn();
}

async function resolveAuth(): Promise<AuthModule['auth']> {
  if (!import.meta.env.SSR) {
    throw new Error('Authentication utilities must run on the server');
  }

  if (!authClient) {
    const mod: AuthModule = await import('./auth.server');
    authClient = mod.auth;
  }

  return authClient;
}

/**
 * Get the current session and user information
 * Returns null if not authenticated
 */
async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const request = await resolveRequest();
    if (!request) {
      return null;
    }
    const auth = await resolveAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      role: ((session.user as { role?: string }).role as UserRole) || 'user',
      name: session.user.name,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(): Promise<AuthResult> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  return { user };
}

/**
 * Require admin role - throws error if not admin
 */
export async function requireAdmin(): Promise<AuthResult> {
  const { user } = await requireAuth();

  if (user.role !== 'admin') {
    throw new Error('Admin access required');
  }

  return { user };
}
