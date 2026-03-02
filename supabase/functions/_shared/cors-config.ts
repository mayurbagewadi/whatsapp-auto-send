/**
 * CORS SECURITY CONFIGURATION
 *
 * CRITICAL: Never use wildcards (*) in production
 *
 * SECURITY LAYERS:
 * 1. Browser CORS enforcement (first check)
 * 2. Server-side origin validation (second check)
 * 3. Request signing with JWT (third check)
 */

/**
 * Allowed origins
 * PRODUCTION: Add your actual domain(s)
 */
export const ALLOWED_ORIGINS = [
  // Local development
  'http://localhost:3000',
  'http://localhost:5000',

  // Your production domain (ADD YOUR DOMAIN HERE)
  'https://yourdomain.com',
  'https://app.yourdomain.com',

  // Chrome Extension (special handling)
  // Note: Chrome extensions appear as chrome-extension://xxxxx
];

/**
 * Generate CORS headers based on request origin
 *
 * SECURITY:
 * - Only allow specific origins
 * - Deny if origin not in whitelist
 * - Always require credentials for sensitive operations
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  // For local testing only - remove in production
  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';

  let allowedOrigin = '';

  if (isDevelopment && requestOrigin) {
    // In development, allow localhost
    if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
      allowedOrigin = requestOrigin;
    }
  } else if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    // In production, only allow whitelisted origins
    allowedOrigin = requestOrigin;
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin || 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Validate request origin
 * Returns true if origin is allowed, false otherwise
 */
export function isOriginAllowed(requestOrigin: string | null): boolean {
  if (!requestOrigin) return false;

  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';

  if (isDevelopment) {
    // Allow localhost in development
    return requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1');
  }

  // In production, require explicit whitelist match
  return ALLOWED_ORIGINS.includes(requestOrigin);
}

/**
 * CORS MIGRATION GUIDE:
 *
 * 1. Current Setup:
 *    - Allow all origins (*)
 *    - Security risk: anyone can call your functions
 *
 * 2. Step 1: Add this to functions
 *    - Get request origin
 *    - Validate against whitelist
 *    - Return appropriate headers
 *
 * 3. Step 2: Update whitelist with production domain
 *    - Replace 'https://yourdomain.com' with actual domain
 *    - Add all client domains (mobile, web, admin)
 *
 * 4. Step 3: Deploy and monitor
 *    - Check logs for CORS rejections
 *    - Add legit domains if needed
 *    - Block suspicious origins
 *
 * 5. Step 4: Advanced security
 *    - Use AWS WAF for rate limiting
 *    - Enable DDoS protection
 *    - Monitor for abuse patterns
 */
