/**
 * Basic Auth handling logic
 * Authentication middleware for protecting Swagger UI and Redoc UI
 */

import type { BasicAuthConfig } from './types.js';

/**
 * Authentication result interface
 */
export interface AuthResult {
  /** Whether authentication succeeded */
  authenticated: boolean;
  /** Response headers on authentication failure */
  headers?: Record<string, string>;
  /** Status code on authentication failure */
  statusCode?: number;
  /** Response body on authentication failure */
  body?: string;
}

/**
 * Verify Basic Auth
 *
 * @param authHeader - Authorization header value
 * @param config - Basic Auth configuration
 * @returns Authentication result
 */
export function verifyBasicAuth(
  authHeader: string | undefined,
  config: BasicAuthConfig
): AuthResult {
  // Always succeed if Basic Auth is disabled
  if (!config.enabled) {
    return { authenticated: true };
  }

  // No Authorization header
  if (!authHeader) {
    return createUnauthorizedResponse();
  }

  // Verify Basic Auth format
  if (!authHeader.startsWith('Basic ')) {
    return createUnauthorizedResponse();
  }

  try {
    // Base64 decode
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    // Verify credentials
    if (
      username === config.credentials.username &&
      password === config.credentials.password
    ) {
      return { authenticated: true };
    }

    return createUnauthorizedResponse();
  } catch {
    return createUnauthorizedResponse();
  }
}

/**
 * Create 401 Unauthorized response
 */
function createUnauthorizedResponse(): AuthResult {
  return {
    authenticated: false,
    statusCode: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="API Documentation"',
    },
    body: 'Unauthorized',
  };
}

/**
 * Create Basic Auth middleware for Express
 *
 * @param config - Basic Auth configuration
 * @returns Express middleware function
 */
export function createExpressBasicAuthMiddleware(
  config?: BasicAuthConfig
): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => void {
  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
    // Pass through if Basic Auth is not configured or disabled
    if (!config || !config.enabled) {
      return next();
    }

    const authHeader = req.headers.authorization;
    const result = verifyBasicAuth(authHeader, config);

    if (result.authenticated) {
      return next();
    }

    // Authentication failure response
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    res.status(result.statusCode ?? 401).send(result.body ?? 'Unauthorized');
  };
}

/**
 * Create Basic Auth preHandler for Fastify
 *
 * @param config - Basic Auth configuration
 * @returns Fastify preHandler function
 */
export function createFastifyBasicAuthHook(
  config?: BasicAuthConfig
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Pass through if Basic Auth is not configured or disabled
    if (!config || !config.enabled) {
      return;
    }

    const authHeader = request.headers.authorization;
    const result = verifyBasicAuth(authHeader, config);

    if (result.authenticated) {
      return;
    }

    // Authentication failure response
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        reply.header(key, value);
      });
    }
    reply.status(result.statusCode ?? 401).send(result.body ?? 'Unauthorized');
  };
}

/**
 * Basic Auth Guard logic for NestJS
 *
 * @param authHeader - Authorization header value
 * @param config - Basic Auth configuration
 * @returns Whether authentication succeeded
 */
export function validateBasicAuth(
  authHeader: string | undefined,
  config?: BasicAuthConfig
): boolean {
  if (!config || !config.enabled) {
    return true;
  }

  const result = verifyBasicAuth(authHeader, config);
  return result.authenticated;
}

// ========== Type Definitions (without Express/Fastify dependencies) ==========

/**
 * Express Request type (used without dependencies)
 */
interface ExpressRequest {
  headers: {
    authorization?: string;
  };
}

/**
 * Express Response type (used without dependencies)
 */
interface ExpressResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ExpressResponse;
  send(body: string): void;
}

/**
 * Express Next function type
 */
type ExpressNext = () => void;

/**
 * Fastify Request type (used without dependencies)
 */
interface FastifyRequest {
  headers: {
    authorization?: string;
  };
}

/**
 * Fastify Reply type (used without dependencies)
 */
interface FastifyReply {
  header(name: string, value: string): FastifyReply;
  status(code: number): FastifyReply;
  send(payload: string): FastifyReply;
}
