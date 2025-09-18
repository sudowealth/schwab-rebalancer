import { and, eq, lt, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDatabaseSync } from './db-config';
import { logSecurityEvent } from './log';

// Account lockout configuration
export const LOCKOUT_CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  RESET_WINDOW_MINUTES: 30, // Reset failed attempts after this window
} as const;

/**
 * Check if an account is currently locked
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  try {
    const user = await getDatabaseSync()
      .select({
        lockedUntil: schema.user.lockedUntil,
      })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (!user[0]?.lockedUntil) {
      return false;
    }

    const now = new Date();
    const lockedUntil = user[0].lockedUntil;

    return lockedUntil > now;
  } catch (error) {
    console.error('Error checking account lockout status:', error);
    return false; // Fail open for security
  }
}

/**
 * Record a failed login attempt and potentially lock the account
 */
export async function recordFailedLoginAttempt(
  email: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ locked: boolean; lockoutExpiresAt?: Date }> {
  try {
    const now = new Date();
    const resetWindowStart = new Date(
      now.getTime() - LOCKOUT_CONFIG.RESET_WINDOW_MINUTES * 60 * 1000,
    );

    // Get current user data
    const users = await getDatabaseSync()
      .select({
        id: schema.user.id,
        failedLoginAttempts: schema.user.failedLoginAttempts,
        lastFailedLoginAt: schema.user.lastFailedLoginAt,
        lockedUntil: schema.user.lockedUntil,
      })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    if (users.length === 0) {
      // User doesn't exist - log suspicious activity
      await logSecurityEvent('failed_login_unknown_user', 'AUTH_FAILED', {
        email,
        ipAddress,
        userAgent,
        timestamp: now.toISOString(),
      });
      return { locked: false };
    }

    const user = users[0];
    let newFailedAttempts = user.failedLoginAttempts || 0;
    let lockedUntil: Date | null = user.lockedUntil;

    // Check if we should reset failed attempts (outside reset window)
    if (user.lastFailedLoginAt && user.lastFailedLoginAt < resetWindowStart) {
      newFailedAttempts = 1; // Reset and add current attempt
    } else {
      newFailedAttempts += 1;
    }

    // Check if account should be locked
    const shouldLock = newFailedAttempts >= LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS;
    if (shouldLock) {
      lockedUntil = new Date(now.getTime() + LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000);
    }

    // Update user record
    await getDatabaseSync()
      .update(schema.user)
      .set({
        failedLoginAttempts: newFailedAttempts,
        lastFailedLoginAt: now,
        lockedUntil: lockedUntil,
        updatedAt: now,
      })
      .where(eq(schema.user.id, user.id));

    // Log security event
    await logSecurityEvent('failed_login_attempt', 'AUTH_FAILED', {
      userId: user.id,
      email,
      attemptCount: newFailedAttempts,
      locked: shouldLock,
      lockoutExpiresAt: lockedUntil?.toISOString(),
      ipAddress,
      userAgent,
      timestamp: now.toISOString(),
    });

    return {
      locked: shouldLock,
      lockoutExpiresAt: lockedUntil || undefined,
    };
  } catch (error) {
    console.error('Error recording failed login attempt:', error);
    // Fail silently but log the error
    await logSecurityEvent('failed_login_error', 'SYSTEM_ERROR', {
      email,
      ipAddress,
      userAgent,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return { locked: false };
  }
}

/**
 * Record a successful login and reset failed attempts
 */
export async function recordSuccessfulLogin(userId: string): Promise<void> {
  try {
    const now = new Date();

    await getDatabaseSync()
      .update(schema.user)
      .set({
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(schema.user.id, userId));

    // Log successful login
    await logSecurityEvent('successful_login', 'AUTH_SUCCESS', {
      userId,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error recording successful login:', error);
    // Don't fail the login for logging errors
  }
}

/**
 * Get account lockout status for a user
 */
export async function getAccountLockoutStatus(userId: string): Promise<{
  isLocked: boolean;
  failedAttempts: number;
  lockoutExpiresAt?: Date;
  lastFailedLoginAt?: Date;
}> {
  try {
    const users = await getDatabaseSync()
      .select({
        failedLoginAttempts: schema.user.failedLoginAttempts,
        lastFailedLoginAt: schema.user.lastFailedLoginAt,
        lockedUntil: schema.user.lockedUntil,
      })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (users.length === 0) {
      return {
        isLocked: false,
        failedAttempts: 0,
      };
    }

    const user = users[0];
    const now = new Date();

    return {
      isLocked: user.lockedUntil ? user.lockedUntil > now : false,
      failedAttempts: user.failedLoginAttempts || 0,
      lockoutExpiresAt: user.lockedUntil || undefined,
      lastFailedLoginAt: user.lastFailedLoginAt || undefined,
    };
  } catch (error) {
    console.error('Error getting account lockout status:', error);
    return {
      isLocked: false,
      failedAttempts: 0,
    };
  }
}

/**
 * Manually unlock an account (admin function)
 */
export async function unlockAccount(userId: string): Promise<boolean> {
  try {
    const now = new Date();

    const result = await getDatabaseSync()
      .update(schema.user)
      .set({
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(schema.user.id, userId));

    if (result.rowCount && result.rowCount > 0) {
      await logSecurityEvent('account_unlocked', 'ADMIN_ACTION', {
        userId,
        timestamp: now.toISOString(),
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error unlocking account:', error);
    return false;
  }
}

/**
 * Clean up expired lockouts (maintenance function)
 */
export async function cleanupExpiredLockouts(): Promise<number> {
  try {
    const now = new Date();

    const result = await getDatabaseSync()
      .update(schema.user)
      .set({
        lockedUntil: null,
        updatedAt: now,
      })
      .where(and(sql`${schema.user.lockedUntil} IS NOT NULL`, lt(schema.user.lockedUntil, now)));

    const cleanedCount = result.rowCount || 0;

    if (cleanedCount > 0) {
      await logSecurityEvent('expired_lockouts_cleaned', 'MAINTENANCE', {
        count: cleanedCount,
        timestamp: now.toISOString(),
      });
    }

    return cleanedCount;
  } catch (error) {
    console.error('Error cleaning up expired lockouts:', error);
    return 0;
  }
}
