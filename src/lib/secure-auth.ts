import { auth } from './auth';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface AuthContext {
  userId: string;
  email: string;
  role?: string;
}

export async function requireAuth(headers: Headers): Promise<AuthContext> {
  try {
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
