/**
 * Utility functions for sanitizing sensitive identifiers in logs and displays
 */

/**
 * Sanitizes a Schwab account ID by showing first 8 characters and last 3 characters
 * @param accountId - The full Schwab account ID
 * @returns Sanitized account ID in format "XXXXXXXX...XXX"
 */
export function sanitizeSchwabAccountId(accountId: string): string {
  if (!accountId || accountId.length < 4) {
    return accountId;
  }
  return `${accountId.substring(0, 8)}...${accountId.substring(accountId.length - 3)}`;
}

/**
 * Sanitizes an account number by showing only the last 3 characters
 * @param accountNumber - The full account number
 * @returns Sanitized account number in format "...XXX"
 */
export function sanitizeAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) {
    return accountNumber;
  }
  return `...${accountNumber.substring(accountNumber.length - 3)}`;
}

/**
 * Sanitizes a user ID by showing first 10 characters
 * @param userId - The full user ID
 * @returns Sanitized user ID in format "XXXXXXXXXX..."
 */
export function sanitizeUserId(userId: string): string {
  if (!userId || userId.length < 11) {
    return userId;
  }
  return `${userId.substring(0, 10)}...`;
}
