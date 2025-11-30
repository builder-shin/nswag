/**
 * Express 미들웨어
 * Express 앱에서 OpenAPI 스펙을 JSON/YAML 엔드포인트로 노출
 *
 * @example
 * ```typescript
 * import { nswagApi } from '@aspect/nswag-api/express';
 *
 * app.use('/api-docs', nswagApi({
 *   openapiRoot: './openapi',
 * }));
 *
 * // GET /api-docs/v1/openapi.json -> ./openapi/v1/openapi.json 내용 반환
 * // GET /api-docs/v2/openapi.yaml -> ./openapi/v2/openapi.yaml 내용 반환
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
 * Express 미들웨어 생성
 * OpenAPI 스펙을 JSON/YAML 엔드포인트로 제공
 *
 * @param options - 미들웨어 설정
 * @returns Express 미들웨어
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

  // openapiRoot를 절대 경로로 변환
  const absoluteRoot = resolve(process.cwd(), openapiRoot);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // GET 또는 OPTIONS 메서드만 처리
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      next();
      return;
    }

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
      // CORS가 비활성화되었거나 오리진이 허용되지 않은 경우
      res.status(204).end();
      return;
    }

    // 요청 경로 파싱
    const fileInfo = parseRequestPath(req.path, absoluteRoot);
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
        spec = await openapiFilter(spec, expressReq);
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

// 기본 export
export default nswagApi;
