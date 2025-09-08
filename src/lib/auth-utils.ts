import { auth } from "./auth";
import { getWebRequest } from "@tanstack/react-start/server";

// Type definitions for user roles
export type UserRole = "user" | "admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
}

export interface AuthResult {
  user: AuthenticatedUser;
}

/**
 * Get the current session and user information
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const request = getWebRequest();
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      role: (session.user as { role?: string }).role as UserRole || "user",
      name: session.user.name,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(): Promise<AuthResult> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Authentication required");
  }

  return { user };
}

/**
 * Require admin role - throws error if not admin
 */
export async function requireAdmin(): Promise<AuthResult> {
  const { user } = await requireAuth();

  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }

  return { user };
}

/**
 * Check if current user has admin role
 * Returns false if not authenticated or not admin
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return user?.role === "admin";
  } catch {
    return false;
  }
}

/**
 * Check if current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Check if current user can access resource
 * Admins can access everything, regular users only their own resources
 */
export async function canAccessResource(resourceUserId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    
    // Admins can access everything
    if (user.role === "admin") return true;
    
    // Regular users can only access their own resources
    return user.id === resourceUserId;
  } catch {
    return false;
  }
}

/**
 * Require access to a resource - throws error if no access
 */
export async function requireResourceAccess(resourceUserId: string): Promise<AuthResult> {
  const { user } = await requireAuth();
  
  // Admins can access everything
  if (user.role === "admin") {
    return { user };
  }
  
  // Regular users can only access their own resources
  if (user.id !== resourceUserId) {
    throw new Error("Access denied: insufficient permissions");
  }
  
  return { user };
}