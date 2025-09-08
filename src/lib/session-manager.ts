import { getDatabase } from "./db-config";
import * as schema from "../db/schema";
import { eq, lt } from "drizzle-orm";

export interface SessionInvalidationOptions {
  userId?: string;
  sessionId?: string;
  reason: 'password_change' | 'suspicious_activity' | 'admin_action' | 'logout_all';
  excludeCurrentSession?: string;
}

/**
 * Log audit events for session management
 */
async function logSessionAuditEvent(
  userId: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDatabase();
    await db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      userId,
      action,
      entityType: 'session',
      entityId: null,
      metadata: JSON.stringify(details),
      createdAt: new Date(),
      ipAddress: null, // Will be set by middleware if available
      userAgent: null,
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Enhanced session management utilities for security events
 */
export class SessionManager {
  /**
   * Invalidate user sessions based on criteria
   */
  static async invalidateSessions(options: SessionInvalidationOptions): Promise<number> {
    try {
      let invalidatedCount = 0;
      const db = getDatabase();

      if (options.sessionId) {
        // Invalidate specific session by updating expiry
        await db
          .update(schema.session)
          .set({ expiresAt: new Date(Date.now() - 1000) }) // Set to past
          .where(eq(schema.session.id, options.sessionId));
        invalidatedCount = 1;
      } else if (options.userId) {
        // Get all sessions for user
        const sessions = await db
          .select()
          .from(schema.session)
          .where(eq(schema.session.userId, options.userId));

        for (const session of sessions) {
          if (options.excludeCurrentSession && session.id === options.excludeCurrentSession) {
            continue; // Skip current session if requested
          }
          
          await db
            .update(schema.session)
            .set({ expiresAt: new Date(Date.now() - 1000) })
            .where(eq(schema.session.id, session.id));
          invalidatedCount++;
        }
      }

      // Log the session invalidation for audit purposes
      if (options.userId) {
        await logSessionAuditEvent(options.userId, 'SESSION_INVALIDATED', {
          reason: options.reason,
          sessionsInvalidated: invalidatedCount,
          excludedCurrentSession: !!options.excludeCurrentSession,
        });
      }

      return invalidatedCount;
    } catch (error) {
      console.error('Failed to invalidate sessions:', error);
      throw new Error('Session invalidation failed');
    }
  }

  /**
   * Force logout all sessions for a user (typically after password change)
   */
  static async logoutAllSessions(userId: string, currentSessionId?: string): Promise<void> {
    await this.invalidateSessions({
      userId,
      reason: 'password_change',
      excludeCurrentSession: currentSessionId,
    });
  }

  /**
   * Invalidate sessions due to suspicious activity
   */
  static async invalidateSuspiciousSessions(userId: string): Promise<void> {
    await this.invalidateSessions({
      userId,
      reason: 'suspicious_activity',
    });
  }

  /**
   * Get active session information for a user
   */
  static async getActiveSessions(userId: string): Promise<Array<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    isActive: boolean;
  }>> {
    try {
      const db = getDatabase();
      const sessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, userId));

      return sessions.map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isActive: new Date(session.expiresAt) > new Date(),
      }));
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions from database
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const db = getDatabase();
      const result = await db
        .delete(schema.session)
        .where(lt(schema.session.expiresAt, new Date()));
      
      const expiredCount = result.changes || 0;
      console.log(`Cleaned up ${expiredCount} expired sessions`);
      return expiredCount;
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Validate session security based on IP and User Agent changes
   */
  static async validateSessionSecurity(
    sessionId: string, 
    currentIp: string, 
    currentUserAgent: string
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const db = getDatabase();
      const sessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.id, sessionId))
        .limit(1);
      
      const session = sessions[0];
      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      // Check if session is expired
      if (new Date(session.expiresAt) <= new Date()) {
        return { valid: false, reason: 'Session expired' };
      }

      // Check for IP address changes (basic security check)
      if (session.ipAddress && session.ipAddress !== currentIp) {
        console.warn(`IP address changed for session ${sessionId}: ${session.ipAddress} -> ${currentIp}`);
        // For a financial app, we might want to invalidate on IP change
        // For now, just log it
      }

      // Check for significant user agent changes
      if (session.userAgent && session.userAgent !== currentUserAgent) {
        console.warn(`User agent changed for session ${sessionId}`);
        // Could indicate session hijacking
      }

      return { valid: true };
    } catch (error) {
      console.error('Session security validation failed:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }
}

/**
 * Middleware-style session security validator
 */
export async function validateSessionSecurity(
  sessionId: string,
  request: globalThis.Request
): Promise<boolean> {
  const ip = request.headers.get('cf-connecting-ip') || 
             request.headers.get('x-forwarded-for') || 
             'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const validation = await SessionManager.validateSessionSecurity(sessionId, ip, userAgent);
  
  if (!validation.valid) {
    console.warn(`Session security validation failed: ${validation.reason}`);
    return false;
  }

  return true;
}