import type { SecurityConfig } from '../middleware/security';
import { getEnv } from './env';

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(): SecurityConfig {
  const env = getEnv();
  const nodeEnv = env.NODE_ENV || process.env.NODE_ENV || 'development';

  // Parse allowed origins from environment variable
  const getAllowedOrigins = (): string[] => {
    const envOrigins = env.ALLOWED_ORIGINS;

    if (envOrigins) {
      // Parse comma-separated origins from environment
      return envOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    }

    // Default origins based on environment
    if (nodeEnv === 'production') {
      return [
        // Add your production domains here
        'https://your-domain.com',
        'https://www.your-domain.com',
        // Add staging domain if applicable
        'https://staging.your-domain.com',
      ];
    }
    // Development origins
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'https://127.0.0.1', // Local HTTPS via Caddy
      env.AUTH_BASE_URL, // Include auth base URL if set
    ].filter(Boolean) as string[];
  };

  const allowedOrigins = getAllowedOrigins();
  const enableStrictCSP = env.ENABLE_STRICT_CSP === 'true' || nodeEnv === 'production';

  // Only log in development and keep it minimal
  // Security configuration loaded silently

  return {
    allowedOrigins,
    environment: nodeEnv as 'development' | 'production',
    enableStrictCSP,
  };
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(): void {
  const config = getSecurityConfig();

  if (config.environment === 'production') {
    // Production-specific validations
    if (config.allowedOrigins.length === 0) {
      throw new Error('🚨 SECURITY: No allowed origins configured for production');
    }

    // Check for localhost origins in production (should not exist)
    const localhostOrigins = config.allowedOrigins.filter(
      (origin) => origin.includes('localhost') || origin.includes('127.0.0.1'),
    );

    if (localhostOrigins.length > 0) {
      console.warn(
        '⚠️ SECURITY WARNING: Localhost origins found in production config:',
        localhostOrigins,
      );
    }

    // Ensure HTTPS origins in production
    const httpOrigins = config.allowedOrigins.filter(
      (origin) => origin.startsWith('http://') && !origin.includes('localhost'),
    );

    if (httpOrigins.length > 0) {
      throw new Error(
        `🚨 SECURITY: HTTP origins not allowed in production: ${httpOrigins.join(', ')}`,
      );
    }

    if (!config.enableStrictCSP) {
      console.warn('⚠️ SECURITY WARNING: Strict CSP disabled in production');
    }
  }

  // Security configuration validated
}
