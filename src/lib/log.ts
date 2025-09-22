import { getEnv } from './env';

/**
 * Structured logging utility with environment-aware behavior
 */
export interface LogContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  url?: string;
  method?: string;
  component?: string;
  operation?: string;
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Structured error logging utility
 */
export function logError(
  error: Error | unknown,
  context?: LogContext,
  level: LogLevel = 'error',
): void {
  const env = getEnv();
  const isDevelopment = env.NODE_ENV === 'development';

  // Create structured log entry
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    error: {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined,
    },
    context: context || {},
    environment: env.NODE_ENV,
    service: 'schwab-rebalancer',
  };

  if (isDevelopment) {
    // In development: Log to console with colors and full details
    console.group(`🚨 [${level.toUpperCase()}] ${logEntry.error.message}`);
    console.error('Error:', logEntry.error);
    if (context && Object.keys(context).length > 0) {
      console.log('Context:', context);
    }
    console.log('Timestamp:', logEntry.timestamp);
    console.groupEnd();
  } else {
    // In production: Structured JSON logging for log aggregation
    console.error(JSON.stringify(logEntry));

    // TODO: Send to error reporting service (e.g., Sentry, LogRocket)
    // This would involve calling an error reporting service API
    // Example: errorReporter.captureException(error, { extra: context });
  }
}

/**
 * Structured info logging utility
 */
export function logInfo(message: string, context?: LogContext): void {
  const env = getEnv();
  const isDevelopment = env.NODE_ENV === 'development';

  const logEntry = {
    level: 'info' as const,
    timestamp: new Date().toISOString(),
    message,
    context: context || {},
    environment: env.NODE_ENV,
    service: 'schwab-rebalancer',
  };

  if (isDevelopment) {
    console.log(`ℹ️ [INFO] ${message}`, context);
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Structured warning logging utility
 */
export function logWarn(message: string, context?: LogContext): void {
  const env = getEnv();
  const isDevelopment = env.NODE_ENV === 'development';

  const logEntry = {
    level: 'warn' as const,
    timestamp: new Date().toISOString(),
    message,
    context: context || {},
    environment: env.NODE_ENV,
    service: 'schwab-rebalancer',
  };

  if (isDevelopment) {
    console.warn(`⚠️ [WARN] ${message}`, context);
  } else {
    console.warn(JSON.stringify(logEntry));
  }
}

/**
 * Log security-related events with enhanced tracking
 */
export async function logSecurityEvent(
  eventType: string,
  category: 'AUTH_SUCCESS' | 'AUTH_FAILED' | 'ADMIN_ACTION' | 'SYSTEM_ERROR' | 'MAINTENANCE',
  details: LogContext = {},
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

    const env = getEnv();
    const isDevelopment = env.NODE_ENV === 'development';

    if (isDevelopment) {
      // In development: Console logging with security prefix
      console.log(`🔒 SECURITY EVENT [${category}]: ${eventType}`, enhancedDetails);
    } else {
      // In production: Structured JSON logging
      const logEntry = {
        level: 'info' as const,
        timestamp: new Date().toISOString(),
        message: `Security event: ${eventType}`,
        context: enhancedDetails,
        environment: env.NODE_ENV,
        service: 'schwab-rebalancer',
        securityEvent: true,
      };
      console.log(JSON.stringify(logEntry));
    }

    // TODO: Implement persistent security audit logging to database
    // This would involve writing to the audit_log table with proper categorization
  } catch (error) {
    // Fail silently to avoid breaking the application flow, but log the logging failure
    console.error('Failed to log security event:', error);
  }
}

/**
 * Performance logging utility
 */
export function logPerformance(operation: string, duration: number, context?: LogContext): void {
  const env = getEnv();
  const isDevelopment = env.NODE_ENV === 'development';

  const logEntry = {
    level: 'info' as const,
    timestamp: new Date().toISOString(),
    message: `Performance: ${operation} took ${duration}ms`,
    context: {
      ...context,
      operation,
      duration,
      performanceMetric: true,
    },
    environment: env.NODE_ENV,
    service: 'schwab-rebalancer',
  };

  if (isDevelopment) {
    console.log(`⚡ [PERF] ${operation}: ${duration}ms`, context);
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Create a performance timer utility
 */
export function createPerformanceTimer(operation: string, context?: LogContext) {
  const startTime = Date.now();

  return {
    end: () => {
      const duration = Date.now() - startTime;
      logPerformance(operation, duration, context);
      return duration;
    },
  };
}
