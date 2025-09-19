import { createServerFn } from '@tanstack/react-start';
import { APIError } from 'better-auth/api';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDatabaseSync } from './db-config';
import { SessionManager } from './session-manager';

// Note: Better Auth integration handled at router level

// Defer server-only auth utilities to runtime to avoid bundling them in the client build
const requireAuth = async () => {
  const mod = await import('./auth-utils');
  return mod.requireAuth();
};
const requireAdmin = async () => {
  const mod = await import('./auth-utils');
  return mod.requireAdmin();
};

// Consistent authentication helper function for server functions
export const ensureAuthenticatedServerFn = async () => {
  try {
    const { user } = await requireAuth();
    return { user };
  } catch (_error) {
    throw new Error('Authentication required');
  }
};

// Dedicated server function for authentication consistency across routes
export const ensureAuthenticatedRouteServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAuth();
  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
  };
});

// Consistent admin authentication helper function
export const ensureAdminAuthenticatedServerFn = async () => {
  try {
    const { user } = await requireAdmin();
    return { user };
  } catch (_error) {
    throw new Error('Admin authentication required');
  }
};

// Server function to verify user access - runs ONLY on server
export const verifyUserAccessServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAuth();
  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
  };
});

// Server function to verify admin access (for route loaders)
export const verifyAdminAccessServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAdmin();
  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
});

// Custom signup server function that assigns admin role to first user
export const signUpWithFirstAdminServerFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string; name: string }) => data)
  .handler(async ({ data }) => {
    const { email, password, name } = data;

    const db = getDatabaseSync();

    try {
      // Check if user creation is allowed
      const individualUse = process.env.INDIVIDUAL_USE === 'true';

      if (individualUse) {
        const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

        const totalUsers = Number(userCount[0]?.count ?? 0);

        if (totalUsers > 0) {
          throw new Error(
            'This application is configured for individual use only. Only one user account is allowed. To enable multiple users, set INDIVIDUAL_USE=false in your environment variables.',
          );
        }
      }

      // Check if this would be the first user
      const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

      const totalUsers = Number(userCount[0]?.count ?? 0);
      const isFirstUser = totalUsers === 0;

      // Create user via Better Auth API to ensure password and related records are handled correctly
      const { auth } = await import('./auth.server');
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name,
          rememberMe: true,
        },
      });

      // If this was the first user, update their role to admin
      if (isFirstUser) {
        console.log('🔑 First user created, setting admin role for:', email);

        // Find the newly created user (prefer id returned by Better Auth when available)
        const newUserId = signUpResult?.user?.id;
        const newUser = newUserId
          ? [{ id: newUserId }]
          : await db
              .select({ id: schema.user.id })
              .from(schema.user)
              .where(eq(schema.user.email, email))
              .limit(1);

        if (newUser.length > 0) {
          await db
            .update(schema.user)
            .set({
              role: 'admin',
              updatedAt: new Date(),
            })
            .where(eq(schema.user.id, newUser[0].id));

          console.log('✅ Admin role assigned to first user');
        }
      }

      return {
        success: true,
        isFirstUser,
        message: isFirstUser
          ? 'Admin account created successfully!'
          : 'Account created successfully!',
      };
    } catch (error) {
      console.error('❌ Signup error:', error);

      if (error instanceof APIError) {
        // Surface the message Better Auth provides for easier debugging
        throw new Error(error.message || 'Registration failed.');
      }

      throw error;
    }
  });

// Check if there are any users in the system (for determining first admin)
export const checkIsFirstUserServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const db = getDatabaseSync();

  const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

  const totalUsers = Number(userCount[0]?.count ?? 0);
  return {
    isFirstUser: totalUsers === 0,
    totalUsers,
  };
});

// Check if user creation is allowed based on INDIVIDUAL_USE setting
export const checkUserCreationAllowedServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  // Get environment variable
  const individualUse = process.env.INDIVIDUAL_USE === 'true';

  if (!individualUse) {
    return {
      allowed: true,
      reason: null,
    };
  }

  // If INDIVIDUAL_USE is enabled, check if there are already users
  const db = getDatabaseSync();

  const userCount = await db.select({ count: sql<number>`count(*)` }).from(schema.user);

  const totalUsers = Number(userCount[0]?.count ?? 0);
  const allowed = totalUsers === 0;

  return {
    allowed,
    reason: allowed
      ? null
      : 'This application is configured for individual use only. Only one user account is allowed. To enable multiple users, set INDIVIDUAL_USE=false in your environment variables.',
    totalUsers,
    individualUse,
  };
});

// Session Management Server Functions

export const getActiveSessionsServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { user } = await requireAuth();
  const sessions = await SessionManager.getActiveSessions(user.id);
  return sessions;
});

export const invalidateSessionServerFn = createServerFn({
  method: 'POST',
}).handler(async (ctx) => {
  const { user } = await requireAuth();
  const data = ctx.data as { sessionId: string; reason: string } | undefined;

  if (!data || !data.sessionId || !data.reason) {
    throw new Error('Invalid request data');
  }

  const count = await SessionManager.invalidateSessions({
    sessionId: data.sessionId,
    reason: data.reason as
      | 'password_change'
      | 'suspicious_activity'
      | 'admin_action'
      | 'logout_all',
    userId: user.id,
  });

  return { success: true, sessionsInvalidated: count };
});

export const logoutAllSessionsServerFn = createServerFn({
  method: 'POST',
}).handler(async (ctx) => {
  const { user } = await requireAuth();
  const { currentSessionId } = (ctx.data || {}) as {
    currentSessionId?: string;
  };

  await SessionManager.logoutAllSessions(user.id, currentSessionId);

  return { success: true, message: 'All sessions have been logged out' };
});

export const cleanupExpiredSessionsServerFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  await requireAdmin(); // Only admins can cleanup sessions

  const cleanedCount = await SessionManager.cleanupExpiredSessions();

  return { success: true, cleanedSessions: cleanedCount };
});

// Admin-only user management functions

// Get all users (admin only)
export const getAllUsersServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin();

  const db = getDatabaseSync();

  const users = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      name: schema.user.name,
      role: schema.user.role,
      emailVerified: schema.user.emailVerified,
      createdAt: schema.user.createdAt,
      updatedAt: schema.user.updatedAt,
    })
    .from(schema.user)
    .orderBy(schema.user.createdAt);

  return users;
});

// Update user role (admin only)
export const updateUserRoleServerFn = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; role: 'user' | 'admin' }) => data)
  .handler(async ({ data }) => {
    const { userId, role } = data;

    await requireAdmin();

    const db = getDatabaseSync();

    // Verify user exists
    const existingUser = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    // Update role
    await db
      .update(schema.user)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, userId));

    return { success: true, message: `User role updated to ${role}` };
  });

// Delete user and all associated data (admin only)
export const deleteUserServerFn = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; confirmation: string }) => data)
  .handler(async ({ data }) => {
    const { userId, confirmation } = data;

    if (confirmation !== 'DELETE_USER_DATA') {
      throw new Error('Invalid confirmation');
    }

    const { user: currentUser } = await requireAdmin();

    // Prevent admins from deleting themselves
    if (currentUser.id === userId) {
      throw new Error('Cannot delete your own account');
    }

    const db = getDatabaseSync();

    // Verify user exists
    const existingUser = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    // Delete user (cascading deletes will handle associated data)
    await db.delete(schema.user).where(eq(schema.user.id, userId));

    return {
      success: true,
      message: `User ${existingUser[0].email} and all associated data deleted successfully`,
    };
  });

// Get all data for a specific user (admin only)
export const getUserDataServerFn = createServerFn({ method: 'GET' })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = data;

    await requireAdmin();

    const db = getDatabaseSync();

    // Get user info
    const user = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Get all user data
    const accounts = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, userId));

    const sleeves = await db.select().from(schema.sleeve).where(eq(schema.sleeve.userId, userId));

    const models = await db.select().from(schema.model).where(eq(schema.model.userId, userId));

    const rebalancingGroups = await db
      .select()
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.userId, userId));

    return {
      user: user[0],
      accounts,
      sleeves,
      models,
      rebalancingGroups,
    };
  });
