/**
 * Koa 미들웨어
 * Koa 앱에서 OpenAPI 스펙을 JSON/YAML 엔드포인트로 노출
 *
 * @example
 * ```typescript
 * import { nswagApi } from '@aspect/nswag-api/koa';
 *
 * app.use(nswagApi({
 *   prefix: '/api-docs',
 *   openapiRoot: './openapi',
 * }));
 *
 * // GET /api-docs/v1/openapi.json -> ./openapi/v1/openapi.json 내용 반환
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
 * Koa 미들웨어 생성
 * OpenAPI 스펙을 JSON/YAML 엔드포인트로 제공
 *
 * @param options - 미들웨어 설정
 * @returns Koa 미들웨어
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

  // openapiRoot를 절대 경로로 변환
  const absoluteRoot = resolve(process.cwd(), openapiRoot);

  return async (ctx: Context, next: Next): Promise<void> => {
    // GET 또는 OPTIONS 메서드만 처리
    if (ctx.method !== 'GET' && ctx.method !== 'OPTIONS') {
      await next();
      return;
    }

    // prefix로 시작하는지 확인
    if (prefix && !ctx.path.startsWith(prefix)) {
      await next();
      return;
    }

    // prefix 제거한 경로
    const relativePath = prefix ? ctx.path.slice(prefix.length) : ctx.path;
    const headers = ctx.headers as Record<string, string | string[] | undefined>;

    // CORS preflight 요청 처리
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

    // 요청 경로 파싱
    const fileInfo = parseRequestPath(relativePath, absoluteRoot);
    if (!fileInfo) {
      await next();
      return;
    }

    // 인증 검증
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

    // CORS 헤더 설정
    if (cors.enabled) {
      const origin = getOriginFromHeaders(headers);
      const corsHeaders = getCorsHeaders(origin, cors);

      if (corsHeaders) {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          if (value) ctx.set(key, value);
        });
      }
    }

    // OpenAPI 파일 로드
    let spec = loadOpenAPIFile(fileInfo.absolutePath, cache);
    if (!spec) {
      ctx.status = 404;
      ctx.body = {
        error: 'OpenAPI spec not found',
        path: fileInfo.relativePath,
      };
      return;
    }

    // 동적 필터 적용
    if (openapiFilter) {
      try {
        // 원본 수정 방지를 위해 복사본 생성
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

    // 응답 헤더 설정
    const contentType = getContentType(fileInfo.format);
    ctx.type = contentType;

    // 커스텀 헤더 적용
    Object.entries(openapiHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') ctx.set(key, value);
    });

    // 응답 전송
    ctx.body = serializeOpenAPI(spec, fileInfo.format);
  };
}

// 기본 export
export default nswagApi;
