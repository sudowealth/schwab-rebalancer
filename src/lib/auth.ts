import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { reactStartCookies } from "better-auth/react-start";
import * as schema from "../db/schema";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";
import { getDatabase } from "./db-config";
import { getSecurityConfig } from "./security-config";

const getAuthDatabase = () => {
  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "development"
  ) {
    console.log("🗄️ Initializing auth database...");
    const db = getDatabase();
    console.log("✅ Auth database initialized (using migrated D1 database)");
    return db;
  }

  // For production, would need to configure D1 adapter separately
  throw new Error("Production database not configured");
};

const createSafeAdapter = () => {
  const db = getAuthDatabase();

  const adapter = drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.authAccount,
      verification: schema.verification,
    },
  });

  return adapter;
};

// Dynamic base URL detection for localhost and local HTTPS
const getBaseURL = () => {
  // If explicitly set, use that
  if (process.env.AUTH_BASE_URL) {
    return process.env.AUTH_BASE_URL;
  }

  // Default to localhost for server-side
  return "http://localhost:3000";
};

export const auth = betterAuth({
  database: createSafeAdapter(),
  baseURL: getBaseURL(),
  telemetry: {
    enabled: false,
  },
  trustedOrigins: (() => {
    try {
      const securityConfig = getSecurityConfig();
      // Security config loaded successfully
      return securityConfig.allowedOrigins;
    } catch {
      console.warn("⚠️ Auth: Using fallback origins due to config error");
      // Fallback to original hardcoded origins
      return [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://127.0.0.1",
        process.env.AUTH_BASE_URL,
      ].filter(Boolean) as string[];
    }
  })(),
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false, // Don't allow users to set their own role during signup
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === "production",
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email: string; name: string };
      url: string;
    }) => {
      await sendPasswordResetEmail({
        email: user.email,
        url,
        name: user.name,
      });
    },
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email: string; name: string };
      url: string;
    }) => {
      await sendVerificationEmail({
        email: user.email,
        url,
        name: user.name,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 2, // 2 hours for better security
    updateAge: 60 * 30, // 30 minutes - more frequent updates
    cookieCache: {
      enabled: false, // Keep disabled for security
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: false, // Not needed for local HTTPS setup
    },
    useSecureCookies:
      process.env.NODE_ENV === "production" ||
      !!process.env.AUTH_BASE_URL?.startsWith("https"),
    cookiePrefix: "auth",
    generateId: () => {
      // Use crypto.randomUUID for better entropy
      return crypto.randomUUID();
    },
  },
  cookies: {
    sessionToken: {
      name: "auth.session-token",
      options: {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production" ||
          !!process.env.AUTH_BASE_URL?.startsWith("https"),
        sameSite: "lax" as const,
        path: "/",
        maxAge: 60 * 60 * 2, // 2 hours to match session expiry
      },
    },
  },
  plugins: [
    reactStartCookies(), // Essential for TanStack Start integration
  ],
});
