/**
 * CORS handler
 * Cross-Origin Resource Sharing processing
 */

import type { CorsConfig } from './types.js';

/**
 * CORS response headers type
 */
export interface CorsHeaders {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Methods': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Max-Age'?: string;
  'Access-Control-Allow-Credentials'?: string;
  'Vary': string;
}

/**
 * Check if request is a CORS preflight request
 * @param method - HTTP method
 * @returns Whether it's a preflight request
 */
export function isPreflightRequest(method: string): boolean {
  return method.toUpperCase() === 'OPTIONS';
}

/**
 * Check if request origin is in the allowed list
 * @param origin - Request origin
 * @param allowedOrigins - List of allowed origins
 * @returns Whether origin is allowed
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[]
): boolean {
  if (!origin) {
    return false;
  }

  // Allow all origins (*)
  if (allowedOrigins.includes('*')) {
    return true;
  }

  // Check for exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check wildcard patterns (e.g., *.example.com)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      if (origin.endsWith(domain)) {
        // Check subdomain (e.g., sub.example.com)
        const subdomain = origin.slice(0, -domain.length);
        if (subdomain.endsWith('.') || subdomain === '') {
          continue;
        }
        // https://sub.example.com -> protocol + subdomain
        const match = origin.match(new RegExp(`^(https?://)?[^/]+\\.${escapeRegExp(domain)}$`));
        if (match) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Escape regex special characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate CORS headers
 * @param origin - Request origin
 * @param corsConfig - CORS configuration
 * @returns CORS headers object or null (CORS disabled or origin not allowed)
 */
export function getCorsHeaders(
  origin: string | undefined,
  corsConfig: CorsConfig
): Partial<CorsHeaders> | null {
  // If CORS is disabled
  if (!corsConfig.enabled) {
    return null;
  }

  // If origin is missing or not allowed
  if (!isOriginAllowed(origin, corsConfig.origins)) {
    return null;
  }

  const allowedOrigin = corsConfig.origins.includes('*') ? '*' : origin!;

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Vary': 'Origin',
  };
}

/**
 * Generate response headers for preflight request
 * @param origin - Request origin
 * @param corsConfig - CORS configuration
 * @returns Preflight response headers or null
 */
export function getPreflightHeaders(
  origin: string | undefined,
  corsConfig: CorsConfig
): Partial<CorsHeaders> | null {
  const headers = getCorsHeaders(origin, corsConfig);
  if (!headers) {
    return null;
  }

  return {
    ...headers,
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Extract origin from headers
 * @param headers - Request headers
 * @returns Origin string or undefined
 */
export function getOriginFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const origin = headers['origin'] || headers['Origin'];
  if (typeof origin === 'string') {
    return origin;
  }
  if (Array.isArray(origin)) {
    return origin[0];
  }
  return undefined;
}
