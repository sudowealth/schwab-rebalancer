import { ForbiddenError, UnauthorizedError } from './secure-auth';

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends Error {
  constructor(
    message: string,
    public service: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

export class RebalanceError extends Error {
  constructor(
    message: string,
    public portfolioId?: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'RebalanceError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error occurred';
}

export function logError(error: unknown, context?: string, metadata?: Record<string, unknown>) {
  const errorMessage = getErrorMessage(error);
  const logEntry = {
    message: errorMessage,
    context,
    metadata,
    timestamp: new Date().toISOString(),
    stack: error instanceof Error ? error.stack : undefined,
  };

  console.error('Error:', logEntry);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
  context?: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        logError(error, `${context} - Final attempt failed`, { attempt, maxRetries });
        throw error;
      }

      if (
        error instanceof ValidationError ||
        error instanceof UnauthorizedError ||
        error instanceof ForbiddenError
      ) {
        throw error;
      }

      const waitTime = delay * 2 ** (attempt - 1);
      logError(error, `${context} - Retry attempt ${attempt}`, { attempt, waitTime });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

export function handleServerError(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    logError(error, 'Unauthorized access attempt');
    return new Response('Unauthorized', { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    logError(error, 'Forbidden access attempt');
    return new Response('Forbidden', { status: 403 });
  }

  if (error instanceof ValidationError) {
    logError(error, 'Validation error');
    return new Response(JSON.stringify({ error: error.message, field: error.field }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (error instanceof DatabaseError) {
    logError(error, 'Database error', { originalError: error.originalError });
    return new Response('Database operation failed', { status: 500 });
  }

  if (error instanceof ExternalServiceError) {
    logError(error, 'External service error', {
      service: error.service,
      originalError: error.originalError,
    });
    return new Response(`${error.service} service unavailable`, { status: 503 });
  }

  if (error instanceof RebalanceError) {
    logError(error, 'Rebalance error', {
      portfolioId: error.portfolioId,
      originalError: error.originalError,
    });
    return new Response(JSON.stringify({ error: error.message, portfolioId: error.portfolioId }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  logError(error, 'Unhandled server error');
  return new Response('Internal Server Error', { status: 500 });
}
