/**
 * Express 미들웨어
 * Express 앱에 Swagger UI 또는 Redoc 통합
 */

import {
  generateSwaggerUIHtml,
  generateRedocHtml,
} from './html-generator.js';
import {
  createExpressBasicAuthMiddleware,
} from './basic-auth.js';
import type {
  SwaggerUiOptions,
  RedocOptions,
} from './types.js';

// ========== Express 타입 정의 (의존성 없이 사용) ==========

type ExpressRequest = {
  headers: {
    authorization?: string;
    [key: string]: string | undefined;
  };
  path: string;
  method: string;
};

type ExpressResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ExpressResponse;
  send(body: string): void;
  type(mimeType: string): ExpressResponse;
};

type ExpressNext = (err?: unknown) => void;

type ExpressMiddleware = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: ExpressNext
) => void;

type ExpressRouter = {
  get(path: string, ...handlers: ExpressMiddleware[]): void;
  use(...handlers: ExpressMiddleware[]): void;
};

// ========== Swagger UI 미들웨어 ==========

/**
 * Swagger UI Express 미들웨어 생성
 *
 * @param options - Swagger UI 옵션
 * @returns Express 미들웨어 (라우터처럼 사용)
 *
 * @example
 * ```typescript
 * import { swaggerUi } from '@aspect/nswag-ui';
 *
 * // 단일 스펙
 * app.use('/docs', swaggerUi({
 *   specUrl: '/api-docs/v1/openapi.json',
 * }));
 *
 * // 다중 스펙
 * app.use('/docs', swaggerUi({
 *   specUrls: [
 *     { url: '/api-docs/v1/openapi.json', name: 'API V1 Docs' },
 *     { url: '/api-docs/v2/openapi.json', name: 'API V2 Docs' },
 *   ],
 *   primaryName: 'API V2 Docs',
 * }));
 *
 * // Basic Auth 적용
 * app.use('/docs', swaggerUi({
 *   specUrl: '/api-docs/v1/openapi.json',
 *   basicAuth: {
 *     enabled: true,
 *     credentials: { username: 'admin', password: 'secret' }
 *   }
 * }));
 * ```
 */
export function swaggerUi(options: SwaggerUiOptions): ExpressMiddleware {
  // HTML 생성 (한 번만)
  const html = generateSwaggerUIHtml(options);

  // Basic Auth 미들웨어
  const authMiddleware = createExpressBasicAuthMiddleware(options.basicAuth);

  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
    // Basic Auth 검증
    authMiddleware(req, res, () => {
      // 루트 경로에서만 HTML 응답
      if (req.path === '/' || req.path === '') {
        res.type('text/html').send(html);
      } else {
        // 다른 경로는 다음 미들웨어로 전달
        next();
      }
    });
  };
}

/**
 * Swagger UI Express 미들웨어 생성 (별칭)
 * @deprecated swaggerUi를 사용하세요
 */
export const createSwaggerUiMiddleware = swaggerUi;

// ========== Redoc 미들웨어 ==========

/**
 * Redoc Express 미들웨어 생성
 *
 * @param options - Redoc 옵션
 * @returns Express 미들웨어
 *
 * @example
 * ```typescript
 * import { redoc } from '@aspect/nswag-ui';
 *
 * app.use('/redoc', redoc({
 *   specUrl: '/api-docs/v1/openapi.json',
 * }));
 *
 * // Basic Auth 적용
 * app.use('/redoc', redoc({
 *   specUrl: '/api-docs/v1/openapi.json',
 *   basicAuth: {
 *     enabled: true,
 *     credentials: { username: 'admin', password: 'secret' }
 *   }
 * }));
 * ```
 */
export function redoc(options: RedocOptions): ExpressMiddleware {
  // HTML 생성 (한 번만)
  const html = generateRedocHtml(options);

  // Basic Auth 미들웨어
  const authMiddleware = createExpressBasicAuthMiddleware(options.basicAuth);

  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
    // Basic Auth 검증
    authMiddleware(req, res, () => {
      // 루트 경로에서만 HTML 응답
      if (req.path === '/' || req.path === '') {
        res.type('text/html').send(html);
      } else {
        // 다른 경로는 다음 미들웨어로 전달
        next();
      }
    });
  };
}

/**
 * Redoc Express 미들웨어 생성 (별칭)
 * @deprecated redoc을 사용하세요
 */
export const createRedocMiddleware = redoc;

// ========== 통합 라우터 생성 ==========

/**
 * Swagger UI와 Redoc을 모두 포함하는 Express 라우터 설정
 *
 * @param router - Express 라우터 인스턴스
 * @param options - 설정 옵션
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { setupDocsRouter } from '@aspect/nswag-ui';
 *
 * const docsRouter = express.Router();
 * setupDocsRouter(docsRouter, {
 *   specUrl: '/api-docs/openapi.json',
 *   swaggerUiPath: '/swagger',
 *   redocPath: '/redoc',
 *   basicAuth: {
 *     enabled: true,
 *     credentials: { username: 'admin', password: 'secret' }
 *   }
 * });
 *
 * app.use('/docs', docsRouter);
 * // Swagger UI: /docs/swagger
 * // Redoc: /docs/redoc
 * ```
 */
export function setupDocsRouter(
  router: ExpressRouter,
  options: {
    specUrl: string;
    swaggerUiPath?: string;
    redocPath?: string;
    basicAuth?: SwaggerUiOptions['basicAuth'];
    swaggerOptions?: SwaggerUiOptions;
    redocOptions?: RedocOptions;
  }
): void {
  const {
    specUrl,
    swaggerUiPath = '/swagger',
    redocPath = '/redoc',
    basicAuth,
    swaggerOptions = {},
    redocOptions = {},
  } = options;

  // Swagger UI 라우트
  const swaggerHtml = generateSwaggerUIHtml({
    specUrl,
    basicAuth,
    ...swaggerOptions,
  });

  const authMiddleware = createExpressBasicAuthMiddleware(basicAuth);

  router.get(swaggerUiPath, authMiddleware, (_req, res) => {
    res.type('text/html').send(swaggerHtml);
  });

  // Redoc 라우트
  const redocHtml = generateRedocHtml({
    specUrl,
    basicAuth,
    ...redocOptions,
  });

  router.get(redocPath, authMiddleware, (_req, res) => {
    res.type('text/html').send(redocHtml);
  });
}
