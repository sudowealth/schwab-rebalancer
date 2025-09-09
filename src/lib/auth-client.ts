import { createAuthClient } from 'better-auth/react';

// Dynamic auth base URL that works with both localhost and local HTTPS
const getAuthBaseURL = () => {
  if (typeof window !== 'undefined') {
    // Client-side: always use current origin (works for both localhost and HTTPS)
    return window.location.origin;
  }

  // Server-side: use environment variable or default to localhost
  return process.env.AUTH_BASE_URL || 'http://localhost:3000';
};

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
