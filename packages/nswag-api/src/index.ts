/**
 * @aspect/nswag-api
 * 생성된 OpenAPI 파일을 JSON/YAML 엔드포인트로 노출하는 미들웨어
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

// 공통 타입 내보내기
export {
  // OpenAPI 관련 타입
  type OpenAPIObject,

  // 필터 함수 타입
  type OpenapiFilterFn,
  type ExpressOpenapiFilterFn,
  type FastifyOpenapiFilterFn,
  type KoaOpenapiFilterFn,

  // Request/Context 타입
  type ExpressRequest,
  type FastifyRequest,
  type KoaContext,

  // 설정 타입
  type AuthConfig,
  type CacheConfig,
  type CorsConfig,

  // 옵션 타입
  type NswagApiOptions,
  type ExpressNswagApiOptions,
  type FastifyNswagApiOptions,
  type NestJSNswagApiOptions,
  type KoaNswagApiOptions,

  // 내부 타입
  type CacheEntry,
  type FileInfo,

  // 기본 값
  DEFAULT_OPTIONS,
} from './types.js';

// 스펙 로더 유틸리티 내보내기
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

// 인증 유틸리티 내보내기
export {
  validateAuth,
  getAuthErrorStatusCode,
  type AuthResult,
} from './auth.js';

// CORS 유틸리티 내보내기
export {
  getCorsHeaders,
  getPreflightHeaders,
  isPreflightRequest,
  isOriginAllowed,
  getOriginFromHeaders,
  type CorsHeaders,
} from './cors.js';
