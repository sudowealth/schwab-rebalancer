import { ForbiddenError, UnauthorizedError } from './errors';

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
  if (error == null) return;

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
