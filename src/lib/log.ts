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

/**
 * Sensitive data fields that should be sanitized from logs
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'credential',
  'balance',
  'accountValue',
  'cash',
  'quantity',
  'price',
  'value',
  'amount',
  'accountNumber',
  'accountId',
  'positions',
  'holdings',
  'transactions',
  'apiKey',
  'authToken',
  'sessionToken',
  'creditCard',
  'ssn',
  'socialSecurity',
  'email', // Only in certain contexts
  'phone',
  'address',
]);

/**
 * Sanitizes log context by removing or masking sensitive data
 */
function sanitizeLogContext(context: LogContext): LogContext {
  if (!context || typeof context !== 'object') {
    return context;
  }

  const sanitized = { ...context };

  // Remove sensitive fields
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const [key, value] of Object.entries(sanitized)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogContext(value as LogContext);
    } else if (Array.isArray(value)) {
      // For arrays, check if they contain sensitive objects
      sanitized[key] = value.map((item) => {
        if (item && typeof item === 'object') {
          return sanitizeLogContext(item as LogContext);
        }
        return item;
      });
    }
  }

  return sanitized;
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

  // Create structured log entry with sanitized context
  const logEntry = {
    level,
    timestamp: new Date().toISOString(),
    error: {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined,
    },
    context: sanitizeLogContext(context || {}),
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
