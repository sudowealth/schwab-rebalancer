import { auth } from './auth.server';

export interface ServerAuthContext {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Server-side authentication check for use within server function handlers
 * This approach may be more compatible with Better Auth than middleware
 */
export async function requireServerAuth(
  headers: Headers | Record<string, string>,
): Promise<ServerAuthContext> {
  try {
    console.log('Server auth: Checking session with headers:', {
      hasHeaders: !!headers,
      headerKeys: headers ? Object.keys(headers) : [],
      cookieHeader: 'cookie' in headers ? (headers as Record<string, string>).cookie : undefined,
    });

    // Try to get session using Better Auth API
    const session = await auth.api.getSession({
      headers: headers as Headers,
    });

    console.log('Server auth: Session result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
    });

    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        role: (session.user as { role?: string }).role || 'user',
      },
    };
  } catch (error) {
    console.error('Server auth error:', error);
    throw new Error('Authentication required');
  }
}

/**
 * Admin-only server authentication check
 */
export async function requireServerAdmin(
  headers: Headers | Record<string, string>,
): Promise<ServerAuthContext> {
  const authContext = await requireServerAuth(headers);

  if (authContext.user.role !== 'admin') {
    throw new Error('Admin access required');
  }

  return authContext;
}
