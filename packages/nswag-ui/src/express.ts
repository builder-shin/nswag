/**
 * Express middleware
 * Integrate Swagger UI or Redoc into Express app
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

// ========== Express Type Definitions (used without dependencies) ==========

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

// ========== Swagger UI Middleware ==========

/**
 * Create Swagger UI Express middleware
 *
 * @param options - Swagger UI options
 * @returns Express middleware (used like a router)
 *
 * @example
 * ```typescript
 * import { swaggerUi } from '@aspect/nswag-ui';
 *
 * // Single spec
 * app.use('/docs', swaggerUi({
 *   specUrl: '/api-docs/v1/openapi.json',
 * }));
 *
 * // Multiple specs
 * app.use('/docs', swaggerUi({
 *   specUrls: [
 *     { url: '/api-docs/v1/openapi.json', name: 'API V1 Docs' },
 *     { url: '/api-docs/v2/openapi.json', name: 'API V2 Docs' },
 *   ],
 *   primaryName: 'API V2 Docs',
 * }));
 *
 * // Apply Basic Auth
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
  // Generate HTML (only once)
  const html = generateSwaggerUIHtml(options);

  // Basic Auth middleware
  const authMiddleware = createExpressBasicAuthMiddleware(options.basicAuth);

  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
    // Verify Basic Auth
    authMiddleware(req, res, () => {
      // Respond with HTML only at root path
      if (req.path === '/' || req.path === '') {
        res.type('text/html').send(html);
      } else {
        // Pass to next middleware for other paths
        next();
      }
    });
  };
}

/**
 * Create Swagger UI Express middleware (alias)
 * @deprecated Use swaggerUi instead
 */
export const createSwaggerUiMiddleware = swaggerUi;

// ========== Redoc Middleware ==========

/**
 * Create Redoc Express middleware
 *
 * @param options - Redoc options
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * import { redoc } from '@aspect/nswag-ui';
 *
 * app.use('/redoc', redoc({
 *   specUrl: '/api-docs/v1/openapi.json',
 * }));
 *
 * // Apply Basic Auth
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
  // Generate HTML (only once)
  const html = generateRedocHtml(options);

  // Basic Auth middleware
  const authMiddleware = createExpressBasicAuthMiddleware(options.basicAuth);

  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
    // Verify Basic Auth
    authMiddleware(req, res, () => {
      // Respond with HTML only at root path
      if (req.path === '/' || req.path === '') {
        res.type('text/html').send(html);
      } else {
        // Pass to next middleware for other paths
        next();
      }
    });
  };
}

/**
 * Create Redoc Express middleware (alias)
 * @deprecated Use redoc instead
 */
export const createRedocMiddleware = redoc;

// ========== Integrated Router Creation ==========

/**
 * Setup Express router including both Swagger UI and Redoc
 *
 * @param router - Express router instance
 * @param options - Configuration options
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

  // Swagger UI route
  const swaggerHtml = generateSwaggerUIHtml({
    specUrl,
    basicAuth,
    ...swaggerOptions,
  });

  const authMiddleware = createExpressBasicAuthMiddleware(basicAuth);

  router.get(swaggerUiPath, authMiddleware, (_req, res) => {
    res.type('text/html').send(swaggerHtml);
  });

  // Redoc route
  const redocHtml = generateRedocHtml({
    specUrl,
    basicAuth,
    ...redocOptions,
  });

  router.get(redocPath, authMiddleware, (_req, res) => {
    res.type('text/html').send(redocHtml);
  });
}
