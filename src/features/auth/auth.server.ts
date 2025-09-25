import { createServerFn } from '@tanstack/react-start';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '~/db/schema';
import { SessionManager } from '~/features/auth/session.server';
import { getDb } from '~/lib/db-config';
import { getEnv } from '~/lib/env';
import { handleServerError, throwServerError } from '~/lib/error-utils';
import { auth } from './auth';
import { requireAdmin, requireAuth } from './auth-utils';

// Zod schemas for type safety
const setUserRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['user', 'admin']),
});

const deleteUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  confirmation: z.string().min(1, 'Confirmation text is required'),
});

const userIdOnlySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

const signUpWithFirstAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

const invalidateSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  reason: z.enum(['password_change', 'suspicious_activity', 'admin_action', 'logout_all']),
});

const logoutAllSessionsSchema = z.object({
  currentSessionId: z.string().optional(),
});

// Admin-only functions

// Get all users (admin only)
export const getAllUsersServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin();

  const users = await getDb()
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
  .inputValidator(setUserRoleSchema)
  .handler(async ({ data }) => {
    const { userId, role } = data;

    await requireAdmin();

    const _db = getDb();

    // Verify user exists
    const existingUser = await getDb()
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throwServerError('User not found', 404);
    }

    // Update role
    await getDb()
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
  .inputValidator(deleteUserSchema)
  .handler(async ({ data }) => {
    const { userId, confirmation } = data;

    if (confirmation !== 'DELETE_USER_DATA') {
      throwServerError('Invalid confirmation', 400);
    }

    const { user: currentUser } = await requireAdmin();

    // Prevent admins from deleting themselves
    if (currentUser.id === userId) {
      throwServerError('Cannot delete your own account', 400);
    }

    const _db = getDb();

    // Verify user exists
    const existingUser = await getDb()
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throwServerError('User not found', 404);
    }

    // Delete user (cascading deletes will handle associated data)
    await getDb().delete(schema.user).where(eq(schema.user.id, userId));

    return {
      success: true,
      message: `User ${existingUser[0].email} and all associated data deleted successfully`,
    };
  });

// Get all data for a specific user (admin only)
export const getUserDataServerFn = createServerFn({ method: 'GET' })
  .inputValidator(userIdOnlySchema)
  .handler(async ({ data }) => {
    const { userId } = data;

    await requireAdmin();

    const _db = getDb();

    // Get user info
    const user = await getDb()
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (user.length === 0) {
      throwServerError('User not found', 404);
    }

    // Get all user data
    const accounts = await getDb()
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, userId));

    const sleeves = await getDb()
      .select()
      .from(schema.sleeve)
      .where(eq(schema.sleeve.userId, userId));

    const models = await getDb().select().from(schema.model).where(eq(schema.model.userId, userId));

    const rebalancingGroups = await getDb()
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

// Custom signup server function that assigns admin role to first user
export const signUpWithFirstAdminServerFn = createServerFn({ method: 'POST' })
  .inputValidator(signUpWithFirstAdminSchema)
  .handler(async ({ data }) => {
    const { email, password, name } = data;

    const _db = getDb();

    try {
      // Check if user creation is allowed
      const individualUse = process.env.INDIVIDUAL_USE === 'true';

      if (individualUse) {
        const userCount = await getDb().select({ count: sql<number>`count(*)` }).from(schema.user);

        const totalUsers = Number(userCount[0]?.count ?? 0);

        if (totalUsers > 0) {
          throw new Error(
            'This application is configured for individual use only. Only one user account is allowed. To enable multiple users, set INDIVIDUAL_USE=false in your environment variables.',
          );
        }
      }

      // Check if this would be the first user
      const userCount = await getDb().select({ count: sql<number>`count(*)` }).from(schema.user);

      const totalUsers = Number(userCount[0]?.count ?? 0);
      const isFirstUser = totalUsers === 0;

      // Create user via Better Auth API to ensure password and related records are handled correctly
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
          : await getDb()
              .select({ id: schema.user.id })
              .from(schema.user)
              .where(eq(schema.user.email, email))
              .limit(1);

        if (newUser.length > 0) {
          await getDb()
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
      throw handleServerError(error, 'User signup');
    }
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

// Check if there are any users in the system (for determining first admin)
export const checkIsFirstUserServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const _db = getDb();

  const userCount = await getDb().select({ count: sql<number>`count(*)` }).from(schema.user);

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
  const _db = getDb();

  const userCount = await getDb().select({ count: sql<number>`count(*)` }).from(schema.user);

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

export const invalidateSessionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(invalidateSessionSchema)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const { sessionId, reason } = data;

    const count = await SessionManager.invalidateSessions({
      sessionId,
      reason,
      userId: user.id,
    });

    return { success: true, sessionsInvalidated: count };
  });

export const logoutAllSessionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(logoutAllSessionsSchema)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();
    const { currentSessionId } = data || {};

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

// Check if email service is configured (used by forgot password page)
export const checkEmailServiceConfiguredServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const env = getEnv();
  const isConfigured = !!env.RESEND_API_KEY;

  return {
    isConfigured,
    message: isConfigured
      ? null
      : 'Email service is not configured. Password reset functionality is unavailable.',
  };
});
