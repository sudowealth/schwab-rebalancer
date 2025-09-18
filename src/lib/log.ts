/**
 * Log security-related events with enhanced tracking
 */
export async function logSecurityEvent(
  eventType: string,
  category: 'AUTH_SUCCESS' | 'AUTH_FAILED' | 'ADMIN_ACTION' | 'SYSTEM_ERROR' | 'MAINTENANCE',
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    // Enhanced security logging with IP and user agent tracking
    const enhancedDetails = {
      ...details,
      eventType,
      category,
      timestamp: new Date().toISOString(),
      // These will be populated by the caller if available
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown',
    };

    // Log to console with security prefix
    console.log(`🔒 SECURITY EVENT [${category}]: ${eventType}`, enhancedDetails);

    // In production, this should also write to a security audit log
    // For now, we'll just log to console with enhanced formatting

    // TODO: Implement persistent security audit logging to database
    // This would involve writing to the audit_log table with proper categorization
  } catch (error) {
    // Fail silently to avoid breaking the application flow
    console.error('Failed to log security event:', error);
  }
}
