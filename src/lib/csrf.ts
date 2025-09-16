import { ForbiddenError } from './errors';

export function generateCsrfToken(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64url');
  }
  return Buffer.from(String(Math.random())).toString('base64url');
}

export function getCsrfFromHeaders(headers: Headers): string | null {
  return headers.get('x-csrf-token');
}

export function getCsrfCookie(headers: Headers): string | null {
  const cookie = headers.get('cookie') || '';
  const match = cookie.match(/csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function verifyCsrf(headers: Headers): void {
  const headerToken = getCsrfFromHeaders(headers);
  const cookieToken = getCsrfCookie(headers);
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    throw new ForbiddenError('Invalid CSRF token');
  }
}
