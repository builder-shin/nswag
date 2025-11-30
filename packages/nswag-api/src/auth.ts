/**
 * Authentication handler
 * Supports Basic, Bearer, and API-Key authentication
 */

import type { AuthConfig } from './types.js';

/**
 * Authentication result type
 */
export interface AuthResult {
  /** Whether authentication succeeded */
  success: boolean;
  /** Error message on failure */
  error?: string;
  /** WWW-Authenticate header value */
  wwwAuthenticate?: string;
}

/**
 * Parse Basic authentication credentials
 * @param authHeader - Authorization header value
 * @returns { username, password } or null
 */
function parseBasicAuth(authHeader: string): { username: string; password: string } | null {
  const match = authHeader.match(/^Basic\s+(.+)$/i);
  if (!match || !match[1]) {
    return null;
  }

  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, colonIndex),
      password: decoded.slice(colonIndex + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Parse Bearer token
 * @param authHeader - Authorization header value
 * @returns Token string or null
 */
function parseBearerToken(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Validate authentication information from request headers
 * @param headers - Request headers
 * @param authConfig - Authentication configuration
 * @returns Authentication result
 */
export function validateAuth(
  headers: Record<string, string | string[] | undefined>,
  authConfig: AuthConfig
): AuthResult {
  // If authentication is disabled
  if (!authConfig.enabled) {
    return { success: true };
  }

  const { type, credentials } = authConfig;

  switch (type) {
    case 'basic': {
      const authHeader = getHeader(headers, 'authorization');
      if (!authHeader) {
        return {
          success: false,
          error: 'Authorization header required',
          wwwAuthenticate: 'Basic realm="OpenAPI Documentation"',
        };
      }

      const parsed = parseBasicAuth(authHeader);
      if (!parsed) {
        return {
          success: false,
          error: 'Invalid Basic auth format',
          wwwAuthenticate: 'Basic realm="OpenAPI Documentation"',
        };
      }

      if (
        parsed.username !== credentials.username ||
        parsed.password !== credentials.password
      ) {
        return {
          success: false,
          error: 'Invalid credentials',
          wwwAuthenticate: 'Basic realm="OpenAPI Documentation"',
        };
      }

      return { success: true };
    }

    case 'bearer': {
      const authHeader = getHeader(headers, 'authorization');
      if (!authHeader) {
        return {
          success: false,
          error: 'Authorization header required',
          wwwAuthenticate: 'Bearer realm="OpenAPI Documentation"',
        };
      }

      const token = parseBearerToken(authHeader);
      if (!token) {
        return {
          success: false,
          error: 'Invalid Bearer token format',
          wwwAuthenticate: 'Bearer realm="OpenAPI Documentation"',
        };
      }

      if (token !== credentials.token) {
        return {
          success: false,
          error: 'Invalid token',
          wwwAuthenticate: 'Bearer realm="OpenAPI Documentation", error="invalid_token"',
        };
      }

      return { success: true };
    }

    case 'api-key': {
      const headerName = credentials.headerName || 'X-API-Key';
      const apiKey = getHeader(headers, headerName.toLowerCase());

      if (!apiKey) {
        return {
          success: false,
          error: `${headerName} header required`,
        };
      }

      if (apiKey !== credentials.apiKey) {
        return {
          success: false,
          error: 'Invalid API key',
        };
      }

      return { success: true };
    }

    default:
      return {
        success: false,
        error: `Unknown auth type: ${type}`,
      };
  }
}

/**
 * Extract value from headers (case-insensitive)
 * @param headers - Request headers
 * @param name - Header name (lowercase)
 * @returns Header value or undefined
 */
function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  // Direct access attempt
  const direct = headers[name];
  if (typeof direct === 'string') {
    return direct;
  }
  if (Array.isArray(direct)) {
    return direct[0];
  }

  // Case-insensitive search
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      if (typeof value === 'string') {
        return value;
      }
      if (Array.isArray(value)) {
        return value[0];
      }
    }
  }

  return undefined;
}

/**
 * Determine status code for authentication failure response
 * @param authConfig - Authentication configuration
 * @returns HTTP status code (401 or 403)
 */
export function getAuthErrorStatusCode(authConfig: AuthConfig): number {
  // Basic and Bearer return 401, API-Key returns 403
  return authConfig.type === 'api-key' ? 403 : 401;
}
