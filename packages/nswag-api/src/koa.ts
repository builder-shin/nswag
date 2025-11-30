/**
 * Koa middleware
 * Exposes OpenAPI specs as JSON/YAML endpoints in Koa apps
 *
 * @example
 * ```typescript
 * import { nswagApi } from '@builder-shin/nswag-api/koa';
 *
 * app.use(nswagApi({
 *   prefix: '/api-docs',
 *   openapiRoot: './openapi',
 * }));
 *
 * // GET /api-docs/v1/openapi.json -> returns ./openapi/v1/openapi.json contents
 * ```
 */

import type { Context, Next, Middleware } from 'koa';
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
  type KoaNswagApiOptions,
  type KoaContext,
} from './types.js';

/**
 * Create Koa middleware
 * Provides OpenAPI specs as JSON/YAML endpoints
 *
 * @param options - Middleware configuration
 * @returns Koa middleware
 */
export function nswagApi(options: KoaNswagApiOptions): Middleware {
  const {
    openapiRoot,
    prefix = '',
    cache = DEFAULT_OPTIONS.cache,
    cors = DEFAULT_OPTIONS.cors,
    auth,
    openapiFilter,
    openapiHeaders = DEFAULT_OPTIONS.openapiHeaders,
  } = options;

  // Convert openapiRoot to absolute path
  const absoluteRoot = resolve(process.cwd(), openapiRoot);

  return async (ctx: Context, next: Next): Promise<void> => {
    // Only handle GET or OPTIONS methods
    if (ctx.method !== 'GET' && ctx.method !== 'OPTIONS') {
      await next();
      return;
    }

    // Check if path starts with prefix
    if (prefix && !ctx.path.startsWith(prefix)) {
      await next();
      return;
    }

    // Path with prefix removed
    const relativePath = prefix ? ctx.path.slice(prefix.length) : ctx.path;
    const headers = ctx.headers as Record<string, string | string[] | undefined>;

    // Handle CORS preflight request
    if (isPreflightRequest(ctx.method)) {
      if (cors.enabled) {
        const origin = getOriginFromHeaders(headers);
        const preflightHeaders = getPreflightHeaders(origin, cors);

        if (preflightHeaders) {
          Object.entries(preflightHeaders).forEach(([key, value]) => {
            if (value) ctx.set(key, value);
          });
        }
      }
      ctx.status = 204;
      return;
    }

    // Parse request path
    const fileInfo = parseRequestPath(relativePath, absoluteRoot);
    if (!fileInfo) {
      await next();
      return;
    }

    // Validate authentication
    if (auth?.enabled) {
      const authResult = validateAuth(headers, auth);

      if (!authResult.success) {
        const statusCode = getAuthErrorStatusCode(auth);
        if (authResult.wwwAuthenticate) {
          ctx.set('WWW-Authenticate', authResult.wwwAuthenticate);
        }
        ctx.status = statusCode;
        ctx.body = {
          error: authResult.error,
        };
        return;
      }
    }

    // Set CORS headers
    if (cors.enabled) {
      const origin = getOriginFromHeaders(headers);
      const corsHeaders = getCorsHeaders(origin, cors);

      if (corsHeaders) {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          if (value) ctx.set(key, value);
        });
      }
    }

    // Load OpenAPI file
    let spec = loadOpenAPIFile(fileInfo.absolutePath, cache);
    if (!spec) {
      ctx.status = 404;
      ctx.body = {
        error: 'OpenAPI spec not found',
        path: fileInfo.relativePath,
      };
      return;
    }

    // Apply dynamic filter
    if (openapiFilter) {
      try {
        // Create a copy to prevent modifying the original
        spec = cloneOpenAPI(spec);
        const koaCtx: KoaContext = {
          headers,
          session: (ctx as unknown as { session?: KoaContext['session'] }).session,
          path: ctx.path,
          method: ctx.method,
          request: {
            headers,
          },
        };
        spec = await openapiFilter(spec, koaCtx);
      } catch (error) {
        ctx.status = 500;
        ctx.body = {
          error: 'Filter error',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        return;
      }
    }

    // Set response headers
    const contentType = getContentType(fileInfo.format);
    ctx.type = contentType;

    // Apply custom headers
    Object.entries(openapiHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') ctx.set(key, value);
    });

    // Send response
    ctx.body = serializeOpenAPI(spec, fileInfo.format);
  };
}

// Default export
export default nswagApi;
