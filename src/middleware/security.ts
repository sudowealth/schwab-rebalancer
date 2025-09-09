/**
 * Security Middleware for Cloudflare Workers
 * Handles CORS, CSP, and other security headers for the tax-loss harvesting platform
 */

// Cloudflare Workers Web API types
declare global {
  interface Request {}
  interface Response {}
  interface Headers {}
}

export interface SecurityConfig {
  allowedOrigins: string[];
  environment: 'development' | 'production';
  enableStrictCSP: boolean;
}

export class SecurityHeaders {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  /**
   * Get CORS headers based on request origin
   */
  private getCORSHeaders(origin: string | null): Record<string, string> {
    const headers: Record<string, string> = {};

    // Check if origin is allowed
    const isAllowedOrigin = origin && this.config.allowedOrigins.includes(origin);

    if (isAllowedOrigin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    } else if (this.config.environment === 'development') {
      // In development, be more permissive but log warnings
      console.warn(`🚨 CORS: Unrecognized origin in development: ${origin}`);
      headers['Access-Control-Allow-Origin'] = origin || '*';
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
    // In production, we don't set CORS headers for unrecognized origins

    // Common CORS headers
    if (headers['Access-Control-Allow-Origin']) {
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers'] =
        'Content-Type, Authorization, X-Requested-With, X-CSRF-Token';
      headers['Access-Control-Max-Age'] = '86400'; // 24 hours
    }

    return headers;
  }

  /**
   * Get Content Security Policy header optimized for React/TanStack Start
   */
  private getCSPHeader(): string {
    const policies = [];

    if (this.config.enableStrictCSP) {
      // Strict CSP for production financial application
      policies.push(
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React needs unsafe-inline and unsafe-eval
        "style-src 'self' 'unsafe-inline'", // CSS-in-JS needs unsafe-inline
        "img-src 'self' data: https:", // Allow images from CDNs and data URLs
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self'", // API calls only to same origin
        "frame-ancestors 'none'", // Prevent clickjacking
        "frame-src 'none'", // No embedded frames
        "object-src 'none'", // No plugins
        "base-uri 'self'", // Prevent base tag hijacking
        "form-action 'self'", // Forms only submit to same origin
        'upgrade-insecure-requests', // Force HTTPS
      );
    } else {
      // Development CSP - more permissive
      policies.push(
        "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: http:",
        "font-src 'self' https: data:",
        "connect-src 'self' ws: wss:", // Allow WebSocket for dev server
        "frame-ancestors 'self'",
        "base-uri 'self'",
      );
    }

    return policies.join('; ');
  }

  /**
   * Get all security headers
   */
  getSecurityHeaders(origin: string | null): Record<string, string> {
    const corsHeaders = this.getCORSHeaders(origin);

    const securityHeaders = {
      // Content Security Policy
      'Content-Security-Policy': this.getCSPHeader(),

      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',

      // Clickjacking protection
      'X-Frame-Options': 'DENY',

      // XSS protection (legacy but still useful)
      'X-XSS-Protection': '1; mode=block',

      // Force HTTPS (only in production)
      ...(this.config.environment === 'production' && {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      }),

      // Referrer policy for privacy
      'Referrer-Policy': 'strict-origin-when-cross-origin',

      // Permissions policy (restrict sensitive APIs)
      'Permissions-Policy':
        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), ' +
        'accelerometer=(), gyroscope=(), magnetometer=(), serial=()',

      // Cache control for security-sensitive pages
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    };

    return { ...corsHeaders, ...securityHeaders };
  }

  /**
   * Handle CORS preflight requests
   */
  handlePreflight(request: Request): Response {
    const origin = request.headers.get('Origin');
    const headers = this.getCORSHeaders(origin);

    if (!headers['Access-Control-Allow-Origin']) {
      return new Response('CORS request not allowed', { status: 403 });
    }

    return new Response(null, {
      status: 204,
      headers,
    });
  }

  /**
   * Apply security headers to a response
   */
  applyHeaders(response: Response, origin: string | null): Response {
    const headers = this.getSecurityHeaders(origin);

    // Create new response with security headers
    const secureResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });

    // Add security headers
    Object.entries(headers).forEach(([key, value]) => {
      secureResponse.headers.set(key, value);
    });

    return secureResponse;
  }
}

/**
 * Security middleware factory
 */
export function createSecurityMiddleware(config: SecurityConfig) {
  const security = new SecurityHeaders(config);

  return {
    /**
     * Main middleware function for Cloudflare Workers
     */
    async handle(request: Request, next: () => Promise<Response>): Promise<Response> {
      const origin = request.headers.get('Origin');
      const method = request.method;

      // Handle CORS preflight requests
      if (method === 'OPTIONS') {
        return security.handlePreflight(request);
      }

      // Process the request
      const response = await next();

      // Apply security headers to the response
      return security.applyHeaders(response, origin);
    },

    /**
     * Validate origin for API requests
     */
    validateOrigin(request: Request): boolean {
      const origin = request.headers.get('Origin');

      if (!origin) {
        // Same-origin requests don't have Origin header
        return true;
      }

      return config.allowedOrigins.includes(origin) || config.environment === 'development';
    },

    /**
     * Get security configuration
     */
    getConfig(): SecurityConfig {
      return { ...config };
    },
  };
}
