/**
 * Fastify 플러그인
 * Fastify 앱에 Swagger UI 또는 Redoc 통합
 */

import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import {
  generateSwaggerUIHtml,
  generateRedocHtml,
} from './html-generator.js';
import {
  createFastifyBasicAuthHook,
} from './basic-auth.js';
import type {
  FastifySwaggerUiPluginOptions,
  FastifyRedocPluginOptions,
} from './types.js';

// ========== Swagger UI 플러그인 ==========

/**
 * Swagger UI Fastify 플러그인
 *
 * @example
 * ```typescript
 * import { swaggerUiPlugin } from '@aspect/nswag-ui/fastify';
 *
 * await fastify.register(swaggerUiPlugin, {
 *   prefix: '/docs',
 *   specUrls: [
 *     { url: '/api-docs/v1/openapi.json', name: 'API V1 Docs' },
 *     { url: '/api-docs/v2/openapi.json', name: 'API V2 Docs' },
 *   ],
 *   primaryName: 'API V2 Docs',
 * });
 *
 * // Basic Auth 적용
 * await fastify.register(swaggerUiPlugin, {
 *   prefix: '/docs',
 *   specUrl: '/api-docs/v1/openapi.json',
 *   basicAuth: {
 *     enabled: true,
 *     credentials: { username: 'admin', password: 'secret' }
 *   }
 * });
 * ```
 */
export const swaggerUiPlugin: FastifyPluginAsync<FastifySwaggerUiPluginOptions> = async (
  fastify: FastifyInstance,
  options: FastifySwaggerUiPluginOptions
): Promise<void> => {
  const prefix = options.prefix ?? '/docs';

  // HTML 생성 (한 번만)
  const html = generateSwaggerUIHtml(options);

  // Basic Auth Hook
  const authHook = createFastifyBasicAuthHook(options.basicAuth);

  // 메인 라우트
  fastify.get(prefix, {
    preHandler: authHook,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.type('text/html').send(html);
  });

  // 슬래시 포함 경로
  if (!prefix.endsWith('/')) {
    fastify.get(`${prefix}/`, {
      preHandler: authHook,
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.type('text/html').send(html);
    });
  }
};

/**
 * Swagger UI Fastify 플러그인 생성 (팩토리 함수)
 *
 * @param options - Swagger UI 옵션
 * @returns Fastify 플러그인
 */
export function createSwaggerUIPlugin(
  options: FastifySwaggerUiPluginOptions
): FastifyPluginCallback {
  return (fastify: FastifyInstance, _opts: unknown, done: () => void) => {
    const prefix = options.prefix ?? '/docs';
    const html = generateSwaggerUIHtml(options);
    const authHook = createFastifyBasicAuthHook(options.basicAuth);

    fastify.get(prefix, {
      preHandler: authHook,
    }, async (_request, reply) => {
      return reply.type('text/html').send(html);
    });

    if (!prefix.endsWith('/')) {
      fastify.get(`${prefix}/`, {
        preHandler: authHook,
      }, async (_request, reply) => {
        return reply.type('text/html').send(html);
      });
    }

    done();
  };
}

// ========== Redoc 플러그인 ==========

/**
 * Redoc Fastify 플러그인
 *
 * @example
 * ```typescript
 * import { redocPlugin } from '@aspect/nswag-ui/fastify';
 *
 * await fastify.register(redocPlugin, {
 *   prefix: '/redoc',
 *   specUrl: '/api-docs/v1/openapi.json',
 * });
 *
 * // Basic Auth 적용
 * await fastify.register(redocPlugin, {
 *   prefix: '/redoc',
 *   specUrl: '/api-docs/v1/openapi.json',
 *   basicAuth: {
 *     enabled: true,
 *     credentials: { username: 'admin', password: 'secret' }
 *   }
 * });
 * ```
 */
export const redocPlugin: FastifyPluginAsync<FastifyRedocPluginOptions> = async (
  fastify: FastifyInstance,
  options: FastifyRedocPluginOptions
): Promise<void> => {
  const prefix = options.prefix ?? '/redoc';

  // HTML 생성 (한 번만)
  const html = generateRedocHtml(options);

  // Basic Auth Hook
  const authHook = createFastifyBasicAuthHook(options.basicAuth);

  // 메인 라우트
  fastify.get(prefix, {
    preHandler: authHook,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.type('text/html').send(html);
  });

  // 슬래시 포함 경로
  if (!prefix.endsWith('/')) {
    fastify.get(`${prefix}/`, {
      preHandler: authHook,
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.type('text/html').send(html);
    });
  }
};

/**
 * Redoc Fastify 플러그인 생성 (팩토리 함수)
 *
 * @param options - Redoc 옵션
 * @returns Fastify 플러그인
 */
export function createRedocPlugin(
  options: FastifyRedocPluginOptions
): FastifyPluginCallback {
  return (fastify: FastifyInstance, _opts: unknown, done: () => void) => {
    const prefix = options.prefix ?? '/redoc';
    const html = generateRedocHtml(options);
    const authHook = createFastifyBasicAuthHook(options.basicAuth);

    fastify.get(prefix, {
      preHandler: authHook,
    }, async (_request, reply) => {
      return reply.type('text/html').send(html);
    });

    if (!prefix.endsWith('/')) {
      fastify.get(`${prefix}/`, {
        preHandler: authHook,
      }, async (_request, reply) => {
        return reply.type('text/html').send(html);
      });
    }

    done();
  };
}

// ========== 헬퍼 함수 ==========

/**
 * Fastify 인스턴스에 Swagger UI 등록
 *
 * @param fastify - Fastify 인스턴스
 * @param options - Swagger UI 옵션
 */
export async function registerSwaggerUI(
  fastify: FastifyInstance,
  options: FastifySwaggerUiPluginOptions
): Promise<void> {
  await fastify.register(swaggerUiPlugin, options);
}

/**
 * Fastify 인스턴스에 Redoc 등록
 *
 * @param fastify - Fastify 인스턴스
 * @param options - Redoc 옵션
 */
export async function registerRedoc(
  fastify: FastifyInstance,
  options: FastifyRedocPluginOptions
): Promise<void> {
  await fastify.register(redocPlugin, options);
}

/**
 * Swagger UI와 Redoc을 모두 등록
 *
 * @param fastify - Fastify 인스턴스
 * @param options - 설정 옵션
 *
 * @example
 * ```typescript
 * import { registerBothUIs } from '@aspect/nswag-ui/fastify';
 *
 * await registerBothUIs(fastify, {
 *   specUrl: '/api-docs/openapi.json',
 *   swaggerUiPrefix: '/docs',
 *   redocPrefix: '/redoc',
 *   basicAuth: {
 *     enabled: true,
 *     credentials: { username: 'admin', password: 'secret' }
 *   }
 * });
 * ```
 */
export async function registerBothUIs(
  fastify: FastifyInstance,
  options: {
    specUrl: string;
    swaggerUiPrefix?: string;
    redocPrefix?: string;
    basicAuth?: FastifySwaggerUiPluginOptions['basicAuth'];
    swaggerOptions?: Omit<FastifySwaggerUiPluginOptions, 'prefix' | 'specUrl' | 'basicAuth'>;
    redocOptions?: Omit<FastifyRedocPluginOptions, 'prefix' | 'specUrl' | 'basicAuth'>;
  }
): Promise<void> {
  const {
    specUrl,
    swaggerUiPrefix = '/docs',
    redocPrefix = '/redoc',
    basicAuth,
    swaggerOptions = {},
    redocOptions = {},
  } = options;

  await fastify.register(swaggerUiPlugin, {
    prefix: swaggerUiPrefix,
    specUrl,
    basicAuth,
    ...swaggerOptions,
  });

  await fastify.register(redocPlugin, {
    prefix: redocPrefix,
    specUrl,
    basicAuth,
    ...redocOptions,
  });
}
