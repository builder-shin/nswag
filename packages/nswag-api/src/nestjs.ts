/**
 * NestJS module
 * Exposes OpenAPI specs as JSON/YAML endpoints in NestJS apps
 *
 * @example
 * ```typescript
 * import { NswagApiModule } from '@builder-shin/nswag-api/nestjs';
 *
 * @Module({
 *   imports: [
 *     NswagApiModule.forRoot({
 *       path: '/api-docs',
 *       openapiRoot: './openapi',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 *
 * // GET /api-docs/v1/openapi.json -> returns ./openapi/v1/openapi.json contents
 * ```
 */

import type { DynamicModule, MiddlewareConsumer } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
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
  type NestJSNswagApiOptions,
  type ExpressRequest,
  type OpenapiFilterFn,
} from './types.js';

/**
 * NswagApi module options token
 */
export const NSWAG_API_OPTIONS = 'NSWAG_API_OPTIONS';

/**
 * NswagApi middleware creation factory
 * @param options - Module options
 * @returns Express middleware
 */
function createNswagApiMiddleware(options: NestJSNswagApiOptions) {
  const {
    openapiRoot,
    path: basePath = '/api-docs',
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

    // Check if path starts with basePath
    if (!req.path.startsWith(basePath)) {
      next();
      return;
    }

    // Path with basePath removed
    const relativePath = req.path.slice(basePath.length);

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
      res.status(204).end();
      return;
    }

    // Parse request path
    const fileInfo = parseRequestPath(relativePath, absoluteRoot);
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
        spec = await (openapiFilter as OpenapiFilterFn<ExpressRequest>)(spec, expressReq);
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

/**
 * NswagApi NestJS dynamic module
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     NswagApiModule.forRoot({
 *       path: '/api-docs',
 *       openapiRoot: './openapi',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export class NswagApiModule {
  private static options: NestJSNswagApiOptions;

  /**
   * Create dynamic module
   * @param options - Module configuration
   * @returns Dynamic module definition
   */
  static forRoot(options: NestJSNswagApiOptions): DynamicModule {
    NswagApiModule.options = options;

    return {
      module: NswagApiModule,
      providers: [
        {
          provide: NSWAG_API_OPTIONS,
          useValue: options,
        },
      ],
      exports: [NSWAG_API_OPTIONS],
      global: true,
    };
  }

  /**
   * Configure middleware
   * NestJS calls this method to register middleware
   */
  configure(consumer: MiddlewareConsumer): void {
    const options = NswagApiModule.options;
    if (!options) {
      return;
    }

    const path = options.path || '/api-docs';
    const middleware = createNswagApiMiddleware(options);

    // Register middleware
    consumer
      .apply(middleware)
      .forRoutes(`${path}/*`);
  }
}

/**
 * NswagApi middleware factory (for manual configuration)
 * @param options - Middleware options
 * @returns Express middleware
 */
export function createNswagApiNestMiddleware(options: NestJSNswagApiOptions) {
  return createNswagApiMiddleware(options);
}

// Default export
export default NswagApiModule;
