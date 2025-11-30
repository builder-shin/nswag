/**
 * Fastify plugin
 * Integrate Swagger UI or Redoc into Fastify app
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

// ========== Swagger UI Plugin ==========

/**
 * Swagger UI Fastify plugin
 *
 * @example
 * ```typescript
 * import { swaggerUiPlugin } from '@builder-shin/nswag-ui/fastify';
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
 * // Apply Basic Auth
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

  // Generate HTML (only once)
  const html = generateSwaggerUIHtml(options);

  // Basic Auth Hook
  const authHook = createFastifyBasicAuthHook(options.basicAuth);

  // Main route
  fastify.get(prefix, {
    preHandler: authHook,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.type('text/html').send(html);
  });

  // Path with trailing slash
  if (!prefix.endsWith('/')) {
    fastify.get(`${prefix}/`, {
      preHandler: authHook,
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.type('text/html').send(html);
    });
  }
};

/**
 * Create Swagger UI Fastify plugin (factory function)
 *
 * @param options - Swagger UI options
 * @returns Fastify plugin
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

// ========== Redoc Plugin ==========

/**
 * Redoc Fastify plugin
 *
 * @example
 * ```typescript
 * import { redocPlugin } from '@builder-shin/nswag-ui/fastify';
 *
 * await fastify.register(redocPlugin, {
 *   prefix: '/redoc',
 *   specUrl: '/api-docs/v1/openapi.json',
 * });
 *
 * // Apply Basic Auth
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

  // Generate HTML (only once)
  const html = generateRedocHtml(options);

  // Basic Auth Hook
  const authHook = createFastifyBasicAuthHook(options.basicAuth);

  // Main route
  fastify.get(prefix, {
    preHandler: authHook,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.type('text/html').send(html);
  });

  // Path with trailing slash
  if (!prefix.endsWith('/')) {
    fastify.get(`${prefix}/`, {
      preHandler: authHook,
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.type('text/html').send(html);
    });
  }
};

/**
 * Create Redoc Fastify plugin (factory function)
 *
 * @param options - Redoc options
 * @returns Fastify plugin
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

// ========== Helper Functions ==========

/**
 * Register Swagger UI on Fastify instance
 *
 * @param fastify - Fastify instance
 * @param options - Swagger UI options
 */
export async function registerSwaggerUI(
  fastify: FastifyInstance,
  options: FastifySwaggerUiPluginOptions
): Promise<void> {
  await fastify.register(swaggerUiPlugin, options);
}

/**
 * Register Redoc on Fastify instance
 *
 * @param fastify - Fastify instance
 * @param options - Redoc options
 */
export async function registerRedoc(
  fastify: FastifyInstance,
  options: FastifyRedocPluginOptions
): Promise<void> {
  await fastify.register(redocPlugin, options);
}

/**
 * Register both Swagger UI and Redoc
 *
 * @param fastify - Fastify instance
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * import { registerBothUIs } from '@builder-shin/nswag-ui/fastify';
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
