/**
 * NestJS 모듈
 * NestJS 앱에서 OpenAPI 스펙을 JSON/YAML 엔드포인트로 노출
 *
 * @example
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
 *
 * // GET /api-docs/v1/openapi.json -> ./openapi/v1/openapi.json 내용 반환
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
 * NswagApi 모듈 옵션 토큰
 */
export const NSWAG_API_OPTIONS = 'NSWAG_API_OPTIONS';

/**
 * NswagApi 미들웨어 생성 팩토리
 * @param options - 모듈 옵션
 * @returns Express 미들웨어
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

  // openapiRoot를 절대 경로로 변환
  const absoluteRoot = resolve(process.cwd(), openapiRoot);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // GET 또는 OPTIONS 메서드만 처리
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      next();
      return;
    }

    // basePath로 시작하는지 확인
    if (!req.path.startsWith(basePath)) {
      next();
      return;
    }

    // basePath 제거한 경로
    const relativePath = req.path.slice(basePath.length);

    // CORS preflight 요청 처리
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

    // 요청 경로 파싱
    const fileInfo = parseRequestPath(relativePath, absoluteRoot);
    if (!fileInfo) {
      next();
      return;
    }

    // 인증 검증
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

    // CORS 헤더 설정
    if (cors.enabled) {
      const origin = getOriginFromHeaders(req.headers as Record<string, string | string[] | undefined>);
      const corsHeaders = getCorsHeaders(origin, cors);

      if (corsHeaders) {
        Object.entries(corsHeaders).forEach(([key, value]) => {
          if (value) res.setHeader(key, value);
        });
      }
    }

    // OpenAPI 파일 로드
    let spec = loadOpenAPIFile(fileInfo.absolutePath, cache);
    if (!spec) {
      res.status(404).json({
        error: 'OpenAPI spec not found',
        path: fileInfo.relativePath,
      });
      return;
    }

    // 동적 필터 적용
    if (openapiFilter) {
      try {
        // 원본 수정 방지를 위해 복사본 생성
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

    // 응답 헤더 설정
    const contentType = getContentType(fileInfo.format);
    res.setHeader('Content-Type', contentType);

    // 커스텀 헤더 적용
    Object.entries(openapiHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') res.setHeader(key, value);
    });

    // 응답 전송
    const body = serializeOpenAPI(spec, fileInfo.format);
    res.send(body);
  };
}

/**
 * NswagApi NestJS 동적 모듈
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
   * 동적 모듈 생성
   * @param options - 모듈 설정
   * @returns 동적 모듈 정의
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
   * 미들웨어 설정
   * NestJS가 이 메서드를 호출하여 미들웨어를 등록
   */
  configure(consumer: MiddlewareConsumer): void {
    const options = NswagApiModule.options;
    if (!options) {
      return;
    }

    const path = options.path || '/api-docs';
    const middleware = createNswagApiMiddleware(options);

    // 미들웨어 등록
    consumer
      .apply(middleware)
      .forRoutes(`${path}/*`);
  }
}

/**
 * NswagApi 미들웨어 팩토리 (수동 설정용)
 * @param options - 미들웨어 옵션
 * @returns Express 미들웨어
 */
export function createNswagApiNestMiddleware(options: NestJSNswagApiOptions) {
  return createNswagApiMiddleware(options);
}

// 기본 export
export default NswagApiModule;
