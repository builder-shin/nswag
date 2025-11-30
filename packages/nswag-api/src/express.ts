/**
 * Express middleware
 * Exposes OpenAPI specs as JSON/YAML endpoints in Express apps
 *
 * @example
 * ```typescript
 * import { nswagApi } from '@aspect/nswag-api/express';
 *
 * app.use('/api-docs', nswagApi({
 *   openapiRoot: './openapi',
 * }));
 *
 * // GET /api-docs/v1/openapi.json -> returns ./openapi/v1/openapi.json contents
 * // GET /api-docs/v2/openapi.yaml -> returns ./openapi/v2/openapi.yaml contents
 * ```
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { resolve } from 'node:path';
import {
  parseRequestPath,
  loadOpenAPIFile,
  serializeOpenAPI,
  getContentType,
  cloneOpenAPI,
} from './spec-loader.js';
import { validateAuth, getAuthErrorStatusCode } from './auth.js';
import {
  getCorsHeaders,
  getPreflightHeaders,
  isPreflightRequest,
  getOriginFromHeaders,
} from './cors.js';
import {
  DEFAULT_OPTIONS,
  type ExpressNswagApiOptions,
  type ExpressRequest,
} from './types.js';

/**
 * Create Express middleware
 * Provides OpenAPI specs as JSON/YAML endpoints
 *
 * @param options - Middleware configuration
 * @returns Express middleware
 */
export function nswagApi(options: ExpressNswagApiOptions): RequestHandler {
  const {
    openapiRoot,
    cache = DEFAULT_OPTIONS.cache,
    cors = DEFAULT_OPTIONS.cors,
    auth,
    openapiFilter,
    openapiHeaders = DEFAULT_OPTIONS.openapiHeaders,
  } = options;

  // Convert openapiRoot to absolute path
  const absoluteRoot = resolve(process.cwd(), openapiRoot);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only handle GET or OPTIONS methods
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      next();
      return;
    }

    // Handle CORS preflight request
    if (isPreflightRequest(req.method)) {
      if (cors.enabled) {
        const origin = getOriginFromHeaders(req.headers as Record<string, string | string[] | undefined>);
        const preflightHeaders = getPreflightHeaders(origin, cors);

        if (preflightHeaders) {
          Object.entries(preflightHeaders).forEach(([key, value]) => {
            if (value) res.setHeader(key, value);
          });
          res.status(204).end();
          return;
        }
      }
      // CORS is disabled or origin is not allowed
      res.status(204).end();
      return;
    }

    // Parse request path
    const fileInfo = parseRequestPath(req.path, absoluteRoot);
    if (!fileInfo) {
      next();
      return;
    }

    // Validate authentication
    if (auth?.enabled) {
      const authResult = validateAuth(
        req.headers as Record<string, string | string[] | undefined>,
        auth
      );

      if (!authResult.success) {
        const statusCode = getAuthErrorStatusCode(auth);
        if (authResult.wwwAuthenticate) {
          res.setHeader('WWW-Authenticate', authResult.wwwAuthenticate);
        }
        res.status(statusCode).json({
          error: authResult.error,
        });
        return;
      }
    }

    // Set CORS headers
    if (cors.enabled) {
      const origin = getOriginFromHeaders(req.headers as Record<string, string | string[] | undefined>);
      const corsHeaders = getCorsHeaders(origin, cors);

      if (corsHeaders) {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          if (value) res.setHeader(key, value);
        });
      }
    }

    // Load OpenAPI file
    let spec = loadOpenAPIFile(fileInfo.absolutePath, cache);
    if (!spec) {
      res.status(404).json({
        error: 'OpenAPI spec not found',
        path: fileInfo.relativePath,
      });
      return;
    }

    // Apply dynamic filter
    if (openapiFilter) {
      try {
        // Create a copy to prevent modifying the original
        spec = cloneOpenAPI(spec);
        const expressReq: ExpressRequest = {
          headers: req.headers as Record<string, string | string[] | undefined>,
          session: (req as unknown as { session?: ExpressRequest['session'] }).session,
          path: req.path,
          method: req.method,
        };
        spec = await openapiFilter(spec, expressReq);
      } catch (error) {
        res.status(500).json({
          error: 'Filter error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        return;
      }
    }

    // Set response headers
    const contentType = getContentType(fileInfo.format);
    res.setHeader('Content-Type', contentType);

    // Apply custom headers
    Object.entries(openapiHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') res.setHeader(key, value);
    });

    // Send response
    const body = serializeOpenAPI(spec, fileInfo.format);
    res.send(body);
  };
}

// Default export
export default nswagApi;
