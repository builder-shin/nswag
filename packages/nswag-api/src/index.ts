/**
 * @aspect/nswag-api
 * Middleware to expose generated OpenAPI files as JSON/YAML endpoints
 *
 * @example
 * Express:
 * ```typescript
 * import { nswagApi } from '@aspect/nswag-api/express';
 *
 * app.use('/api-docs', nswagApi({
 *   openapiRoot: './openapi',
 * }));
 * ```
 *
 * Fastify:
 * ```typescript
 * import { nswagApiPlugin } from '@aspect/nswag-api/fastify';
 *
 * app.register(nswagApiPlugin, {
 *   prefix: '/api-docs',
 *   openapiRoot: './openapi',
 * });
 * ```
 *
 * NestJS:
 * ```typescript
 * import { NswagApiModule } from '@aspect/nswag-api/nestjs';
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
 * ```
 *
 * Koa:
 * ```typescript
 * import { nswagApi } from '@aspect/nswag-api/koa';
 *
 * app.use(nswagApi({
 *   prefix: '/api-docs',
 *   openapiRoot: './openapi',
 * }));
 * ```
 */

// Export common types
export {
  // OpenAPI related types
  type OpenAPIObject,

  // Filter function types
  type OpenapiFilterFn,
  type ExpressOpenapiFilterFn,
  type FastifyOpenapiFilterFn,
  type KoaOpenapiFilterFn,

  // Request/Context types
  type ExpressRequest,
  type FastifyRequest,
  type KoaContext,

  // Configuration types
  type AuthConfig,
  type CacheConfig,
  type CorsConfig,

  // Options types
  type NswagApiOptions,
  type ExpressNswagApiOptions,
  type FastifyNswagApiOptions,
  type NestJSNswagApiOptions,
  type KoaNswagApiOptions,

  // Internal types
  type CacheEntry,
  type FileInfo,

  // Default values
  DEFAULT_OPTIONS,
} from './types.js';

// Export spec loader utilities
export {
  loadOpenAPIFile,
  parseRequestPath,
  serializeOpenAPI,
  getContentType,
  getFileFormat,
  cloneOpenAPI,
  invalidateCache,
  getCacheStats,
} from './spec-loader.js';

// Export authentication utilities
export {
  validateAuth,
  getAuthErrorStatusCode,
  type AuthResult,
} from './auth.js';

// Export CORS utilities
export {
  getCorsHeaders,
  getPreflightHeaders,
  isPreflightRequest,
  isOriginAllowed,
  getOriginFromHeaders,
  type CorsHeaders,
} from './cors.js';
