/**
 * Fastify 플러그인
 * Fastify 앱에서 OpenAPI 스펙을 JSON/YAML 엔드포인트로 노출
 *
 * @example
 * ```typescript
 * import { nswagApiPlugin } from '@aspect/nswag-api/fastify';
 *
 * app.register(nswagApiPlugin, {
 *   prefix: '/api-docs',
 *   openapiRoot: './openapi',
 * });
 *
 * // GET /api-docs/v1/openapi.json -> ./openapi/v1/openapi.json 내용 반환
 * ```
 */

import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
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
  type FastifyNswagApiOptions,
  type FastifyRequest as FastifyRequestType,
} from './types.js';

/**
 * Fastify 플러그인
 * OpenAPI 스펙을 JSON/YAML 엔드포인트로 제공
 */
export const nswagApiPlugin: FastifyPluginCallback<FastifyNswagApiOptions> = (
  fastify: FastifyInstance,
  options: FastifyNswagApiOptions,
  done: (err?: Error) => void
) => {
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

  // 와일드카드 라우트 등록 (모든 하위 경로 처리)
  fastify.route({
    method: ['GET', 'OPTIONS'],
    url: '/*',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const headers = request.headers as Record<string, string | string[] | undefined>;

      // CORS preflight 요청 처리
      if (isPreflightRequest(request.method)) {
        if (cors.enabled) {
          const origin = getOriginFromHeaders(headers);
          const preflightHeaders = getPreflightHeaders(origin, cors);

          if (preflightHeaders) {
            Object.entries(preflightHeaders).forEach(([key, value]) => {
              if (value) reply.header(key, value);
            });
          }
        }
        return reply.status(204).send();
      }

      // 요청 경로 파싱 (prefix 제거)
      const requestPath = request.url.replace(/\?.*$/, ''); // 쿼리 스트링 제거
      const fileInfo = parseRequestPath(requestPath, absoluteRoot);

      if (!fileInfo) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Invalid OpenAPI spec path',
        });
      }

      // 인증 검증
      if (auth?.enabled) {
        const authResult = validateAuth(headers, auth);

        if (!authResult.success) {
          const statusCode = getAuthErrorStatusCode(auth);
          if (authResult.wwwAuthenticate) {
            reply.header('WWW-Authenticate', authResult.wwwAuthenticate);
          }
          return reply.status(statusCode).send({
            error: authResult.error,
          });
        }
      }

      // CORS 헤더 설정
      if (cors.enabled) {
        const origin = getOriginFromHeaders(headers);
        const corsHeaders = getCorsHeaders(origin, cors);

        if (corsHeaders) {
          Object.entries(corsHeaders).forEach(([key, value]) => {
            if (value) reply.header(key, value);
          });
        }
      }

      // OpenAPI 파일 로드
      let spec = loadOpenAPIFile(fileInfo.absolutePath, cache);
      if (!spec) {
        return reply.status(404).send({
          error: 'OpenAPI spec not found',
          path: fileInfo.relativePath,
        });
      }

      // 동적 필터 적용
      if (openapiFilter) {
        try {
          // 원본 수정 방지를 위해 복사본 생성
          spec = cloneOpenAPI(spec);
          const fastifyReq: FastifyRequestType = {
            headers,
            session: (request as unknown as { session?: FastifyRequestType['session'] }).session,
            url: request.url,
            method: request.method,
          };
          spec = await openapiFilter(spec, fastifyReq);
        } catch (error) {
          return reply.status(500).send({
            error: 'Filter error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // 응답 헤더 설정
      const contentType = getContentType(fileInfo.format);
      reply.header('Content-Type', contentType);

      // 커스텀 헤더 적용
      Object.entries(openapiHeaders).forEach(([key, value]) => {
        if (value) reply.header(key, value);
      });

      // 응답 전송
      const body = serializeOpenAPI(spec, fileInfo.format);
      return reply.send(body);
    },
  });

  done();
};

// 플러그인 메타데이터
(nswagApiPlugin as unknown as Record<symbol, unknown>)[Symbol.for('fastify.display-name')] = 'nswag-api';
(nswagApiPlugin as unknown as Record<symbol, unknown>)[Symbol.for('skip-override')] = true;

// 기본 export
export default nswagApiPlugin;
