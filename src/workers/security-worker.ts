/**
 * Cloudflare Workers Security Handler
 * This file shows how to integrate the security middleware with Cloudflare Workers
 */

// Cloudflare Workers Web API types
declare global {
  interface Request {}
  interface Response {}
  interface Headers {}
  interface URL {}
  interface ExecutionContext {}
}

import { getSecurityConfig, validateSecurityConfig } from '../lib/security-config';
import { createSecurityMiddleware } from '../middleware/security';

// Environment interface for Cloudflare Workers
interface Env {
  ALLOWED_ORIGINS?: string;
  ENABLE_STRICT_CSP?: string;
  NODE_ENV?: string;
  AUTH_BASE_URL?: string;
  [key: string]: unknown;
}

/**
 * Initialize security middleware for Cloudflare Workers
 */
function initializeSecurityMiddleware(env: Env) {
  // Set environment variables for getSecurityConfig
  if (env.ALLOWED_ORIGINS) process.env.ALLOWED_ORIGINS = env.ALLOWED_ORIGINS;
  if (env.ENABLE_STRICT_CSP) process.env.ENABLE_STRICT_CSP = env.ENABLE_STRICT_CSP;
  if (env.NODE_ENV) process.env.NODE_ENV = env.NODE_ENV;
  if (env.AUTH_BASE_URL) process.env.AUTH_BASE_URL = env.AUTH_BASE_URL;

  // Validate security configuration
  validateSecurityConfig();

  // Get security config and create middleware
  const securityConfig = getSecurityConfig();
  return createSecurityMiddleware(securityConfig);
}

/**
 * Main Cloudflare Workers fetch handler with security middleware
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Initialize security middleware
      const securityMiddleware = initializeSecurityMiddleware(env);

      // Apply security middleware
      return await securityMiddleware.handle(request, async () => {
        // Your application logic goes here
        return await handleApplicationRequest(request, env, ctx);
      });
    } catch (error) {
      console.error('🚨 Security Worker Error:', error);

      // Return safe error response
      return new Response('Internal Server Error', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      });
    }
  },
};

/**
 * Handle application requests (replace with your actual application logic)
 */
async function handleApplicationRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);

  // Example API routes
  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(request, env);
  }

  // Example: serve static assets or your main application
  if (url.pathname === '/') {
    return new Response('Tax-Loss Harvesting Platform', {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Example: health check endpoint
  if (url.pathname === '/health') {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        security: 'enabled',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * Handle API requests with additional security checks
 */
async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Example: Check for required headers
  const contentType = request.headers.get('Content-Type');
  if (request.method === 'POST' && !contentType?.includes('application/json')) {
    return new Response('Invalid Content-Type', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Example: Rate limiting (you can integrate with Cloudflare Rate Limiting)
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  console.log(`API Request from IP: ${clientIP} to ${url.pathname}`);

  // Example API endpoints
  switch (url.pathname) {
    case '/api/security/config':
      return new Response(
        JSON.stringify({
          corsEnabled: true,
          cspEnabled: true,
          environment: env.NODE_ENV || 'development',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

    default:
      return new Response('API endpoint not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
  }
}

/**
 * Example wrangler.toml configuration
 *
 * [env.production.vars]
 * ALLOWED_ORIGINS = "https://your-domain.com,https://www.your-domain.com"
 * ENABLE_STRICT_CSP = "true"
 * NODE_ENV = "production"
 * AUTH_BASE_URL = "https://your-domain.com"
 *
 * [env.development.vars]
 * ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:3001"
 * ENABLE_STRICT_CSP = "false"
 * NODE_ENV = "development"
 * AUTH_BASE_URL = "http://localhost:3000"
 */
